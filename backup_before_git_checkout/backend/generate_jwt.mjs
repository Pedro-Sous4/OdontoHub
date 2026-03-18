import jwt from 'jsonwebtoken';
const token = jwt.sign({ sub: 1, email: 'dev@local', role: 'admin' }, 'supersecret', { expiresIn: '1h' });
console.log(token);
