(async () => {
  console.log('starting login test');
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pedro@odontohub.com', senha: 'senha123' }),
      signal: controller.signal
    });

    const text = await res.text();
    console.log('status', res.status);
    console.log('body', text);
  } catch (err) {
    console.error('error', err && err.message ? err.message : err);
  }
})();
