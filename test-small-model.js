const https = require('https');

const testMessage = {
  type: 'chat',
  payload: {
    text: 'Hello from smaller model test'
  },
  userId: 'test-user',
  platform: 'web'
};

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/v1/events/client',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(testMessage))
  },
  rejectUnauthorized: false
};

console.log('Testing smaller Gemma 3 1B model...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log('Response received');
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(JSON.stringify(testMessage));
req.end();
