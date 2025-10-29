/**
 * Rate Limiting Middleware (DISABLED)
 * 
 * Rate limiting has been completely disabled for this application.
 * All limiters are now no-op middleware that pass through all requests.
 * 
 * This was causing issues in production where normal usage patterns
 * (multiple clients, SSE connections, link codes) would trigger rate limits.
 */

/**
 * No-op middleware - passes all requests through without rate limiting
 */
const noOpLimiter = (req, res, next) => next();

// Export no-op middleware for all limiter types
const generalLimiter = noOpLimiter;
const writeLimiter = noOpLimiter;
const strictLimiter = noOpLimiter;

module.exports = {
  generalLimiter,
  writeLimiter,
  strictLimiter
};
