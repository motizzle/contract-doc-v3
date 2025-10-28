/**
 * Rate Limiting Middleware
 * 
 * Prevents abuse by limiting request frequency
 * - General API: 100 requests / 15 minutes
 * - Write operations: 10 requests / minute
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Applies to all API endpoints
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    ok: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP',
    resolution: 'Please wait a few minutes before trying again.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Only apply rate limiting in production
    return process.env.NODE_ENV !== 'production';
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime - Date.now()) / 1000;
    console.log(`⚠️  [Rate Limit] General limit exceeded for ${req.ip} on ${req.method} ${req.path}`);
    res.status(429).json({
      ok: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      resolution: `Please wait ${Math.ceil(retryAfter)} seconds before trying again.`,
      retryAfter: Math.ceil(retryAfter)
    });
  }
});

/**
 * Write operations rate limiter
 * Applies to POST/PUT/DELETE endpoints that modify data
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 write requests per minute
  message: {
    ok: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many write operations',
    resolution: 'Please wait a moment before making more changes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply rate limiting in production
    return process.env.NODE_ENV !== 'production';
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime - Date.now()) / 1000;
    console.log(`⚠️  [Rate Limit] Write limit exceeded for ${req.ip} on ${req.method} ${req.path}`);
    res.status(429).json({
      ok: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many write operations',
      resolution: `Please wait ${Math.ceil(retryAfter)} seconds before making more changes.`,
      retryAfter: Math.ceil(retryAfter)
    });
  }
});

/**
 * Strict rate limiter for expensive operations
 * Used for compilation, PDF generation, etc.
 */
const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 expensive operations per 5 minutes
  message: {
    ok: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many expensive operations',
    resolution: 'Please wait a few minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime - Date.now()) / 1000;
    console.log(`⚠️  [Rate Limit] Strict limit exceeded for ${req.ip} on ${req.method} ${req.path}`);
    res.status(429).json({
      ok: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many expensive operations',
      resolution: `This operation is resource-intensive. Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`,
      retryAfter: Math.ceil(retryAfter)
    });
  }
});

module.exports = {
  generalLimiter,
  writeLimiter,
  strictLimiter
};

