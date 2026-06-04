const jwt = require('jsonwebtoken');
const axios = require('axios');

const token = jwt.sign({ userId: 'dev', tenantId: 'd290f1ee-6c54-4b01-90e6-d701748f0851', role: 'admin' }, 'supersecret');

// We need a valid dentistId from the DB. We'll use the one from the logs.
const dentistId = '17fdda24-357c-4c6b-ac91-da5d79b5c515';

async function run() {
  try {
    const res = await axios.put(`http://agenda-service:3003/dentists/${dentistId}/schedules`, {
      schedules: [
        { dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00' }
      ]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success:', res.status, res.data);
  } catch (err) {
    console.log('Error:', err.response ? err.response.status : err.message);
    if (err.response) {
      console.log('Data:', err.response.data);
    }
  }
}
run();
