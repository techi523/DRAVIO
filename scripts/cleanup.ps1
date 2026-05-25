# ============================================================
# DRAVIO — Full Cache Cleanup Script
# Frees up disk space by removing caches and temp files
# Usage: .\scripts\cleanup.ps1
# ============================================================

$ProjectRoot = $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "============================================" -ForegroundColor Red
Write-Host "  DRAVIO — Cache Cleanup" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Red
Write-Host ""

$totalFreed = 0

function Remove-Dir($path, $label) {
    if (Test-Path $path) {
        $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 1)
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "  [REMOVED] $label ($sizeMB MB)" -ForegroundColor Green
        return $sizeMB
    } else {
        Write-Host "  [SKIP]    $label (not found)" -ForegroundColor DarkGray
        return 0
    }
}

# Project caches
$totalFreed += Remove-Dir "$ProjectRoot\.expo" ".expo cache"
$totalFreed += Remove-Dir "$ProjectRoot\node_modules\.cache" "Metro bundler cache"
$totalFreed += Remove-Dir "$ProjectRoot\.metro-cache" "Metro cache (root)"

# Temp Expo cache
$expoCache = "$env:LOCALAPPDATA\Expo"
$totalFreed += Remove-Dir $expoCache "Expo local app cache"

# npm cache (optional — careful)
Write-Host ""
Write-Host "  To also clean the global npm cache, run:" -ForegroundColor DarkYellow
Write-Host "    npm cache clean --force" -ForegroundColor DarkYellow
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "  Total freed: ~$totalFreed MB" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Show current disk space
$drive = Get-PSDrive C
$freeGB = [math]::Round($drive.Free / 1GB, 2)
Write-Host "  C:\ Free space now: $freeGB GB" -ForegroundColor Cyan
Write-Host ""
