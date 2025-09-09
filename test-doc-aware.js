const https = require('https');

const testMessage = {
  type: 'chat',
  payload: {
    text: 'What is the main objective of the OpenGov MVP contract?'
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

console.log('Testing document-aware LLM with specific question...');
console.log('Question:', testMessage.payload.text);

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log('API Response received');
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(JSON.stringify(testMessage));
req.end();

console.log('Chat message sent. Check server logs for LLM response details.');
