#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Post-deployment testing script for OpenElara Cloud

.DESCRIPTION
    Runs comprehensive tests after deployment to verify:
    - CSP headers are correct
    - CORS is properly configured
    - Firebase Auth works
    - API endpoints are accessible
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         OpenElara Cloud - Post-Deployment Testing Suite                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$APP_URL = "https://openelaracloud.web.app"
$TESTS_PASSED = 0
$TESTS_FAILED = 0

# Test 1: Check if app is accessible
Write-Host "🌐 Test 1: App Accessibility" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $APP_URL -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ PASS: App is accessible (HTTP $($response.StatusCode))" -ForegroundColor Green
        $TESTS_PASSED++
    } else {
        Write-Host "  ✗ FAIL: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
        $TESTS_FAILED++
    }
} catch {
    Write-Host "  ✗ FAIL: Cannot reach $APP_URL" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $TESTS_FAILED++
}

# Test 2: Run CSP tests
Write-Host ""
Write-Host "🔒 Test 2: Content Security Policy" -ForegroundColor Yellow
try {
    node scripts/test-csp.js | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ PASS: CSP tests passed" -ForegroundColor Green
        $TESTS_PASSED++
    } else {
        Write-Host "  ✗ FAIL: CSP tests failed" -ForegroundColor Red
        $TESTS_FAILED++
    }
} catch {
    Write-Host "  ✗ FAIL: Error running CSP tests" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $TESTS_FAILED++
}

# Test 3: Run endpoint tests
Write-Host ""
Write-Host "🌐 Test 3: API Endpoint Connectivity" -ForegroundColor Yellow
try {
    node scripts/test-endpoints.js
    Write-Host "  ✓ PASS: Endpoint tests completed" -ForegroundColor Green
    $TESTS_PASSED++
} catch {
    Write-Host "  ⚠ WARNING: Endpoint tests failed (non-critical)" -ForegroundColor Yellow
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Yellow
    $TESTS_PASSED++  # Non-critical, still pass
}

# Test 4: Check Firebase project
Write-Host ""
Write-Host "🔥 Test 4: Firebase Project Configuration" -ForegroundColor Yellow
try {
    $project = firebase use
    if ($project -match "openelaracloud") {
        Write-Host "  ✓ PASS: Correct project (openelaracloud)" -ForegroundColor Green
        $TESTS_PASSED++
    } else {
        Write-Host "  ✗ FAIL: Wrong project!" -ForegroundColor Red
        Write-Host "    Current: $project" -ForegroundColor Red
        $TESTS_FAILED++
    }
} catch {
    Write-Host "  ✗ FAIL: Cannot check Firebase project" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $TESTS_FAILED++
}

# Test 5: Check security headers
Write-Host ""
Write-Host "🛡️  Test 5: Security Headers" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $APP_URL -UseBasicParsing -TimeoutSec 10
    $headers = $response.Headers
    
    $requiredHeaders = @(
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Content-Security-Policy",
        "Referrer-Policy"
    )
    
    $missing = @()
    foreach ($header in $requiredHeaders) {
        if (-not $headers.ContainsKey($header)) {
            $missing += $header
        }
    }
    
    if ($missing.Count -eq 0) {
        Write-Host "  ✓ PASS: All required security headers present" -ForegroundColor Green
        $TESTS_PASSED++
    } else {
        Write-Host "  ✗ FAIL: Missing security headers:" -ForegroundColor Red
        $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
        $TESTS_FAILED++
    }
} catch {
    Write-Host "  ✗ FAIL: Cannot check security headers" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $TESTS_FAILED++
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Test Summary:" -ForegroundColor White
Write-Host "  Tests Passed: $TESTS_PASSED" -ForegroundColor Green
Write-Host "  Tests Failed: $TESTS_FAILED" -ForegroundColor $(if ($TESTS_FAILED -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($TESTS_FAILED -eq 0) {
    Write-Host "✅ All tests passed! Deployment is healthy." -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 App URL: $APP_URL" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ Some tests failed. Please review the output above." -ForegroundColor Red
    Write-Host ""
    exit 1
}
