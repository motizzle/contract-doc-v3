/* Reset Analytics Data - Clear MongoDB collection */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ No MONGODB_URI found in environment');
  console.log('Usage: MONGODB_URI="..." node scripts/reset-analytics.js');
  process.exit(1);
}

async function resetAnalytics() {
  let client;
  
  try {
    console.log('📊 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    
    await client.connect();
    console.log('✅ Connected');
    
    const db = client.db('wordftw_analytics');
    const collection = db.collection('page_visits');
    
    // Get current count
    const count = await collection.countDocuments();
    console.log(`📈 Current documents: ${count}`);
    
    if (count === 0) {
      console.log('✅ Analytics already empty');
      return;
    }
    
    // Delete all documents
    const result = await collection.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} documents`);
    console.log('✅ Analytics data reset complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('👋 Disconnected from MongoDB');
    }
  }
}

resetAnalytics();

