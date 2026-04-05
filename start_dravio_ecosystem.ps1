# start_dravio_ecosystem.ps1
Write-Host "🚀 Launching DRAVIO Ecosystem..." -ForegroundColor Cyan

# 1. Start Docker Services
Write-Host "🐳 Starting Backend Services (Docker)..." -ForegroundColor Yellow
docker-compose up -d --build

# 2. Wait for services to be healthy
Write-Host "⏳ Waiting for core services (Postgres, Redis, Kafka) to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 3. Access Information
Write-Host "✅ System is coming online!" -ForegroundColor Green
Write-Host "🌐 Access Points:" -ForegroundColor White
Write-Host "   - Buyer Web Portal:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "   - Admin Portal:       http://localhost:3001" -ForegroundColor Cyan
Write-Host "   - API Gateway (ISP): http://localhost:8080" -ForegroundColor Cyan
Write-Host "   - Mobile App Bundler: http://localhost:8081 (Run 'npm run start' in apps/mobile-app)" -ForegroundColor Cyan
