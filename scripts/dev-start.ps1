# ============================================================
# DRAVIO — Expo Dev Startup Script
# Usage:
#   .\scripts\dev-start.ps1           -> LAN mode (fast, same WiFi)
#   .\scripts\dev-start.ps1 -Tunnel   -> Tunnel mode (VPN/remote)
#   .\scripts\dev-start.ps1 -Clean    -> Clear all caches first
# ============================================================
param(
    [switch]$Tunnel,
    [switch]$Clean,
    [switch]$Offline
)

$ProjectRoot = $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DRAVIO — Expo Development Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Clean caches if requested
if ($Clean) {
    Write-Host ">> Cleaning caches..." -ForegroundColor Yellow
    if (Test-Path "$ProjectRoot\.expo") {
        Remove-Item -Recurse -Force "$ProjectRoot\.expo"
        Write-Host "   .expo/ cleared" -ForegroundColor Green
    }
    if (Test-Path "$ProjectRoot\node_modules\.cache") {
        Remove-Item -Recurse -Force "$ProjectRoot\node_modules\.cache"
        Write-Host "   node_modules/.cache cleared" -ForegroundColor Green
    }
    Write-Host ""
}

# Check ADB devices
Write-Host ">> Checking connected Android devices..." -ForegroundColor Yellow
$adbPath = "$env:ANDROID_HOME\platform-tools\adb.exe"
if (Test-Path $adbPath) {
    $devices = & $adbPath devices 2>&1
    Write-Host $devices -ForegroundColor Gray
} else {
    Write-Host "   ADB not found in ANDROID_HOME. Ensure platform-tools is installed." -ForegroundColor DarkYellow
}
Write-Host ""

# Start Expo
Write-Host ">> Starting Expo Metro Bundler..." -ForegroundColor Yellow

Set-Location $ProjectRoot

if ($Tunnel) {
    Write-Host "   Mode: TUNNEL (works over VPN/mobile data)" -ForegroundColor Magenta
    Write-Host ""
    npx expo start --tunnel --clear
} elseif ($Offline) {
    Write-Host "   Mode: OFFLINE" -ForegroundColor DarkGray
    Write-Host ""
    npx expo start --offline
} else {
    Write-Host "   Mode: LAN (same WiFi network)" -ForegroundColor Green
    Write-Host "   TIP: Use -Tunnel flag if device and PC are on different networks" -ForegroundColor DarkGray
    Write-Host ""
    npx expo start --lan --clear
}
