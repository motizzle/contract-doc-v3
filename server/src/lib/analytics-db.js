/* Analytics Database Module - MongoDB with JSON fallback */
const fs = require('fs');
const path = require('path');

// MongoDB client (lazy-loaded)
let MongoClient;
let mongoClient = null;
let analyticsCollection = null;
let isMongoConnected = false;

// Fallback JSON storage
let jsonData = { totalVisits: 0, pages: {} };
let jsonFilePath = null;

// Connection status
let useDatabase = false;

/**
 * Initialize analytics storage (MongoDB or JSON fallback)
 * @param {string} mongoUri - MongoDB connection string (optional)
 * @param {string} dataAppDir - Path to data/app directory (for JSON fallback)
 */
async function initialize(mongoUri, dataAppDir) {
  jsonFilePath = path.join(dataAppDir, 'analytics.json');
  
  // Try MongoDB if connection string provided
  if (mongoUri) {
    try {
      console.log('📊 Connecting to MongoDB for analytics...');
      
      // Lazy-load MongoDB driver
      const mongodb = require('mongodb');
      MongoClient = mongodb.MongoClient;
      
      // Connect to MongoDB
      mongoClient = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        connectTimeoutMS: 5000,
      });
      
      await mongoClient.connect();
      
      // Get database and collection
      const db = mongoClient.db('wordftw_analytics');
      analyticsCollection = db.collection('page_visits');
      
      // Create index on page path for faster queries
      await analyticsCollection.createIndex({ page: 1 });
      
      isMongoConnected = true;
      useDatabase = true;
      
      console.log('✅ MongoDB connected for analytics');
      
      // Migrate existing JSON data if it exists
      await migrateFromJson();
      
    } catch (error) {
      console.warn('⚠️  MongoDB connection failed, falling back to JSON file:', error.message);
      useDatabase = false;
      loadJsonFallback();
    }
  } else {
    console.log('📊 No MongoDB URI provided, using JSON file for analytics');
    loadJsonFallback();
  }
}

/**
 * Load JSON file data
 */
function loadJsonFallback() {
  try {
    if (fs.existsSync(jsonFilePath)) {
      jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      console.log('✅ Loaded analytics from JSON file');
    }
  } catch (e) {
    console.warn('⚠️  Could not load analytics JSON, starting fresh:', e.message);
    jsonData = { totalVisits: 0, pages: {} };
  }
}

/**
 * Migrate data from JSON to MongoDB (one-time)
 */
async function migrateFromJson() {
  if (!fs.existsSync(jsonFilePath)) return;
  
  try {
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    if (data.totalVisits > 0 || Object.keys(data.pages).length > 0) {
      console.log('📦 Migrating existing analytics data to MongoDB...');
      
      // Upsert each page's visit count
      for (const [page, count] of Object.entries(data.pages)) {
        await analyticsCollection.updateOne(
          { page },
          { $set: { count, lastVisit: new Date() } },
          { upsert: true }
        );
      }
      
      console.log(`✅ Migrated ${Object.keys(data.pages).length} pages to MongoDB`);
    }
  } catch (e) {
    console.warn('⚠️  Migration from JSON failed:', e.message);
  }
}

/**
 * Save JSON data to file (fallback mode)
 */
function saveJsonFallback() {
  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
  } catch (e) {
    console.error('❌ Failed to save analytics JSON:', e.message);
  }
}

/**
 * Track a page visit
 * @param {string} page - Page path (e.g., '/', '/view')
 */
async function trackVisit(page) {
  if (useDatabase && isMongoConnected) {
    try {
      // Increment page visit count in MongoDB
      await analyticsCollection.updateOne(
        { page },
        { 
          $inc: { count: 1 },
          $set: { lastVisit: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('❌ MongoDB track visit error:', error.message);
      // Fall back to JSON for this request
      trackVisitJson(page);
    }
  } else {
    trackVisitJson(page);
  }
}

/**
 * Track visit in JSON (fallback)
 */
function trackVisitJson(page) {
  jsonData.totalVisits = (jsonData.totalVisits || 0) + 1;
  
  if (!jsonData.pages[page]) {
    jsonData.pages[page] = 0;
  }
  jsonData.pages[page]++;
  
  // Save asynchronously
  setImmediate(() => saveJsonFallback());
}

/**
 * Get analytics stats
 * @returns {Promise<{totalVisits: number, pages: Object}>}
 */
async function getStats() {
  if (useDatabase && isMongoConnected) {
    try {
      // Get all page visit counts from MongoDB
      const pages = await analyticsCollection.find({}).toArray();
      
      const stats = {
        totalVisits: 0,
        pages: {}
      };
      
      for (const page of pages) {
        stats.pages[page.page] = page.count;
        stats.totalVisits += page.count;
      }
      
      return stats;
    } catch (error) {
      console.error('❌ MongoDB get stats error:', error.message);
      return getStatsJson();
    }
  } else {
    return getStatsJson();
  }
}

/**
 * Get stats from JSON (fallback)
 */
function getStatsJson() {
  return {
    totalVisits: jsonData.totalVisits || 0,
    pages: jsonData.pages || {}
  };
}

/**
 * Close database connection (for graceful shutdown)
 */
async function close() {
  if (mongoClient) {
    try {
      await mongoClient.close();
      console.log('✅ MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing MongoDB:', error.message);
    }
  }
}

/**
 * Check if using database
 */
function isUsingDatabase() {
  return useDatabase && isMongoConnected;
}

module.exports = {
  initialize,
  trackVisit,
  getStats,
  close,
  isUsingDatabase
};

