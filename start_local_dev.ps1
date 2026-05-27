# start_local_dev.ps1
# Starts all backend microservices locally with appropriate environment variables and ports

$env:JWT_SECRET = "dRaViO_pRoDuCtIoN_sEcReT_kEy_2026_xYz_9876543210_vPn_MaRkEtPlAcE"
$env:LOCAL_DEV = "true"
$env:DATABASE_URL = "postgres://dravio_user:secure_postgres_pass_2026_xyz@localhost:5432/dravio_production"
$env:KAFKA_BROKERS = "localhost:29092"
$env:REDIS_URL = "redis://localhost:6379"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 Booting DRAVIO Backend Services Locally..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Define services
$services = @(
    @{ name="Auth Service"; path="services/auth-service"; port="3000"; cmd="npx tsx src/index.ts" },
    @{ name="User Service"; path="services/user-service"; port="3002"; cmd="npx tsx src/index.ts" },
    @{ name="Marketplace";  path="services/marketplace-service"; port="3003"; cmd="npx tsx src/index.ts" },
    @{ name="Payment Service"; path="services/payment-service"; port="3004"; cmd="npx tsx src/index.ts" },
    @{ name="Session Go";   path="services/session-service"; port="3005"; cmd="go run cmd/main.go" },
    @{ name="Billing";      path="services/billing-service"; port="3006"; cmd="npx tsx src/index.ts" },
    @{ name="Admin Service"; path="services/admin-service"; port="3008"; cmd="npx tsx src/index.ts" },
    @{ name="Gateway REST";  path="services/gateway-service"; port="8080"; cmd="npx tsx src/index.ts" }
)

# Start each service in background process
foreach ($s in $services) {
    Write-Host "🏁 Starting $($s.name) on port $($s.port)..." -ForegroundColor Yellow
    $p = Start-Process powershell -ArgumentList "-NoExit -Command `$env:PORT='$($s.port)'; `$env:JWT_SECRET='$($env:JWT_SECRET)'; `$env:LOCAL_DEV='true'; `$env:DATABASE_URL='$($env:DATABASE_URL)'; `$env:KAFKA_BROKERS='$($env:KAFKA_BROKERS)'; `$env:REDIS_URL='$($env:REDIS_URL)'; cd $($s.path); $($s.cmd)" -PassThru -WindowStyle Minimized
    Write-Host "✅ $($s.name) running under Process ID $($p.Id)." -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 DRAVIO microservices launched locally in background processes successfully!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
