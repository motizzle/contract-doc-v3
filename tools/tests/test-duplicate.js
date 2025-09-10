const https = require('https');

// Test 1: Empty message (should be skipped)
console.log('🧪 Testing empty message handling...');
const emptyTest = {
  type: 'chat',
  payload: { text: '' },
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
    'Content-Length': Buffer.byteLength(JSON.stringify(emptyTest))
  },
  rejectUnauthorized: false
};

const req1 = https.request(options, (res) => {
  console.log(`✅ Empty message test: Status ${res.statusCode} (should be 200, but LLM should not be called)`);
});

req1.on('error', (e) => {
  console.error('❌ Empty message test error:', e.message);
});

req1.write(JSON.stringify(emptyTest));
req1.end();

// Test 2: Valid message (should trigger LLM)
setTimeout(() => {
  console.log('\n🧪 Testing valid message...');
  const validTest = {
    type: 'chat',
    payload: { text: 'Hello, this is a test message' },
    userId: 'test-user',
    platform: 'web'
  };

  const req2 = https.request(options, (res) => {
    console.log(`✅ Valid message test: Status ${res.statusCode}`);
  });

  req2.on('error', (e) => {
    console.error('❌ Valid message test error:', e.message);
  });

  req2.write(JSON.stringify(validTest));
  req2.end();
}, 1000);
