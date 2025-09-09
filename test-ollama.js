const https = require('https');

// Test script to verify Ollama integration
const testMessage = {
  type: 'client',
  payload: {
    text: 'Hello, this is a test message from our API',
    userId: 'test-user',
    platform: 'test'
  }
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
  rejectUnauthorized: false // Allow self-signed certificates
};

console.log('Testing Ollama integration...');
console.log('Sending test message to backend server...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });

  res.on('end', () => {
    console.log('Test completed.');
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(JSON.stringify(testMessage));
req.end();
