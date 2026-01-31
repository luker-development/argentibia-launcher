# Argentibia Launcher Build Script
# Purpose: Automated packaging for Windows

param(
    [switch]$Clean = $false,
    [switch]$SkipInstall = $false,
    [switch]$NoSign = $false
)

$ErrorActionPreference = "Stop"
$DIST_DIR = "dist"

Write-Host "=== Argentibia Launcher Build Script ===" -ForegroundColor Cyan

# Set code signing environment if needed
if ($NoSign) {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    $env:CSC_LINK = ""
    $env:CSC_KEY_PASSWORD = ""
    Write-Host "Code signing disabled" -ForegroundColor Yellow
}

# Step 1: Clean previous builds
if ($Clean) {
    Write-Host "Cleaning build directories..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $DIST_DIR -ErrorAction SilentlyContinue
    Write-Host "Clean complete" -ForegroundColor Green
}

# Step 2: Validate environment
Write-Host "Validating environment..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Please install Node.js 20+"
    exit 1
}
Write-Host "Node.js $(node --version) found" -ForegroundColor Green

# Step 3: Install dependencies
if (-not $SkipInstall) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed!"
        exit 1
    }
    Write-Host "Dependencies installed" -ForegroundColor Green
}

# Step 4: Sync version.txt with package.json
Write-Host "Syncing version files..." -ForegroundColor Yellow
$packageJson = Get-Content package.json | ConvertFrom-Json
$version = $packageJson.version
Set-Content -Path "updater/version.txt" -Value $version -NoNewline
Write-Host "Version synced: $version" -ForegroundColor Green

# Step 5: Build with electron-builder
Write-Host "Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}
Write-Host "Build complete" -ForegroundColor Green

# Step 6: Generate checksums
Write-Host "Generating checksums..." -ForegroundColor Yellow
$checksumFile = "$DIST_DIR/checksums.txt"
$checksums = @()

Get-ChildItem "$DIST_DIR/*.exe", "$DIST_DIR/*.zip" -ErrorAction SilentlyContinue | ForEach-Object {
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash
    $filename = $_.Name
    $checksums += "$hash  $filename"
}

if ($checksums.Count -gt 0) {
    $checksums | Out-File -FilePath $checksumFile -Encoding UTF8
    Write-Host "Checksums generated" -ForegroundColor Green
}

# Summary
Write-Host "`n=== Build Summary ===" -ForegroundColor Cyan
Write-Host "Version: $version"
Write-Host "Output: $((Get-Item $DIST_DIR).FullName)"

$artifacts = Get-ChildItem "$DIST_DIR/*.exe", "$DIST_DIR/*.zip" -ErrorAction SilentlyContinue
if ($artifacts.Count -gt 0) {
    Write-Host "Artifacts:"
    $artifacts | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  - $($_.Name): $sizeMB MB"
    }
} else {
    Write-Host "No artifacts found" -ForegroundColor Yellow
}

Write-Host "`nBuild completed successfully!" -ForegroundColor Green
