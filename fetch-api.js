process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function run() {
  try {
    const res = await fetch('https://api.dravio.com/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'test' })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}
run();
