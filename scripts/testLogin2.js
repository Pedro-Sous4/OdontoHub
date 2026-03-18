import http from 'http';

const data = JSON.stringify({ email: 'pedro@odontohub.com', senha: 'senha123' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log('got response', res.statusCode);
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
    console.log('received chunk', chunk.length);
  });
  res.on('end', () => {
    console.log('response end');
    console.log('status', res.statusCode);
    console.log('body', body);
  });
});

req.on('timeout', () => {
  console.error('timeout');
  req.destroy();
});
req.on('error', (err) => {
  console.error('error', err.message);
});
req.on('close', () => {
  console.log('request closed');
});

req.write(data);
req.end();
