# PWA Icon Generator for OpenElara Cloud
# Generates all required PWA icons from source image

param(
    [string]$SourceImage = "C:\myCodeProjects\openElaraCloud\docs\Elara_selfie_2026-01-07T10-33-52-679Z.png",
    [string]$OutputDir = "C:\myCodeProjects\openElaraCloud\public"
)

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  PWA Icon Generator" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Verify source image exists
if (-not (Test-Path $SourceImage)) {
    Write-Host "ERROR: Source image not found at: $SourceImage" -ForegroundColor Red
    exit 1
}

# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

try {
    # Load source image
    Write-Host "Loading source image..." -ForegroundColor Yellow
    $sourceImg = [System.Drawing.Image]::FromFile($SourceImage)
    Write-Host " Loaded: $($sourceImg.Width)x$($sourceImg.Height)" -ForegroundColor Green
    Write-Host ""

    # Function to resize and save with high quality
    function Save-Icon {
        param(
            [System.Drawing.Image]$Source,
            [int]$Width,
            [int]$Height,
            [string]$OutputPath,
            [string]$Label
        )
        
        $sizeText = "$Width" + "x" + "$Height"
        Write-Host "  Generating $Label ($sizeText)..." -NoNewline
        
        $dest = New-Object System.Drawing.Bitmap($Width, $Height)
        $graphics = [System.Drawing.Graphics]::FromImage($dest)
        
        # High quality settings
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        $graphics.DrawImage($Source, 0, 0, $Width, $Height)
        $dest.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $dest.Dispose()
        
        Write-Host " " -ForegroundColor Green
    }

    # Generate all required PWA icons
    Write-Host "Generating PWA icons:" -ForegroundColor Yellow
    
    Save-Icon -Source $sourceImg -Width 16 -Height 16 -OutputPath "$OutputDir\favicon-16.png" -Label "favicon-16.png"
    Save-Icon -Source $sourceImg -Width 32 -Height 32 -OutputPath "$OutputDir\favicon-32.png" -Label "favicon-32.png"
    Save-Icon -Source $sourceImg -Width 48 -Height 48 -OutputPath "$OutputDir\favicon-48.png" -Label "favicon-48.png"
    Save-Icon -Source $sourceImg -Width 180 -Height 180 -OutputPath "$OutputDir\apple-touch-icon.png" -Label "apple-touch-icon.png (iOS)"
    Save-Icon -Source $sourceImg -Width 192 -Height 192 -OutputPath "$OutputDir\icon-192.png" -Label "icon-192.png (PWA)"
    Save-Icon -Source $sourceImg -Width 512 -Height 512 -OutputPath "$OutputDir\icon-512.png" -Label "icon-512.png (PWA)"
    Save-Icon -Source $sourceImg -Width 512 -Height 512 -OutputPath "$OutputDir\icon.png" -Label "icon.png (General)"
    
    $sourceImg.Dispose()
    
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Green
    Write-Host "   All PWA icons generated!" -ForegroundColor Green
    Write-Host "===================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Generated files:" -ForegroundColor Cyan
    Write-Host "  • favicon-16.png (16x16)" -ForegroundColor Gray
    Write-Host "  • favicon-32.png (32x32)" -ForegroundColor Gray
    Write-Host "  • favicon-48.png (48x48)" -ForegroundColor Gray
    Write-Host "  • apple-touch-icon.png (180x180 - iOS)" -ForegroundColor Gray
    Write-Host "  • icon-192.png (192x192 - Android)" -ForegroundColor Gray
    Write-Host "  • icon-512.png (512x512 - Android)" -ForegroundColor Gray
    Write-Host "  • icon.png (512x512 - General)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Update manifest.json with proper icon references" -ForegroundColor Gray
    Write-Host "  2. Update _document.tsx link tags" -ForegroundColor Gray
    Write-Host "  3. Generate multi-size favicon.ico (optional)" -ForegroundColor Gray
    
}
catch {
    Write-Host ""
    $errMsg = $_.Exception.Message
    Write-Host "ERROR: $errMsg" -ForegroundColor Red
    exit 1
}
