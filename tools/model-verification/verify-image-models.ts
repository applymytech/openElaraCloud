/**
 * Image Model Verification Script for Cloud
 * ==========================================
 * Tests all image models against Together.ai API using MVP payload.
 * Designed for Cloud-specific model verification.
 * 
 * Usage:
 *   cd tools && npm install
 *   $env:TOGETHER_API_KEY="your_key"
 *   npm run verify:images
 * 
 * Part of OpenElara Cloud Testing Infrastructure
 */

import { VERIFIED_IMAGE_MODELS, getImageModel } from '../../src/lib/verified-image-models.js';
import { buildPayload, type ParameterSchema } from '../../src/lib/model-registry.js';

// ============================================================================
// Configuration
// ============================================================================

const API_KEY = process.env.TOGETHER_API_KEY;
const API_URL = 'https://api.together.xyz/v1/images/generations';
const TEST_PROMPT = 'A simple red cube on a white background, minimalist';

// Rate limiting
const DELAY_BETWEEN_TESTS_MS = 2000;
const TIMEOUT_MS = 60000;

// ============================================================================
// Types
// ============================================================================

interface TestResult {
  modelId: string;
  modelName: string;
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  responseTime?: number;
  payloadSent: Record<string, unknown>;
  timestamp: string;
}

interface TestSummary {
  totalModels: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

// ============================================================================
// API Client
// ============================================================================

async function testModel(modelId: string): Promise<TestResult> {
  const model = getImageModel(modelId);
  if (!model) {
    return {
      modelId,
      modelName: 'Unknown',
      success: false,
      errorMessage: 'Model not found in registry',
      payloadSent: {},
      timestamp: new Date().toISOString(),
    };
  }

  const _hasSizeParam = model.parameters.some((p: ParameterSchema) => p.name === 'size');
  const hasWidthHeight = model.parameters.some((p: ParameterSchema) => p.name === 'width');
  
  const userOverrides: Record<string, unknown> = {
    prompt: TEST_PROMPT,
  };
  
  if (hasWidthHeight) {
    userOverrides.width = 1024;
    userOverrides.height = 1024;
  }

  const { payload, warnings } = buildPayload(model, userOverrides);
  
  if (warnings.length > 0) {
    console.log(`  ⚠️  Warnings: ${warnings.join(', ')}`);
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const hasImage = data.data && data.data.length > 0 && 
                       (data.data[0].b64_json || data.data[0].url);
      
      return {
        modelId,
        modelName: model.displayName,
        success: hasImage,
        statusCode: response.status,
        responseTime,
        payloadSent: payload,
        timestamp: new Date().toISOString(),
        errorMessage: hasImage ? undefined : 'Response missing image data',
      };
    } else {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.message || errorBody;
      } catch {
        errorMessage = errorBody.substring(0, 200);
      }

      return {
        modelId,
        modelName: model.displayName,
        success: false,
        statusCode: response.status,
        responseTime,
        errorMessage,
        payloadSent: payload,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      modelId,
      modelName: model.displayName,
      success: false,
      responseTime,
      errorMessage: errorMessage.includes('abort') ? 'Timeout' : errorMessage,
      payloadSent: payload,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Test Runner
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllTests(): Promise<TestSummary> {
  const startTime = new Date();
  const results: TestResult[] = [];
  
  const models = VERIFIED_IMAGE_MODELS;
  console.log(`\n🖼️  Image Model Verification - OpenElara Cloud`);
  console.log('='.repeat(60));
  console.log(`📋 Testing ${models.length} models with MVP payload`);
  console.log(`🔑 API Key: ${API_KEY ? '✓ Set' : '✗ Missing!'}`);
  console.log(`⏱️  Delay between tests: ${DELAY_BETWEEN_TESTS_MS}ms`);
  console.log('='.repeat(60));
  console.log();

  if (!API_KEY) {
    console.error('❌ TOGETHER_API_KEY environment variable not set!');
    console.error('   Set it with: $env:TOGETHER_API_KEY="your_key"');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const modelId = model.id;
    
    console.log(`[${i + 1}/${models.length}] Testing: ${model.displayName}`);
    console.log(`         Model ID: ${modelId}`);
    
    const result = await testModel(modelId);
    results.push(result);

    if (result.success) {
      console.log(`         ✅ PASS (${result.responseTime}ms)`);
      passed++;
    } else {
      console.log(`         ❌ FAIL: ${result.errorMessage}`);
      failed++;
    }
    
    if (i < models.length - 1) {
      await sleep(DELAY_BETWEEN_TESTS_MS);
    }
    console.log();
  }

  const endTime = new Date();
  const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

  return {
    totalModels: models.length,
    passed,
    failed,
    skipped: 0,
    results,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationSeconds,
  };
}

function printSummary(summary: TestSummary): void {
  console.log('='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total Models: ${summary.totalModels}`);
  console.log(`   ✅ Passed:    ${summary.passed}`);
  console.log(`   ❌ Failed:    ${summary.failed}`);
  console.log(`   ⏭️  Skipped:   ${summary.skipped}`);
  console.log(`   ⏱️  Duration:  ${summary.durationSeconds.toFixed(1)}s`);
  console.log();

  if (summary.failed > 0) {
    console.log('❌ FAILED MODELS:');
    console.log('-'.repeat(60));
    for (const result of summary.results.filter(r => !r.success)) {
      console.log(`   • ${result.modelId}`);
      console.log(`     Error: ${result.errorMessage}`);
    }
    console.log();
  }

  const successRate = ((summary.passed / summary.totalModels) * 100).toFixed(1);
  console.log(`📈 Success Rate: ${successRate}%`);
  console.log();
}

async function main(): Promise<void> {
  try {
    const summary = await runAllTests();
    printSummary(summary);
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
