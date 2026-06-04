const http = require('http');

const data = JSON.stringify({
  nome: 'Teste',
  especialidade: 'Teste',
  cor_agenda: '#ffffff'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/settings/dentists/17fdda24-357c-4c6b-ac91-da5d79b5c515',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
