# ==============================================================================
# PROJECT PREFLIGHT (ASCII COMPATIBLE)
# ==============================================================================
$MARKER_FILE = ".preflight-passed"

Write-Host "--- PROJECT PREFLIGHT ---" -ForegroundColor Cyan

# 1. Character Check (PS v5.1+ Compatible)
Write-Host "Checking for illegal characters..." -ForegroundColor Yellow
$badFiles = Get-ChildItem -Recurse -Include *.ps1, *.js, *.ts | Where-Object {
    $content = (Get-Content $_.FullName) -join "`n"
    $content -match '[^\x00-\x7F]'
}

if ($badFiles) {
    Write-Host "CRITICAL: Non-ASCII characters found!" -ForegroundColor Red
    $badFiles | ForEach-Object { Write-Host " - $($_.Name)" -ForegroundColor Yellow }
    exit 1
}

# 2. Service Verification (Requires Commander to have run)
Write-Host "Provisioning Project Services..." -ForegroundColor Yellow
gcloud services enable secretmanager.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable run.googleapis.com

# 3. Build & Test
Write-Host "Running Build..." -ForegroundColor Yellow
npm run lint
npm test
npm run build

if ($LASTEXITCODE -eq 0) {
    "{ ""status"": ""CLEAN"" }" | Out-File -FilePath $MARKER_FILE -Encoding ASCII
    Write-Host "Preflight Passed." -ForegroundColor Green
} else {
    Write-Host "Build/Test Failed." -ForegroundColor Red
    exit 1
}