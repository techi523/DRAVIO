# adb-wifi.ps1
# Dravio Mobile App ADB over WiFi Helper

Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       📲 DRAVIO ADB over Wi-Fi Configurator" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check for ADB
if (!(Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: 'adb' command not found in your PATH." -ForegroundColor Red
    Write-Host "Please ensure C:\Android\platform-tools is in your PATH and try again." -ForegroundColor Yellow
    exit
}

# 2. Check connected devices
Write-Host "🔍 Scanning for USB-connected Android devices..." -ForegroundColor Yellow
$devices = adb devices | Select-String -Pattern "\bdevice\b"

if ($devices.Count -eq 0) {
    Write-Host "❌ No USB-connected devices found." -ForegroundColor Red
    Write-Host "💡 To configure ADB wireless debugging:" -ForegroundColor Gray
    Write-Host "   1. Connect your Android phone to this PC via USB." -ForegroundColor Gray
    Write-Host "   2. Ensure Developer Options and USB Debugging are enabled on the phone." -ForegroundColor Gray
    Write-Host "   3. Accept the 'Allow USB Debugging' prompt on the device screen." -ForegroundColor Gray
    Write-Host ""
    exit
}

$deviceCount = $devices.Count
Write-Host "✅ Found $deviceCount active USB-connected device(s)!" -ForegroundColor Green
Write-Host ""

# 3. Restart ADB in TCPIP mode
$port = "5555"
Write-Host "🚀 Restarting ADB on port $port in TCP/IP mode..." -ForegroundColor Yellow
$tcpipResult = adb tcpip $port 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to restart ADB in TCP/IP mode." -ForegroundColor Red
    Write-Host $tcpipResult -ForegroundColor DarkGray
    exit
}
Write-Host "✅ ADB is now listening on port $port!" -ForegroundColor Green
Write-Host ""

Write-Host "🔌 You can now safely UNPLUG the USB cable from your phone." -ForegroundColor Yellow
Write-Host ""

# 4. Prompt for IP Address
Write-Host "📍 Find your phone's IP address on the same local Wi-Fi network:" -ForegroundColor White
Write-Host "   Go to: Settings -> About Phone -> Status -> IP Address" -ForegroundColor Gray
Write-Host "   (Expected format: 192.168.x.x)" -ForegroundColor Gray
Write-Host ""

$ip = Read-Host "Enter your phone's local IP address"

if ([string]::IsNullOrWhiteSpace($ip)) {
    Write-Host "❌ Cancelled: No IP address provided." -ForegroundColor Red
    exit
}

# Clean the IP input (remove spaces, etc.)
$ip = $ip.Trim()

Write-Host ""
Write-Host "⚡ Connecting to $ip:$port..." -ForegroundColor Yellow
$connectResult = adb connect "$ip:$port"

if ($connectResult -like "*connected to*") {
    Write-Host "🎉 SUCCESS: Connected to $ip over Wi-Fi!" -ForegroundColor Green
    Write-Host "🚀 You can now run 'npm run start' and test DRAVIO cord-free!" -ForegroundColor Green
} else {
    Write-Host "❌ Connection failed." -ForegroundColor Red
    Write-Host "📝 Details: $connectResult" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "   - Verify that your PC and phone are on the exact same Wi-Fi SSID." -ForegroundColor Gray
    Write-Host "   - Ensure isolation/guest mode is disabled on your Wi-Fi router." -ForegroundColor Gray
    Write-Host "   - Check Windows Defender Firewall (run 'setup-firewall.ps1' as Admin)." -ForegroundColor Gray
}
Write-Host ""
