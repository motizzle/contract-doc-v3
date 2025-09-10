const https = require('https');

const testMessage = {
  type: 'chat',
  payload: {
    text: 'Hello, testing streaming response'
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

console.log('Testing streaming response...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('✅ SUCCESS: Server is responding with streaming!');
  } else {
    console.log('❌ FAILED: Server not responding properly');
  }
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(JSON.stringify(testMessage));
req.end();
