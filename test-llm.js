const https = require('https');

const testMessage = {
  type: 'chat',
  payload: {
    text: 'Hello, this is a test message'
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

console.log('Testing server with LLM...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('✅ SUCCESS: Server is responding!');
  } else {
    console.log('❌ FAILED: Server returned error');
  }

  res.on('data', (chunk) => {
    console.log('Response data:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(JSON.stringify(testMessage));
req.end();
