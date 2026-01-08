#!/usr/bin/env node
/**
 * API Endpoint Testing Script
 * Tests CORS configuration for all external API endpoints
 */

const https = require('https');

const ENDPOINTS = [
  {
    name: 'Together.ai',
    url: 'https://api.together.xyz/v1/models',
    needsAuth: true
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/models',
    needsAuth: true
  },
  {
    name: 'Exa',
    url: 'https://api.exa.ai/search',
    needsAuth: true
  },
  {
    name: 'Firebase Storage',
    url: 'https://firebasestorage.googleapis.com',
    needsAuth: false
  }
];

const APP_ORIGIN = 'https://openelaracloud.web.app';

console.log('🌐 Testing CORS Configuration');
console.log('━'.repeat(80));

/**
 * Test CORS preflight for an endpoint
 */
function testCORS(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'OPTIONS',
      headers: {
        'Origin': APP_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization'
      }
    };
    
    const req = https.request(options, (res) => {
      const result = {
        endpoint: endpoint.name,
        url: endpoint.url,
        status: res.statusCode,
        headers: res.headers,
        corsEnabled: false,
        allowsOrigin: false,
        allowsMethod: false,
        allowsHeaders: false
      };
      
      // Check CORS headers
      const acao = res.headers['access-control-allow-origin'];
      const acam = res.headers['access-control-allow-methods'];
      const acah = res.headers['access-control-allow-headers'];
      
      result.corsEnabled = !!(acao || acam || acah);
      result.allowsOrigin = acao === '*' || acao === APP_ORIGIN;
      result.allowsMethod = acam ? acam.toUpperCase().includes('POST') : false;
      result.allowsHeaders = acah ? (
        acah.toLowerCase().includes('content-type') &&
        acah.toLowerCase().includes('authorization')
      ) : false;
      
      resolve(result);
    });
    
    req.on('error', (error) => {
      resolve({
        endpoint: endpoint.name,
        url: endpoint.url,
        error: error.message,
        corsEnabled: false
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        endpoint: endpoint.name,
        url: endpoint.url,
        error: 'Timeout',
        corsEnabled: false
      });
    });
    
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`\n📍 Testing from origin: ${APP_ORIGIN}\n`);
  
  const results = [];
  
  for (const endpoint of ENDPOINTS) {
    console.log(`Testing ${endpoint.name}...`);
    const result = await testCORS(endpoint);
    results.push(result);
    
    if (result.error) {
      console.log(`  ⚠ ${result.error}`);
    } else if (result.corsEnabled) {
      console.log(`  ✓ CORS enabled`);
      console.log(`    - Origin: ${result.allowsOrigin ? '✓' : '✗'} ${result.headers['access-control-allow-origin'] || 'not set'}`);
      console.log(`    - Method: ${result.allowsMethod ? '✓' : '✗'} ${result.headers['access-control-allow-methods'] || 'not set'}`);
      console.log(`    - Headers: ${result.allowsHeaders ? '✓' : '✗'} ${result.headers['access-control-allow-headers'] || 'not set'}`);
    } else {
      console.log(`  ℹ No CORS headers (may use different auth method)`);
    }
    console.log('');
  }
  
  // Summary
  console.log('━'.repeat(80));
  console.log('📊 CORS Summary:\n');
  
  const needsCORS = results.filter(r => ENDPOINTS.find(e => e.name === r.endpoint).needsAuth);
  const working = needsCORS.filter(r => r.corsEnabled && (r.allowsOrigin || r.headers?.['access-control-allow-origin'] === '*'));
  
  console.log(`Endpoints requiring CORS: ${needsCORS.length}`);
  console.log(`Working with CORS: ${working.length}`);
  console.log(`\n💡 Note: Most AI APIs use direct API key authentication in request headers,`);
  console.log(`   not browser CORS. BYOK mode sends keys directly from browser.`);
  
  return results;
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
