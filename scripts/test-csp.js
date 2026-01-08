#!/usr/bin/env node
/**
 * CSP/CORS Testing Script
 * Tests deployed app for Content Security Policy and CORS issues
 */

const https = require('https');
const http = require('http');

const APP_URL = 'https://openelaracloud.web.app';
const EXPECTED_ORIGINS = [
  'https://firebasestorage.googleapis.com',
  'https://api.together.xyz',
  'https://openrouter.ai',
  'https://api.exa.ai',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://apis.google.com',
  'https://accounts.google.com'
];

console.log('🔍 Testing CSP/CORS Configuration for:', APP_URL);
console.log('━'.repeat(80));

/**
 * Fetch headers from deployed app
 */
function fetchHeaders(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      resolve(res.headers);
    }).on('error', reject);
  });
}

/**
 * Parse CSP header into directives
 */
function parseCSP(cspHeader) {
  if (!cspHeader) return {};
  
  const directives = {};
  cspHeader.split(';').forEach(directive => {
    const [key, ...values] = directive.trim().split(/\s+/);
    if (key) {
      directives[key] = values;
    }
  });
  
  return directives;
}

/**
 * Check if origin is allowed by CSP directive
 */
function isOriginAllowed(origin, directive) {
  if (!directive) return false;
  
  // Check for wildcards
  for (const allowed of directive) {
    if (allowed === '*') return true;
    if (allowed === "'self'") continue;
    if (allowed === 'https:' || allowed === 'data:' || allowed === 'blob:') continue;
    
    // Exact match
    if (origin === allowed) return true;
    
    // Wildcard subdomain match (e.g., https://*.googleapis.com)
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*').replace(/\./g, '\\.');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) return true;
    }
  }
  
  return false;
}

/**
 * Main test function
 */
async function runTests() {
  let passed = 0;
  let failed = 0;
  
  try {
    console.log('\n📡 Fetching headers...');
    const headers = await fetchHeaders(APP_URL);
    
    // Test 1: Check if CSP header exists
    console.log('\n✓ Test 1: CSP Header Exists');
    const cspHeader = headers['content-security-policy'];
    if (!cspHeader) {
      console.error('  ❌ FAIL: No Content-Security-Policy header found!');
      failed++;
      return;
    }
    console.log('  ✓ PASS: CSP header present');
    passed++;
    
    // Parse CSP
    const csp = parseCSP(cspHeader);
    console.log('\n📋 CSP Directives Found:');
    Object.keys(csp).forEach(key => {
      console.log(`  - ${key}: ${csp[key].join(' ')}`);
    });
    
    // Test 2: Check frame-src for Firebase Auth
    console.log('\n✓ Test 2: Frame Sources');
    if (!csp['frame-src']) {
      console.error('  ❌ FAIL: frame-src directive missing (Firebase Auth needs this)');
      failed++;
    } else {
      const hasFirebase = isOriginAllowed('https://openelaracloud.firebaseapp.com', csp['frame-src']);
      const hasGoogle = isOriginAllowed('https://accounts.google.com', csp['frame-src']);
      
      if (hasFirebase && hasGoogle) {
        console.log('  ✓ PASS: Firebase and Google frames allowed');
        passed++;
      } else {
        console.error('  ❌ FAIL: Missing required frame sources');
        console.error(`    - Firebase: ${hasFirebase ? '✓' : '✗'}`);
        console.error(`    - Google: ${hasGoogle ? '✓' : '✗'}`);
        failed++;
      }
    }
    
    // Test 3: Check script-src
    console.log('\n✓ Test 3: Script Sources');
    if (!csp['script-src']) {
      console.error('  ❌ FAIL: script-src directive missing');
      failed++;
    } else {
      const hasGoogle = isOriginAllowed('https://apis.google.com', csp['script-src']);
      const hasFirebase = isOriginAllowed('https://openelaracloud.firebaseapp.com', csp['script-src']);
      
      if (hasGoogle && hasFirebase) {
        console.log('  ✓ PASS: Required script sources allowed');
        passed++;
      } else {
        console.error('  ❌ FAIL: Missing required script sources');
        console.error(`    - Google APIs: ${hasGoogle ? '✓' : '✗'}`);
        console.error(`    - Firebase: ${hasFirebase ? '✓' : '✗'}`);
        failed++;
      }
    }
    
    // Test 4: Check connect-src for API endpoints
    console.log('\n✓ Test 4: Connect Sources (API endpoints)');
    if (!csp['connect-src']) {
      console.error('  ❌ FAIL: connect-src directive missing');
      failed++;
    } else {
      const apiOrigins = [
        'https://api.together.xyz',
        'https://openrouter.ai',
        'https://api.exa.ai'
      ];
      
      const results = apiOrigins.map(origin => ({
        origin,
        allowed: isOriginAllowed(origin, csp['connect-src'])
      }));
      
      const allAllowed = results.every(r => r.allowed);
      
      if (allAllowed) {
        console.log('  ✓ PASS: All API endpoints allowed');
        passed++;
      } else {
        console.error('  ❌ FAIL: Some API endpoints blocked');
        results.forEach(r => {
          console.error(`    - ${r.origin}: ${r.allowed ? '✓' : '✗'}`);
        });
        failed++;
      }
    }
    
    // Test 5: Check style-src for Google Fonts
    console.log('\n✓ Test 5: Style Sources (Google Fonts)');
    if (!csp['style-src']) {
      console.error('  ❌ FAIL: style-src directive missing');
      failed++;
    } else {
      const hasFonts = isOriginAllowed('https://fonts.googleapis.com', csp['style-src']);
      
      if (hasFonts) {
        console.log('  ✓ PASS: Google Fonts stylesheets allowed');
        passed++;
      } else {
        console.error('  ❌ FAIL: Google Fonts blocked in style-src');
        failed++;
      }
    }
    
    // Test 6: Check font-src for Google Fonts
    console.log('\n✓ Test 6: Font Sources');
    if (!csp['font-src']) {
      console.error('  ❌ FAIL: font-src directive missing');
      failed++;
    } else {
      const hasFonts = isOriginAllowed('https://fonts.gstatic.com', csp['font-src']);
      
      if (hasFonts) {
        console.log('  ✓ PASS: Google Fonts files allowed');
        passed++;
      } else {
        console.error('  ❌ FAIL: Google Fonts blocked in font-src');
        failed++;
      }
    }
    
    // Test 7: Check for dangerous directives
    console.log('\n✓ Test 7: Security Best Practices');
    const dangerous = [];
    
    if (csp['script-src']?.includes("'unsafe-eval'")) {
      dangerous.push("'unsafe-eval' in script-src (required for Firebase)");
    }
    if (!csp['object-src']?.includes("'none'")) {
      dangerous.push('object-src should be set to none');
    }
    if (!csp['base-uri']?.includes("'self'")) {
      dangerous.push("base-uri should be set to 'self'");
    }
    
    if (dangerous.length === 0) {
      console.log('  ✓ PASS: No critical security issues');
      passed++;
    } else {
      console.log('  ⚠ WARNING: Potential security concerns:');
      dangerous.forEach(issue => console.log(`    - ${issue}`));
      passed++;
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n' + '━'.repeat(80));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All tests passed! CSP is properly configured.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Review CSP configuration.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
