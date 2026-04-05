# start-demo.ps1
Write-Host "🌟 Launching DRAVIO Native Showcase Mode..." -ForegroundColor Cyan

# 1. Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js (v20+) to run the demo." -ForegroundColor Red
    exit
}

# 2. Buyer Web App
Write-Host "📦 Preparing Buyer Web App..." -ForegroundColor Yellow
Set-Location "apps/buyer-web"
if (!(Test-Path node_modules)) {
    npm install
}
Write-Host "🚀 Starting Premium Buyer Dashboard on http://localhost:3000" -ForegroundColor Green
Start-Process -FilePath "npm" -ArgumentList "run dev" -WindowStyle Normal

# 3. Admin Portal App
Write-Host "📦 Preparing Admin Portal..." -ForegroundColor Yellow
Set-Location "../../apps/admin-portal"
if (!(Test-Path node_modules)) {
    npm install
}
Write-Host "🚀 Starting Command Center (Admin Portal) on http://localhost:3001" -ForegroundColor Green
Start-Process -FilePath "npm" -ArgumentList "run dev -- -p 3001" -WindowStyle Normal

Set-Location "../../"

Write-Host "✅ Ecosystem Native Showcase has been launched in separate windows!" -ForegroundColor Green
Write-Host "💡 Note: This mode uses simulated data for a zero-config experience." -ForegroundColor Gray
