const https = require('https');

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/v1/refresh-document',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  rejectUnauthorized: false
};

console.log('Testing document refresh endpoint...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('Response:', result);
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
