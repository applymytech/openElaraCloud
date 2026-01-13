/**
 * Deployment Verification Script
 * ================================
 * Verifies that OpenElara Cloud is properly deployed and accessible.
 * 
 * Usage:
 *   cd tools && npm install
 *   npm run test:deployment
 * 
 * Part of OpenElara Cloud Testing Infrastructure
 */

const CLOUD_URL = 'https://openelaracloud.web.app';

interface HealthCheckResult {
  url: string;
  status: number;
  ok: boolean;
  responseTimeMs: number;
  error?: string;
}

async function checkEndpoint(url: string, name: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/json',
      },
    });
    
    const responseTimeMs = Date.now() - startTime;
    
    return {
      url,
      status: response.status,
      ok: response.ok,
      responseTimeMs,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runDeploymentTests(): Promise<void> {
  console.log('\n🚀 OpenElara Cloud Deployment Verification');
  console.log('='.repeat(60));
  console.log(`🌐 Target: ${CLOUD_URL}`);
  console.log('='.repeat(60));
  console.log();

  const endpoints = [
    { path: '/', name: 'Home/Login Page' },
    { path: '/chat', name: 'Chat Page' },
    { path: '/account', name: 'Account Page' },
    { path: '/manifest.json', name: 'PWA Manifest' },
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const url = `${CLOUD_URL}${endpoint.path}`;
    console.log(`Testing: ${endpoint.name}`);
    console.log(`   URL: ${url}`);
    
    const result = await checkEndpoint(url, endpoint.name);
    
    if (result.ok) {
      console.log(`   ✅ PASS (${result.status}, ${result.responseTimeMs}ms)`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: ${result.error || `HTTP ${result.status}`}`);
      failed++;
    }
    console.log();
  }

  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log('⚠️  Some endpoints are not accessible!');
    console.log('   Check Firebase deployment status.');
    process.exit(1);
  } else {
    console.log('✅ All endpoints accessible!');
  }
}

runDeploymentTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
