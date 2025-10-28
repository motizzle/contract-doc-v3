/**
 * Standardized Error Handler Middleware
 * 
 * Provides consistent error responses with:
 * - Error codes
 * - Human-readable messages
 * - Resolution steps
 * - Context (in dev mode)
 */

/**
 * Standard error codes and their HTTP status mappings
 */
const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: { status: 400, message: 'Invalid request data' },
  INVALID_VERSION: { status: 400, message: 'Invalid version number' },
  INVALID_VARIABLE_ID: { status: 400, message: 'Invalid variable ID' },
  INVALID_DOCX: { status: 400, message: 'Invalid DOCX file' },
  INVALID_FILE_TYPE: { status: 400, message: 'Unsupported file type' },
  
  // Authentication errors (401)
  INVALID_SESSION: { status: 401, message: 'Invalid or missing session' },
  AUTH_REQUIRED: { status: 401, message: 'Authentication required' },
  
  // Authorization errors (403)
  PERMISSION_DENIED: { status: 403, message: 'Permission denied' },
  CHECKOUT_REQUIRED: { status: 403, message: 'Document must be checked out first' },
  EDITOR_ONLY: { status: 403, message: 'This action requires editor permissions' },
  
  // Not found errors (404)
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  DOCUMENT_NOT_FOUND: { status: 404, message: 'Document not found' },
  VERSION_NOT_FOUND: { status: 404, message: 'Version not found' },
  VARIABLE_NOT_FOUND: { status: 404, message: 'Variable not found' },
  SCENARIO_NOT_FOUND: { status: 404, message: 'Scenario not found' },
  
  // Timeout errors (408)
  REQUEST_TIMEOUT: { status: 408, message: 'Request timed out' },
  
  // Conflict errors (409)
  CHECKOUT_CONFLICT: { status: 409, message: 'Document already checked out' },
  VERSION_OUTDATED: { status: 409, message: 'Document has been updated' },
  DUPLICATE_NAME: { status: 409, message: 'A resource with this name already exists' },
  FINALIZED: { status: 409, message: 'Document is finalized' },
  
  // File size errors (413)
  FILE_TOO_LARGE: { status: 413, message: 'File exceeds maximum size' },
  
  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED: { status: 429, message: 'Too many requests' },
  
  // Session expired (440 - custom status)
  SESSION_EXPIRED: { status: 440, message: 'Session expired' },
  
  // Internal errors (500)
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  CONVERSION_FAILED: { status: 500, message: 'Document conversion failed' },
  COMPILE_FAILED: { status: 500, message: 'Compilation failed' },
  SAVE_FAILED: { status: 500, message: 'Failed to save document' },
  
  // Service unavailable (503)
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' },
  SHUTTING_DOWN: { status: 503, message: 'Server is shutting down' },
  
  // Insufficient storage (507)
  DISK_FULL: { status: 507, message: 'Insufficient disk space' }
};

/**
 * Resolution messages for common errors
 */
const RESOLUTIONS = {
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_SESSION: 'Refresh the page to start a new session.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  CHECKOUT_REQUIRED: 'Check out the document before making changes.',
  CHECKOUT_CONFLICT: 'Another user has checked out the document. Wait for them to check in.',
  VERSION_OUTDATED: 'Reload the document to get the latest version.',
  DOCUMENT_NOT_FOUND: 'The document may have been deleted. Contact support if this persists.',
  VERSION_NOT_FOUND: 'The requested version does not exist.',
  FILE_TOO_LARGE: 'The file size exceeds the 10MB limit. Please compress or split the file.',
  RATE_LIMIT_EXCEEDED: 'Please wait a few moments before trying again.',
  SESSION_EXPIRED: 'Your session has expired. Refresh the page to continue.',
  DISK_FULL: 'The server is running low on disk space. Please contact support.',
  FINALIZED: 'This document is finalized. Unfinalize it to make changes.',
  DUPLICATE_NAME: 'A resource with this name already exists. Please choose a different name.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again in a few moments.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again or contact support.',
  EDITOR_ONLY: 'This action requires editor permissions.'
};

/**
 * Create a standardized error response
 * @param {string} code - Error code
 * @param {string} [customMessage] - Optional custom message
 * @param {Object} [context] - Additional context (only shown in dev mode)
 * @returns {Object} Error response object
 */
function createErrorResponse(code, customMessage, context) {
  const errorDef = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;
  const resolution = RESOLUTIONS[code] || RESOLUTIONS.INTERNAL_ERROR;
  
  const response = {
    ok: false,
    error: code,
    message: customMessage || errorDef.message,
    resolution
  };
  
  // Include context in development mode
  if (context && process.env.NODE_ENV === 'development') {
    response.context = context;
  }
  
  return { status: errorDef.status, body: response };
}

/**
 * Error handler middleware
 * Catches all errors and returns standardized responses
 */
function errorHandler(err, req, res, next) {
  // Log error
  console.error(`❌ [Error] ${req.method} ${req.path}:`, err.message);
  
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  
  // If error is already a standardized error object
  if (err.errorCode) {
    const { status, body } = createErrorResponse(
      err.errorCode,
      err.message,
      err.context
    );
    return res.status(status).json(body);
  }
  
  // Handle common Node.js errors
  if (err.code === 'ENOENT') {
    const { status, body } = createErrorResponse('NOT_FOUND', 'File not found');
    return res.status(status).json(body);
  }
  
  if (err.code === 'ENOSPC') {
    const { status, body } = createErrorResponse('DISK_FULL');
    return res.status(status).json(body);
  }
  
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    const { status, body } = createErrorResponse('REQUEST_TIMEOUT');
    return res.status(status).json(body);
  }
  
  // Default to internal error
  const { status, body } = createErrorResponse(
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development' ? err.message : undefined,
    { stack: err.stack }
  );
  
  res.status(status).json(body);
}

/**
 * Custom error class for throwing standardized errors
 */
class AppError extends Error {
  constructor(code, message, context) {
    super(message || ERROR_CODES[code]?.message || 'An error occurred');
    this.errorCode = code;
    this.context = context;
    this.name = 'AppError';
  }
}

/**
 * Helper function to send error response
 * @param {Object} res - Express response object
 * @param {string} code - Error code
 * @param {string} [customMessage] - Optional custom message
 * @param {Object} [context] - Additional context
 */
function sendError(res, code, customMessage, context) {
  const { status, body } = createErrorResponse(code, customMessage, context);
  res.status(status).json(body);
}

module.exports = {
  errorHandler,
  AppError,
  sendError,
  createErrorResponse,
  ERROR_CODES,
  RESOLUTIONS
};

