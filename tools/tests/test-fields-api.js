/**
 * Phase 1 Fields API Test Suite
 * 
 * Run this script to test all Phase 1 field endpoints
 * 
 * Usage:
 *   node tools/tests/test-fields-api.js
 * 
 * Prerequisites:
 *   - Server must be running on https://localhost:4001
 *   - Set NODE_TLS_REJECT_UNAUTHORIZED=0 for self-signed cert
 */

const https = require('https');

// Allow self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'https://localhost:4001';
let testsPassed = 0;
let testsFailed = 0;

// Helper function to make requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      rejectUnauthorized: false
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test helper
function test(name, fn) {
  return fn()
    .then(() => {
      console.log(`✅ ${name}`);
      testsPassed++;
    })
    .catch((err) => {
      console.error(`❌ ${name}`);
      console.error(`   Error: ${err.message || err}`);
      testsFailed++;
    });
}

// Main test suite
async function runTests() {
  console.log('🧪 Starting Phase 1 Fields API Test Suite\n');
  console.log('=' .repeat(60));

  // Test 1: Health check
  await test('Server is running', async () => {
    const { status } = await request('GET', '/api/health');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
  });

  // Test 2: Get all fields (should be empty initially)
  await test('GET /api/v1/fields - returns empty object initially', async () => {
    const { status, data } = await request('GET', '/api/v1/fields');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.fields) throw new Error('Missing fields property');
  });

  // Test 3: Create a field
  const testField = {
    fieldId: 'test-field-001',
    displayLabel: 'Test Field One',
    fieldType: 'TEXTINPUT',
    fieldColor: '#980043',
    type: 'text',
    category: 'Test Category',
    defaultValue: '',
    userId: 'test-user'
  };

  await test('POST /api/v1/fields - creates a new field', async () => {
    const { status, data } = await request('POST', '/api/v1/fields', testField);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.ok) throw new Error('Response not ok');
    if (!data.field) throw new Error('Missing field in response');
    if (data.field.fieldId !== testField.fieldId) throw new Error('Field ID mismatch');
    if (!data.field.createdAt) throw new Error('Missing createdAt timestamp');
  });

  // Test 4: Get all fields (should have our field now)
  await test('GET /api/v1/fields - returns created field', async () => {
    const { status, data } = await request('GET', '/api/v1/fields');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.fields[testField.fieldId]) throw new Error('Created field not found');
    const field = data.fields[testField.fieldId];
    if (field.displayLabel !== testField.displayLabel) throw new Error('Display label mismatch');
  });

  // Test 5: Update the field
  await test('PUT /api/v1/fields/:fieldId - updates field', async () => {
    const updates = {
      displayLabel: 'Updated Test Field',
      category: 'Updated Category',
      userId: 'test-user'
    };
    const { status, data } = await request('PUT', `/api/v1/fields/${testField.fieldId}`, updates);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.ok) throw new Error('Response not ok');
    if (data.field.displayLabel !== updates.displayLabel) throw new Error('Update not applied');
    if (!data.field.updatedAt) throw new Error('Missing updatedAt timestamp');
  });

  // Test 6: Create duplicate field (should fail)
  await test('POST /api/v1/fields - rejects duplicate fieldId', async () => {
    const { status, data } = await request('POST', '/api/v1/fields', testField);
    if (status !== 409) throw new Error(`Expected 409 Conflict, got ${status}`);
    if (!data.error) throw new Error('Missing error message');
  });

  // Test 7: Create field with missing required fields (should fail)
  await test('POST /api/v1/fields - rejects missing required fields', async () => {
    const { status, data } = await request('POST', '/api/v1/fields', { fieldId: 'test' });
    if (status !== 400) throw new Error(`Expected 400 Bad Request, got ${status}`);
    if (!data.error) throw new Error('Missing error message');
  });

  // Test 8: Update non-existent field (should fail)
  await test('PUT /api/v1/fields/:fieldId - rejects non-existent field', async () => {
    const { status, data } = await request('PUT', '/api/v1/fields/does-not-exist', {
      displayLabel: 'New Name',
      userId: 'test-user'
    });
    if (status !== 404) throw new Error(`Expected 404 Not Found, got ${status}`);
  });

  // Test 9: Delete non-existent field (should fail)
  await test('DELETE /api/v1/fields/:fieldId - rejects non-existent field', async () => {
    const { status } = await request('DELETE', '/api/v1/fields/does-not-exist?userId=test-user');
    if (status !== 404) throw new Error(`Expected 404 Not Found, got ${status}`);
  });

  // Test 10: Create multiple fields
  await test('POST /api/v1/fields - creates multiple fields', async () => {
    const field2 = { ...testField, fieldId: 'test-field-002', displayLabel: 'Test Field Two' };
    const field3 = { ...testField, fieldId: 'test-field-003', displayLabel: 'Test Field Three' };
    
    const res2 = await request('POST', '/api/v1/fields', field2);
    const res3 = await request('POST', '/api/v1/fields', field3);
    
    if (res2.status !== 200 || res3.status !== 200) {
      throw new Error('Failed to create multiple fields');
    }
  });

  // Test 11: Verify all fields exist
  await test('GET /api/v1/fields - returns all created fields', async () => {
    const { status, data } = await request('GET', '/api/v1/fields');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    const fieldCount = Object.keys(data.fields).length;
    if (fieldCount < 3) throw new Error(`Expected at least 3 fields, got ${fieldCount}`);
  });

  // Test 12: Delete a field
  await test('DELETE /api/v1/fields/:fieldId - deletes field', async () => {
    const { status, data } = await request('DELETE', `/api/v1/fields/${testField.fieldId}?userId=test-user`);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.ok) throw new Error('Response not ok');
    if (data.fieldId !== testField.fieldId) throw new Error('Field ID mismatch');
  });

  // Test 13: Verify field was deleted
  await test('GET /api/v1/fields - deleted field is removed', async () => {
    const { status, data } = await request('GET', '/api/v1/fields');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data.fields[testField.fieldId]) throw new Error('Field was not deleted');
  });

  // Test 14: Check activity log
  await test('GET /api/v1/activity - contains field activities', async () => {
    const { status, data } = await request('GET', '/api/v1/activity');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!Array.isArray(data.activities)) throw new Error('Activities is not an array');
    
    const fieldActivities = data.activities.filter(a => a.target === 'field');
    if (fieldActivities.length === 0) {
      throw new Error('No field activities found in log');
    }
    
    console.log(`   Found ${fieldActivities.length} field activities in log`);
  });

  // Test 15: Cleanup - delete remaining test fields
  await test('Cleanup - delete remaining test fields', async () => {
    await request('DELETE', '/api/v1/fields/test-field-002?userId=test-user');
    await request('DELETE', '/api/v1/fields/test-field-003?userId=test-user');
    
    const { data } = await request('GET', '/api/v1/fields');
    const remainingTestFields = Object.keys(data.fields).filter(id => id.startsWith('test-field'));
    if (remainingTestFields.length > 0) {
      throw new Error(`${remainingTestFields.length} test fields still remaining`);
    }
  });

  // Results
  console.log('=' .repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Total:  ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log(`\n🎉 All tests passed! Phase 1 backend is working correctly.\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed. Please review the errors above.\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error('💥 Test suite crashed:', err);
  process.exit(1);
});

