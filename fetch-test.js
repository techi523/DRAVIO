async function run() {
  try {
    const res = await fetch('https://api.dravio.com/health');
    console.log(res.status, await res.text());
  } catch (e) {
    console.error('Fetch error:', e);
  }
}
run();
