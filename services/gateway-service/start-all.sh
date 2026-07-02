#!/bin/sh
# ─────────────────────────────────────────────────────────────────────
# DRAVIO Platform — Railway/Production Startup Script
# Launches all microservices concurrently in a single container.
# The gateway is last to start (it routes to the others).
# Railway injects PORT dynamically — the gateway binds to ${PORT:-8080}.
# ─────────────────────────────────────────────────────────────────────
set -e

echo "🚀 Starting DRAVIO Platform..."

# Export shared environment variables for child processes
export NODE_ENV=production

# ── Auth Service (port 3000) ──────────────────────────────────────────
echo "[1/6] Starting Auth Service on port 3000..."
AUTH_SERVICE_URL=http://localhost:3000 \
USER_SERVICE_URL=http://localhost:3002 \
PORT=3000 \
  node /app/services/auth-service/dist/index.js &
AUTH_PID=$!

# ── User Service (port 3002) ──────────────────────────────────────────
echo "[2/6] Starting User Service on port 3002..."
PORT=3002 \
  node /app/services/user-service/dist/index.js &
USER_PID=$!

# ── Marketplace Service (port 3003) ───────────────────────────────────
echo "[3/8] Starting Marketplace Service on port 3003..."
PORT=3003 \
  node /app/services/marketplace-service/dist/index.js &
MARKETPLACE_PID=$!

# ── Billing Service (port 3006) ───────────────────────────────────────
echo "[4/8] Starting Billing Service on port 3006..."
PAYMENT_SERVICE_URL=http://localhost:3005 \
SESSION_SERVICE_URL=http://localhost:3015 \
PORT=3006 \
  node /app/services/billing-service/dist/index.js &
BILLING_PID=$!

# ── Payment Service (port 3005) ───────────────────────────────────────
echo "[5/8] Starting Payment Service on port 3005..."
PORT=3005 \
  node /app/services/payment-service/dist/index.js &
PAYMENT_PID=$!

# ── Session Service (port 3015) ───────────────────────────────────────
echo "[6/8] Starting Session Service on port 3015..."
PORT=3015 \
  /app/session-service &
SESSION_PID=$!

# ── Admin Service (port 3008) ─────────────────────────────────────────
echo "[7/8] Starting Admin Service on port 3008..."
PORT=3008 \
  node /app/services/admin-service/dist/index.js &
ADMIN_PID=$!

# ── Wait for services to initialize ──────────────────────────────────
echo "⏳ Waiting for services to initialize (3s)..."
sleep 3

# ── Gateway Service (Render-injected PORT) ────────────────────────────
echo "[8/8] Starting Gateway Service on port ${PORT:-8080}..."
AUTH_SERVICE_URL=http://localhost:3000 \
USER_SERVICE_URL=http://localhost:3002 \
MARKETPLACE_SERVICE_URL=http://localhost:3003 \
BILLING_SERVICE_URL=http://localhost:3006 \
PAYMENT_SERVICE_URL=http://localhost:3005 \
SESSION_SERVICE_URL=http://localhost:3015 \
  node /app/services/gateway-service/dist/index.js

echo "✅ All DRAVIO services started."

# If gateway exits, kill all child processes
trap "kill $AUTH_PID $USER_PID $MARKETPLACE_PID $BILLING_PID $PAYMENT_PID $SESSION_PID $ADMIN_PID 2>/dev/null; exit" TERM INT EXIT
wait
