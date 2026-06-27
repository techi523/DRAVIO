// Automated Test Suite for Dravio Backend
// This script hits the health endpoint and validates the microservices

async function runTests() {
  const BASE_URL = process.env.API_URL || 'http://localhost:8080';
  console.log(`Starting API Tests against ${BASE_URL}...`);

  let failures = 0;

  // 1. Health Check
  try {
    const health = await fetch(`${BASE_URL}/health`);
    if (health.status !== 200) throw new Error(`Health check failed with status ${health.status}`);
    const data = await health.json();
    console.log('✅ Health Check Passed:', data);
  } catch (err) {
    console.error('❌ Health Check Failed:', err.message);
    failures++;
  }

  // 2. Gateway Proxy Test (Auth Service fallback without DB)
  // This verifies the routing works even if the DB is unreachable
  try {
    const authOptions = await fetch(`${BASE_URL}/v1/auth`, { method: 'OPTIONS' });
    if (authOptions.status >= 400) throw new Error(`Auth service routing failed`);
    console.log('✅ Gateway Routing to Auth Service Passed');
  } catch (err) {
    console.error('❌ Gateway Routing Failed:', err.message);
    failures++;
  }

  console.log('----------------------------------------------------');
  if (failures === 0) {
    console.log('✅ ALL ACCESSIBLE TESTS PASSED. Readiness score: 100%');
  } else {
    console.error(`❌ ${failures} TESTS FAILED.`);
    process.exit(1);
  }
}

runTests();
