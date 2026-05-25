# ============================================================
# DRAVIO — ADB Device Manager Script
# Manage physical Android devices over USB and WiFi
# Usage:
#   .\scripts\adb-connect.ps1           -> list devices
#   .\scripts\adb-connect.ps1 -WiFi     -> connect wirelessly
#   .\scripts\adb-connect.ps1 -IP 192.168.1.x -> connect to specific IP
# ============================================================
param(
    [switch]$WiFi,
    [string]$IP = "",
    [switch]$Disconnect
)

$ADB = "$env:ANDROID_HOME\platform-tools\adb.exe"

if (-not (Test-Path $ADB)) {
    Write-Host "[ERROR] ADB not found at: $ADB" -ForegroundColor Red
    Write-Host "        Ensure ANDROID_HOME is set correctly." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DRAVIO — ADB Device Manager" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($Disconnect) {
    Write-Host ">> Disconnecting all wireless devices..." -ForegroundColor Yellow
    & $ADB disconnect
    Write-Host ""
}

if ($WiFi -and $IP -ne "") {
    # Connect to specific device IP over WiFi
    Write-Host ">> Connecting to $IP over WiFi (port 5555)..." -ForegroundColor Yellow
    & $ADB connect "${IP}:5555"
    Write-Host ""
} elseif ($WiFi) {
    # Enable TCP/IP mode on USB-connected device, then switch to WiFi
    Write-Host ">> Enabling ADB over WiFi on connected USB device..." -ForegroundColor Yellow
    Write-Host "   Step 1: Switching device to TCP/IP mode on port 5555" -ForegroundColor Gray
    & $ADB tcpip 5555
    Start-Sleep -Seconds 2

    Write-Host "   Step 2: Getting device IP address..." -ForegroundColor Gray
    $deviceIP = & $ADB shell ip route 2>&1 | Select-String "src" | ForEach-Object {
        ($_ -split "src ")[1].Trim() -split " " | Select-Object -First 1
    }

    if ($deviceIP) {
        Write-Host "   Device IP detected: $deviceIP" -ForegroundColor Green
        Write-Host "   Step 3: Connecting wirelessly..." -ForegroundColor Gray
        & $ADB connect "${deviceIP}:5555"
        Write-Host ""
        Write-Host "   You can now DISCONNECT the USB cable!" -ForegroundColor Green
    } else {
        Write-Host "   Could not auto-detect IP. Run with: -WiFi -IP <device-ip>" -ForegroundColor Yellow
        Write-Host "   Find device IP: Settings > About Phone > Status > IP Address" -ForegroundColor DarkGray
    }
    Write-Host ""
}

# Always show connected devices
Write-Host ">> Connected Android Devices:" -ForegroundColor Yellow
& $ADB devices -l
Write-Host ""

Write-Host "============================================" -ForegroundColor DarkGray
Write-Host "  Tips:" -ForegroundColor DarkGray
Write-Host "  - Enable Developer Options: tap Build Number 7 times" -ForegroundColor DarkGray
Write-Host "  - Enable USB Debugging in Developer Options" -ForegroundColor DarkGray
Write-Host "  - For wireless: enable 'Wireless Debugging' (Android 11+)" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor DarkGray
Write-Host ""
