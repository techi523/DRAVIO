# start-dev.ps1
# DRAVIO Mobile Dev Console

do {
    Clear-Host
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "         🚀 DRAVIO MOBILE DEV PLATFORM" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "  Select a task to spin up or configure your env:" -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] Start Metro - LAN Mode (Fastest, default SSID)" -ForegroundColor Green
    Write-Host "  [2] Start Metro - Tunnel Mode (For VPN / Active WireGuard)" -ForegroundColor Green
    Write-Host "  [3] Start Metro - Offline Mode (Zero internet load)" -ForegroundColor Green
    Write-Host "  [4] Run ADB over Wi-Fi Configurator (Cordless)" -ForegroundColor Yellow
    Write-Host "  [5] Run Expo Doctor Diagnostics" -ForegroundColor Yellow
    Write-Host "  [6] Apply Windows Firewall Rules (Requires Admin)" -ForegroundColor DarkYellow
    Write-Host "  [7] Launch Android Emulator (Pixel 35)" -ForegroundColor Green
    Write-Host "  [8] Exit" -ForegroundColor Red
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""

    $choice = Read-Host "Select an option [1-8]"
    Write-Host ""

    switch ($choice) {
        "1" {
            Write-Host "🚀 Launching Metro in LAN mode..." -ForegroundColor Green
            npm run start:lan
            break
        }
        "2" {
            Write-Host "🚀 Launching Metro in Tunnel mode (ngrok)..." -ForegroundColor Green
            npm run start:tunnel
            break
        }
        "3" {
            Write-Host "🚀 Launching Metro in Offline mode..." -ForegroundColor Green
            npm run start:offline
            break
        }
        "4" {
            if (Test-Path "adb-wifi.ps1") {
                .\adb-wifi.ps1
            } else {
                Write-Host "❌ Error: adb-wifi.ps1 script not found!" -ForegroundColor Red
            }
            Write-Host "Press any key to return to menu..." -ForegroundColor Gray
            $null = [Console]::ReadKey($true)
            break
        }
        "5" {
            Write-Host "🩺 Running Expo Doctor..." -ForegroundColor Yellow
            npm run doctor
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Gray
            $null = [Console]::ReadKey($true)
            break
        }
        "6" {
            Write-Host "🛡️ Invoking Windows Firewall Rules..." -ForegroundColor Yellow
            if (Test-Path "C:\Android\setup-firewall.ps1") {
                # Attempt to run script
                Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-File C:\Android\setup-firewall.ps1" -Verb RunAs
                Write-Host "✅ Firewall setup spawned in an Administrator PowerShell window!" -ForegroundColor Green
            } else {
                Write-Host "❌ Error: C:\Android\setup-firewall.ps1 not found!" -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Gray
            $null = [Console]::ReadKey($true)
            break
        }
        "7" {
            Write-Host "📱 Booting Android Emulator (Pixel_35)..." -ForegroundColor Green
            if (Test-Path "C:\Android\emulator\emulator.exe") {
                Start-Process "C:\Android\emulator\emulator.exe" -ArgumentList "-avd Pixel_35 -no-snapshot-load" -WindowStyle Normal
                Write-Host "✅ Emulator boot process started in the background!" -ForegroundColor Green
            } else {
                Write-Host "❌ Error: Emulator engine not found! Please ensure Phase 4 setup is complete." -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Gray
            $null = [Console]::ReadKey($true)
            break
        }
        "8" {
            Write-Host "👋 Happy coding! Exiting..." -ForegroundColor Cyan
            exit
        }
        default {
            Write-Host "⚠️ Invalid option. Try again." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
} while ($true)
