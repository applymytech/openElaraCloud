/**
 * Models API Test Script
 * 
 * Tests Together.ai /models endpoint to verify:
 * 1. API schema compliance
 * 2. Model availability
 * 3. Correct model IDs and metadata
 * 
 * Run: 
 *   PowerShell: $env:TOGETHER_API_KEY="your_key"; node test-models-api.js
 *   Or: node test-models-api.js YOUR_KEY
 */

const https = require('https');

const TOGETHER_API_KEY = process.argv[2] || process.env.TOGETHER_API_KEY;

if (!TOGETHER_API_KEY) {
  console.error('Usage: node test-models-api.js YOUR_TOGETHER_API_KEY');
  console.error('Or set $env:TOGETHER_API_KEY="your_key" in PowerShell');
  process.exit(1);
}

function fetchModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.together.xyz',
      path: '/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Testing Together.ai /models API...\n');
  
  try {
    const response = await fetchModels();
    
    console.log('✓ API Response Structure:');
    console.log(`  - Has 'data' property: ${!!response.data}`);
    console.log(`  - Total models: ${response.data ? response.data.length : 0}\n`);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('✗ Invalid response format - expected { data: [...] }');
      process.exit(1);
    }

    // Check for specific models we care about
    const testModels = [
      'ServiceNow-AI/Apriel-1.5-15b-Thinker',
      'ServiceNow-AI/Apriel-1.6-16b-Thinker',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      'black-forest-labs/FLUX.1-schnell',
      'black-forest-labs/FLUX.1-dev',
    ];

    console.log('✓ Checking specific models:\n');
    
    for (const modelId of testModels) {
      const found = response.data.find(m => m.id === modelId);
      if (found) {
        console.log(`  ✓ ${modelId}`);
        console.log(`    Type: ${found.type || 'N/A'}`);
        console.log(`    Display: ${found.display_name || 'N/A'}`);
        console.log(`    Context: ${found.context_length || 'N/A'}`);
      } else {
        console.log(`  ✗ ${modelId} - NOT FOUND`);
      }
    }

    // List all chat models
    console.log('\n✓ All Chat Models:');
    const chatModels = response.data.filter(m => m.type === 'chat');
    console.log(`  Total: ${chatModels.length}\n`);
    chatModels.forEach(m => {
      const pricing = m.pricing?.input === 0 && m.pricing?.output === 0 ? 'FREE' : 'PAID';
      const context = m.context_length || 'N/A';
      console.log(`  - ${m.id}`);
      console.log(`    Display: ${m.display_name || 'N/A'}`);
      console.log(`    Context: ${context} | Pricing: ${pricing}`);
    });

    // List all image models
    console.log('\n✓ All Image Models:');
    const imageModels = response.data.filter(m => m.type === 'image');
    console.log(`  Total: ${imageModels.length}\n`);
    imageModels.forEach(m => {
      const pricing = m.pricing?.image === 0 ? 'FREE' : `$${m.pricing?.image || '?'}`;
      console.log(`  - ${m.id} (${m.display_name || 'No name'}) - ${pricing}`);
    });

    // List all video models
    console.log('\n✓ All Video Models:');
    const videoModels = response.data.filter(m => m.type === 'video');
    console.log(`  Total: ${videoModels.length}\n`);
    videoModels.forEach(m => {
      console.log(`  - ${m.id} (${m.display_name || 'No name'})`);
    });

    console.log('\n✓ Test completed successfully');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

main();
