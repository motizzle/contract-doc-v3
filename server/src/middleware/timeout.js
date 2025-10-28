/**
 * Request Timeout Middleware
 * 
 * Enforces timeout limits on all requests
 * - Default: 30 seconds
 * - Long operations: 120 seconds (compilation, PDF generation)
 */

/**
 * Create a timeout middleware with custom duration
 * @param {number} ms - Timeout in milliseconds
 * @returns {Function} Express middleware
 */
function timeoutMiddleware(ms = 30000) {
  return (req, res, next) => {
    // Skip timeout in test mode
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.log(`⏱️  [Timeout] Request timed out after ${ms}ms: ${req.method} ${req.path}`);
        
        res.status(408).json({
          ok: false,
          error: 'REQUEST_TIMEOUT',
          message: 'Request timed out',
          resolution: 'The operation took too long. Please try again with a smaller file or fewer operations.',
          timeout: ms
        });
      }
    }, ms);
    
    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    res.on('close', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
}

/**
 * Standard timeout for most operations (30 seconds)
 */
const standardTimeout = timeoutMiddleware(30000);

/**
 * Extended timeout for long operations (120 seconds)
 * Use for: document compilation, PDF generation, large file uploads
 */
const extendedTimeout = timeoutMiddleware(120000);

/**
 * Short timeout for quick operations (10 seconds)
 * Use for: health checks, simple queries
 */
const shortTimeout = timeoutMiddleware(10000);

module.exports = {
  timeoutMiddleware,
  standardTimeout,
  extendedTimeout,
  shortTimeout
};

