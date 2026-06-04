const http = require('http');
const jwt = require('jsonwebtoken');

// Generate token
const token = jwt.sign({ userId: 'd45b73d8-a15f-4ec1-ac7f-8561eb1bb3c3', tenantId: 'e28bbd16-654b-4fc6-bb77-eb5559f977fc' }, 'supersecret');

const postData = JSON.stringify({
  responsavel_nome: 'Pedro Teste',
  responsavel_cpf: '12345678901',
  data_nascimento: '1990-01-01',
  signature_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/whatsapp/terms',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
