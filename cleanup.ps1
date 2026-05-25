# cleanup.ps1
# DRAVIO Workspace Storage & Cache Cleanup Utility

Clear-Host
Write-Host "==================================================" -ForegroundColor Green
Write-Host "       🧹 DRAVIO Storage & Cache Cleanup Utility" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# Get initial disk space
$drive = Get-PSDrive C
$initialFreeGB = [math]::Round($drive.Free / 1GB, 2)
Write-Host "📊 Current Available Storage on C: $initialFreeGB GB" -ForegroundColor White
Write-Host ""

# Ask developer what they want to clean
Write-Host "Please select what you would like to clean (Enter Y/N):" -ForegroundColor White
$cleanMetro = Read-Host "1. Clear Metro & Expo Caches? [Y/N]"
$cleanNode  = Read-Host "2. Re-install node_modules completely (Clean Install)? [Y/N]"
$cleanGradle = Read-Host "3. Clear local Gradle temporary caches? [Y/N]"
$cleanTemp   = Read-Host "4. Clean Windows Local Temp files? [Y/N]"
Write-Host ""

$reclaimed = 0

# Function to safely delete items and calculate size reclaimed
function Remove-And-Measure ($path) {
    if (Test-Path $path) {
        try {
            $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            if (!$size) { $size = 0 }
            Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "✅ Cleaned: $path (~$([math]::Round($size / 1MB, 2)) MB)" -ForegroundColor Gray
            return $size
        } catch {
            Write-Host "⚠️ Warning: Could not fully clean $path" -ForegroundColor Yellow
            return 0
        }
    }
    return 0
}

# 1. Metro / Expo Cache
if ($cleanMetro -eq 'Y' -or $cleanMetro -eq 'y') {
    Write-Host "🧹 Clearing Metro and Expo caches..." -ForegroundColor Yellow
    $reclaimed += Remove-And-Measure "apps/mobile-app/.expo"
    $reclaimed += Remove-And-Measure "apps/mobile-app/node_modules/.cache"
    
    # Metro temp folders on Windows
    $tempDir = [System.IO.Path]::GetTempPath()
    $reclaimed += Remove-And-Measure "$tempDir\metro-cache"
    $reclaimed += Remove-And-Measure "$tempDir\haste-map-*"
    Write-Host "✨ Metro and Expo caches cleared!" -ForegroundColor Green
    Write-Host ""
}

# 2. Node Modules complete clean
if ($cleanNode -eq 'Y' -or $cleanNode -eq 'y') {
    Write-Host "🧹 Deleting monorepo node_modules directories..." -ForegroundColor Yellow
    $reclaimed += Remove-And-Measure "node_modules"
    $reclaimed += Remove-And-Measure "apps/mobile-app/node_modules"
    $reclaimed += Remove-And-Measure "apps/admin-portal/node_modules"
    $reclaimed += Remove-And-Measure "apps/buyer-web/node_modules"
    
    Write-Host "🚀 Re-installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Clean install complete!" -ForegroundColor Green
    Write-Host ""
}

# 3. Gradle Cache clean
if ($cleanGradle -eq 'Y' -or $cleanGradle -eq 'y') {
    Write-Host "🧹 Cleaning Gradle temporary files..." -ForegroundColor Yellow
    $gradleHome = "$env:USERPROFILE\.gradle"
    if (Test-Path $gradleHome) {
        $reclaimed += Remove-And-Measure "$gradleHome\caches\transforms-3"
        $reclaimed += Remove-And-Measure "$gradleHome\caches\journal-1"
        $reclaimed += Remove-And-Measure "$gradleHome\daemon"
    }
    Write-Host "✨ Gradle temporary caches cleaned!" -ForegroundColor Green
    Write-Host ""
}

# 4. Windows Local Temp
if ($cleanTemp -eq 'Y' -or $cleanTemp -eq 'y') {
    Write-Host "🧹 Cleaning local user Temp directory..." -ForegroundColor Yellow
    $tempDir = [System.IO.Path]::GetTempPath()
    $tempFiles = Get-ChildItem $tempDir -ErrorAction SilentlyContinue
    foreach ($file in $tempFiles) {
        # Only clean older or non-locked files
        try {
            $size = (Get-Item $file.FullName -ErrorAction SilentlyContinue).Length
            Remove-Item $file.FullName -Recurse -Force -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -eq 0 -and $size) {
                $reclaimed += $size
            }
        } catch {}
    }
    Write-Host "✨ Windows User Temp files cleared!" -ForegroundColor Green
    Write-Host ""
}

# Wrap up report
$finalDrive = Get-PSDrive C
$finalFreeGB = [math]::Round($finalDrive.Free / 1GB, 2)
$diffGB = [math]::Round($reclaimed / 1GB, 3)

Write-Host "==================================================" -ForegroundColor Green
Write-Host "🎉 CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "💾 Approximate Reclaimed Space: $diffGB GB" -ForegroundColor White
Write-Host "📊 New Available Storage on C: $finalFreeGB GB" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
