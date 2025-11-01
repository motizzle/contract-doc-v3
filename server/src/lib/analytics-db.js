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
 * Track a page visit with rich analytics data
 * @param {Object} visitData - Visit information
 * @param {string} visitData.page - Page path
 * @param {string} visitData.sessionId - Unique session identifier
 * @param {string} visitData.ip - IP address
 * @param {Object} visitData.location - Geo data {country, city, region}
 * @param {string} visitData.userAgent - Browser user agent
 * @param {string} visitData.referrer - Referrer URL
 * @param {Object} visitData.device - Device info {type, browser, os}
 */
async function trackVisit(visitData) {
  if (useDatabase && isMongoConnected) {
    try {
      const now = new Date();
      
      // 1. Track page visit counts (summary)
      await analyticsCollection.updateOne(
        { page: visitData.page },
        { 
          $inc: { count: 1 },
          $set: { lastVisit: now }
        },
        { upsert: true }
      );
      
      // 2. Track individual visit event (detailed)
      const eventsCollection = mongoClient.db('wordftw_analytics').collection('visit_events');
      await eventsCollection.insertOne({
        page: visitData.page,
        sessionId: visitData.sessionId,
        ip: visitData.ip,
        location: visitData.location || {},
        userAgent: visitData.userAgent,
        referrer: visitData.referrer,
        device: visitData.device || {},
        timestamp: now
      });
      
      // 3. Track session info
      const sessionsCollection = mongoClient.db('wordftw_analytics').collection('sessions');
      await sessionsCollection.updateOne(
        { sessionId: visitData.sessionId },
        {
          $set: {
            lastSeen: now,
            lastPage: visitData.page,
            location: visitData.location || {},
            device: visitData.device || {},
            ip: visitData.ip
          },
          $inc: { pageViews: 1 },
          $setOnInsert: { firstSeen: now }
        },
        { upsert: true }
      );
      
    } catch (error) {
      console.error('❌ MongoDB track visit error:', error.message);
      // Fall back to JSON for this request
      trackVisitJson(visitData.page);
    }
  } else {
    trackVisitJson(visitData.page);
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
 * Get analytics stats with time-series data
 * @param {Object} options - Query options
 * @param {number} options.days - Number of days to look back (default: 30)
 * @returns {Promise<Object>}
 */
async function getStats(options = {}) {
  const days = options.days || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  if (useDatabase && isMongoConnected) {
    try {
      const eventsCollection = mongoClient.db('wordftw_analytics').collection('visit_events');
      const sessionsCollection = mongoClient.db('wordftw_analytics').collection('sessions');
      
      const stats = {
        totalVisits: 0,
        uniqueSessions: 0,
        pages: {},
        topLocations: [],
        topDevices: [],
        topBrowsers: [],
        topReferrers: [],
        recentVisits: [],
        timeSeriesData: [],
        sessionAnalysis: [],
        engagementMetrics: {}
      };
      
      // Get time-series data (visits per day)
      const timeSeriesAgg = await eventsCollection.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            visits: { $sum: 1 },
            uniqueSessions: { $addToSet: '$sessionId' }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            visits: 1,
            uniqueSessions: { $size: '$uniqueSessions' }
          }
        }
      ]).toArray();
      
      stats.timeSeriesData = timeSeriesAgg.map(d => ({
        date: d.date,
        visits: d.visits,
        uniqueSessions: d.uniqueSessions
      }));
      
      // Get total stats for time period
      const totalStats = await eventsCollection.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            uniqueSessions: { $addToSet: '$sessionId' }
          }
        }
      ]).toArray();
      
      if (totalStats.length > 0) {
        stats.totalVisits = totalStats[0].totalVisits;
        stats.uniqueSessions = totalStats[0].uniqueSessions.length;
      }
      
      // Get page breakdown
      const pageAgg = await eventsCollection.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$page', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      pageAgg.forEach(p => {
        stats.pages[p._id] = p.count;
      });
      
      // Get top locations
      const locationAgg = await sessionsCollection.aggregate([
        { $match: { 'location.country': { $exists: true, $ne: null }, lastSeen: { $gte: startDate } } },
        {
          $group: {
            _id: {
              country: '$location.country',
              city: '$location.city'
            },
            sessions: { $sum: 1 },
            pageViews: { $sum: '$pageViews' }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      stats.topLocations = locationAgg.map(loc => ({
        country: loc._id.country,
        city: loc._id.city,
        sessions: loc.sessions,
        pageViews: loc.pageViews
      }));
      
      // Get device breakdown
      const deviceAgg = await sessionsCollection.aggregate([
        { $match: { lastSeen: { $gte: startDate } } },
        {
          $group: {
            _id: '$device.type',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();
      
      stats.topDevices = deviceAgg.map(d => ({
        type: d._id || 'unknown',
        count: d.count
      }));
      
      // Get browser breakdown
      const browserAgg = await sessionsCollection.aggregate([
        { $match: { lastSeen: { $gte: startDate }, 'device.browser': { $exists: true } } },
        {
          $group: {
            _id: '$device.browser',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      stats.topBrowsers = browserAgg.map(b => ({
        browser: b._id,
        count: b.count
      }));
      
      // Get top referrers
      const referrerAgg = await eventsCollection.aggregate([
        { $match: { timestamp: { $gte: startDate }, referrer: { $ne: 'direct' } } },
        {
          $group: {
            _id: '$referrer',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      stats.topReferrers = referrerAgg.map(r => ({
        referrer: r._id,
        count: r.count
      }));
      
      // Get session analysis (engagement metrics)
      const sessionStats = await sessionsCollection.aggregate([
        { $match: { lastSeen: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            avgPageViews: { $avg: '$pageViews' },
            totalSessions: { $sum: 1 },
            singlePageSessions: {
              $sum: { $cond: [{ $eq: ['$pageViews', 1] }, 1, 0] }
            }
          }
        }
      ]).toArray();
      
      if (sessionStats.length > 0) {
        const s = sessionStats[0];
        stats.engagementMetrics = {
          avgPageViews: Math.round(s.avgPageViews * 10) / 10,
          bounceRate: Math.round((s.singlePageSessions / s.totalSessions) * 100),
          totalSessions: s.totalSessions
        };
      }
      
      // Get user session details (top sessions by activity)
      const topSessions = await sessionsCollection.find({
        lastSeen: { $gte: startDate }
      })
        .sort({ lastSeen: -1 })  // Sort by most recent first
        .limit(100)  // Show up to 100 sessions
        .toArray();
      
      stats.sessionAnalysis = topSessions.map(s => ({
        sessionId: s.sessionId,
        ip: s.ip,
        pageViews: s.pageViews,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
        duration: s.lastSeen - s.firstSeen,
        location: s.location,
        device: s.device
      }));
      
      // Get recent visits (last 50)
      const recent = await eventsCollection.find({ timestamp: { $gte: startDate } })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();
      
      stats.recentVisits = recent.map(v => ({
        page: v.page,
        timestamp: v.timestamp,
        location: v.location,
        device: v.device,
        referrer: v.referrer,
        sessionId: v.sessionId
      }));
      
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
    uniqueSessions: 0,
    pages: jsonData.pages || {},
    topLocations: [],
    topDevices: [],
    topBrowsers: [],
    topReferrers: [],
    recentVisits: [],
    timeSeriesData: [],
    sessionAnalysis: [],
    engagementMetrics: {
      totalSessions: 0,
      avgPageViews: 0,
      avgSessionDuration: 0,
      bounceRate: 0
    }
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

/**
 * Track a click event
 * @param {Object} clickData - Click event data
 */
async function trackClick(clickData) {
  if (useDatabase && isMongoConnected) {
    try {
      const clicksCollection = mongoClient.db('wordftw_analytics').collection('click_events');
      await clicksCollection.insertOne({
        ...clickData,
        timestamp: new Date(clickData.timestamp || Date.now())
      });
    } catch (error) {
      console.error('❌ MongoDB track click error:', error.message);
    }
  }
  // No JSON fallback for clicks - too much data
}

module.exports = {
  initialize,
  trackVisit,
  trackClick,
  getStats,
  close,
  isUsingDatabase
};

