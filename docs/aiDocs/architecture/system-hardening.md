# WordFTW System Hardening Strategy

**Status:** 📋 Planned  
**Priority:** High  
**Last Updated:** October 27, 2025  
**Scope:** Full Application Stack  
**Related:** `features/addin-installation-hardening.md`, `architecture/state-machine.md`, `features/automated-testing-suite.md`

---

## Executive Summary

This document applies the hardening principles from the add-in installation process to the entire WordFTW application. Every component will have:

1. ✅ **Pre-flight checks** - Validate before executing
2. ✅ **Clear error messages** - Every error has actionable resolution
3. ✅ **Graceful degradation** - Partial functionality > total failure
4. ✅ **Rollback capability** - Undo failed operations
5. ✅ **Self-healing** - Detect and fix common issues automatically
6. ✅ **Comprehensive testing** - Automated coverage of all failure modes
7. ✅ **Observability** - Clear logging and diagnostics

---

## Current State Assessment

### ❌ Areas Lacking Robustness

**Server Initialization:**
- No dependency checking (Node version, required modules)
- No validation of data directories
- No graceful startup failure handling
- No health check endpoint verification

**API Endpoints:**
- Generic error responses without context
- No input validation framework
- No request rate limiting
- No transaction rollback on partial failures
- Inconsistent error handling across endpoints

**State Management:**
- No state consistency validation
- No automatic corruption detection
- No state recovery mechanisms
- Race conditions in concurrent updates

**File Operations:**
- No file size limits
- No virus/malware scanning
- No disk space checking
- No atomic file operations
- No cleanup of orphaned files

**Session Management:**
- No session timeout handling
- No cleanup of abandoned sessions
- No session data validation
- Memory leaks from unclosed sessions

**Network Operations:**
- No retry logic for transient failures
- No circuit breaker for failing services
- No connection pooling
- No timeout configuration

**Client-Side:**
- Silent failures in React components
- No offline mode handling
- No retry logic for failed API calls
- Inconsistent error boundaries

---

## Hardening Framework

### Principle 1: Fail Fast, Fail Clearly

**Every operation should:**
1. Validate inputs before proceeding
2. Check prerequisites before starting
3. Provide specific error messages
4. Include resolution steps
5. Log failures with context

**Implementation Pattern:**
```javascript
async function hardenedOperation(input) {
  // 1. Pre-flight validation
  const validation = await validatePrerequisites(input);
  if (!validation.ok) {
    throw new HardenedError({
      code: 'PREREQUISITE_FAILED',
      message: validation.message,
      resolution: validation.resolution,
      context: { input, validation }
    });
  }
  
  // 2. Execute with monitoring
  let result;
  try {
    result = await executeOperation(input);
  } catch (error) {
    // 3. Provide context and resolution
    throw new HardenedError({
      code: 'OPERATION_FAILED',
      message: `Failed to execute operation: ${error.message}`,
      resolution: getResolutionSteps(error),
      context: { input, error },
      originalError: error
    });
  }
  
  // 4. Post-operation validation
  const verification = await verifyResult(result);
  if (!verification.ok) {
    // 5. Rollback if verification fails
    await rollbackOperation(input);
    throw new HardenedError({
      code: 'VERIFICATION_FAILED',
      message: verification.message,
      resolution: 'Operation rolled back. Please try again.',
      context: { input, result, verification }
    });
  }
  
  return result;
}
```

---

## Component-by-Component Hardening

### 1. Server Initialization Hardening

#### A. Startup Pre-flight Checks

**Check Node.js version:**
```javascript
// server/src/startup-checks.js
const MIN_NODE_VERSION = 18;

function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0]);
  
  if (major < MIN_NODE_VERSION) {
    console.error(`[ERROR] Node.js ${MIN_NODE_VERSION}+ required. Current: ${version}`);
    console.error('');
    console.error('RESOLUTION:');
    console.error('1. Download Node.js from https://nodejs.org/');
    console.error(`2. Install Node.js ${MIN_NODE_VERSION} or higher`);
    console.error('3. Restart the server');
    process.exit(1);
  }
  
  console.log(`✅ Node.js version: ${version}`);
}
```

**Validate required modules:**
```javascript
function checkRequiredModules() {
  const required = [
    'express',
    'cors',
    'fs',
    'path',
    'office-document-generator'
  ];
  
  const missing = [];
  for (const module of required) {
    try {
      require.resolve(module);
    } catch (error) {
      missing.push(module);
    }
  }
  
  if (missing.length > 0) {
    console.error('[ERROR] Missing required modules:', missing.join(', '));
    console.error('');
    console.error('RESOLUTION:');
    console.error('1. Run: npm install');
    console.error('2. Restart the server');
    process.exit(1);
  }
  
  console.log('✅ All required modules installed');
}
```

**Validate data directories:**
```javascript
function checkDataDirectories() {
  const required = [
    'data/app',
    'data/app/documents',
    'data/app/exhibits',
    'data/app/presets',
    'data/working',
    'server/public'
  ];
  
  const missing = [];
  for (const dir of required) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } catch (error) {
        missing.push(dir);
      }
    }
  }
  
  if (missing.length > 0) {
    console.error('[ERROR] Failed to create required directories:', missing.join(', '));
    console.error('');
    console.error('RESOLUTION:');
    console.error('1. Check file system permissions');
    console.error('2. Ensure disk space is available');
    console.error('3. Run with appropriate permissions');
    process.exit(1);
  }
  
  console.log('✅ All data directories exist');
}
```

**Check disk space:**
```javascript
const os = require('os');

function checkDiskSpace() {
  const MIN_FREE_SPACE_GB = 1;
  
  // Get disk space (platform-specific)
  const freespace = os.freemem() / (1024 * 1024 * 1024); // Approximation
  
  if (freespace < MIN_FREE_SPACE_GB) {
    console.warn(`[WARNING] Low disk space: ${freespace.toFixed(2)} GB free`);
    console.warn('Server may encounter errors if disk becomes full');
  } else {
    console.log(`✅ Disk space: ${freespace.toFixed(2)} GB free`);
  }
}
```

**Validate environment variables:**
```javascript
function checkEnvironmentVariables() {
  const required = {
    'NODE_ENV': { default: 'development', required: false },
    'PORT': { default: 4001, required: false },
    'LLM_PROVIDER': { default: 'ollama', required: false }
  };
  
  for (const [key, config] of Object.entries(required)) {
    if (!process.env[key]) {
      if (config.required) {
        console.error(`[ERROR] Required environment variable missing: ${key}`);
        console.error('');
        console.error('RESOLUTION:');
        console.error(`1. Set ${key} in your environment`);
        console.error(`2. Or create a .env file with ${key}=<value>`);
        process.exit(1);
      } else if (config.default) {
        process.env[key] = config.default;
        console.log(`⚙️  Using default ${key}=${config.default}`);
      }
    }
  }
  
  console.log('✅ Environment variables validated');
}
```

**Complete startup check:**
```javascript
// server/src/server.js - Add at the very beginning
async function runStartupChecks() {
  console.log('========================================');
  console.log(' WordFTW Server - Startup Checks');
  console.log('========================================');
  console.log('');
  
  try {
    checkNodeVersion();
    checkRequiredModules();
    checkEnvironmentVariables();
    checkDataDirectories();
    checkDiskSpace();
    
    console.log('');
    console.log('✅ All startup checks passed');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Startup checks failed');
    console.error('Server cannot start safely');
    console.error('');
    process.exit(1);
  }
}

// Run before anything else
runStartupChecks().then(() => {
  // ... rest of server initialization
});
```

#### B. Graceful Shutdown Handling

**Handle termination signals:**
```javascript
const activeRequests = new Set();
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('Forced shutdown');
    process.exit(1);
  }
  
  isShuttingDown = true;
  console.log('');
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new requests
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Wait for active requests to complete
  const timeout = setTimeout(() => {
    console.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout
  
  // Check active requests
  const checkInterval = setInterval(() => {
    console.log(`Waiting for ${activeRequests.size} active requests...`);
    if (activeRequests.size === 0) {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      console.log('All requests completed, exiting');
      process.exit(0);
    }
  }, 1000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Track active requests
app.use((req, res, next) => {
  if (isShuttingDown) {
    return res.status(503).json({
      error: 'server_shutting_down',
      message: 'Server is shutting down, please retry in a moment'
    });
  }
  
  activeRequests.add(req);
  res.on('finish', () => activeRequests.delete(req));
  res.on('close', () => activeRequests.delete(req));
  
  next();
});
```

#### C. Health Check Endpoint

**Comprehensive health check:**
```javascript
app.get('/api/v1/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: 'ok',
    heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`
  };
  
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    health.checks.memory.status = 'warning';
    health.checks.memory.message = 'High memory usage';
  }
  
  // Check file system
  try {
    await fs.promises.access('data/app', fs.constants.R_OK | fs.constants.W_OK);
    health.checks.filesystem = { status: 'ok' };
  } catch (error) {
    health.checks.filesystem = {
      status: 'error',
      message: 'Cannot access data directory',
      error: error.message
    };
    health.status = 'degraded';
  }
  
  // Check LLM provider
  if (process.env.LLM_PROVIDER === 'ollama') {
    try {
      const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      health.checks.llm = response.ok
        ? { status: 'ok', provider: 'ollama' }
        : { status: 'error', provider: 'ollama', message: 'Cannot reach Ollama' };
    } catch (error) {
      health.checks.llm = {
        status: 'error',
        provider: 'ollama',
        message: error.message
      };
      health.status = 'degraded';
    }
  }
  
  // Overall status
  const hasErrors = Object.values(health.checks).some(c => c.status === 'error');
  if (hasErrors) {
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

### 2. API Endpoint Hardening

#### A. Input Validation Framework

**Create validation middleware:**
```javascript
// server/src/middleware/validation.js
const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
        type: d.type
      }));
      
      return res.status(400).json({
        error: 'validation_failed',
        message: 'Input validation failed',
        details,
        resolution: 'Please check the request format and try again'
      });
    }
    
    // Replace req.body with validated/sanitized value
    req.body = value;
    next();
  };
}

// Define schemas
const schemas = {
  checkIn: Joi.object({
    userId: Joi.string().required(),
    platform: Joi.string().valid('web', 'word').required()
  }),
  
  checkOut: Joi.object({
    userId: Joi.string().required(),
    platform: Joi.string().valid('web', 'word').required()
  }),
  
  saveProgress: Joi.object({
    userId: Joi.string().required(),
    note: Joi.string().max(500).optional()
  }),
  
  shareVersion: Joi.object({
    userId: Joi.string().required(),
    shared: Joi.boolean().required()
  }),
  
  approvalUpdate: Joi.object({
    userId: Joi.string().required(),
    approverId: Joi.string().required(),
    approved: Joi.boolean().required(),
    notes: Joi.string().max(1000).optional()
  })
};

module.exports = { validate, schemas };
```

**Apply validation to endpoints:**
```javascript
const { validate, schemas } = require('./middleware/validation');

app.post('/api/v1/check-in', validate(schemas.checkIn), async (req, res) => {
  // req.body is now validated and sanitized
  try {
    // ... implementation
  } catch (error) {
    handleError(error, req, res);
  }
});
```

#### B. Standardized Error Handling

**Create error handler middleware:**
```javascript
// server/src/middleware/error-handler.js

class HardenedError extends Error {
  constructor({ code, message, resolution, context, statusCode = 500 }) {
    super(message);
    this.name = 'HardenedError';
    this.code = code;
    this.resolution = resolution;
    this.context = context;
    this.statusCode = statusCode;
  }
}

const errorCodes = {
  CHECKOUT_CONFLICT: {
    statusCode: 409,
    message: 'Document is already checked out by another user',
    resolution: 'Wait for the other user to check in, or have an admin force check-in'
  },
  VERSION_NOT_FOUND: {
    statusCode: 404,
    message: 'Requested version does not exist',
    resolution: 'Check the version number and try again'
  },
  INVALID_SESSION: {
    statusCode: 401,
    message: 'Invalid or expired session',
    resolution: 'Please refresh the page to establish a new session'
  },
  DISK_FULL: {
    statusCode: 507,
    message: 'Server disk space is full',
    resolution: 'Contact system administrator to free up disk space'
  },
  FILE_TOO_LARGE: {
    statusCode: 413,
    message: 'Uploaded file exceeds size limit',
    resolution: 'Reduce file size to under 10MB and try again'
  }
};

function handleError(error, req, res) {
  // Log error with context
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.body?.userId || req.query?.userId,
    error: error.message,
    stack: error.stack,
    context: error.context
  });
  
  // Handle known errors
  if (error instanceof HardenedError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      resolution: error.resolution,
      ...(process.env.NODE_ENV === 'development' && {
        context: error.context,
        stack: error.stack
      })
    });
  }
  
  // Handle known error codes
  if (error.code && errorCodes[error.code]) {
    const errorInfo = errorCodes[error.code];
    return res.status(errorInfo.statusCode).json({
      error: error.code,
      message: errorInfo.message,
      resolution: errorInfo.resolution
    });
  }
  
  // Generic error
  res.status(500).json({
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    resolution: 'Please try again. If the problem persists, contact support.',
    ...(process.env.NODE_ENV === 'development' && {
      details: error.message,
      stack: error.stack
    })
  });
}

// Global error handler
app.use((error, req, res, next) => {
  handleError(error, req, res);
});

module.exports = { HardenedError, handleError, errorCodes };
```

#### C. Request Rate Limiting

**Add rate limiting middleware:**
```javascript
// server/src/middleware/rate-limit.js
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP',
      resolution: 'Please wait a few minutes before trying again',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Strict limit for write operations
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  handler: (req, res) => {
    res.status(429).json({
      error: 'write_rate_limit_exceeded',
      message: 'Too many write operations',
      resolution: 'Please slow down your requests',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Apply to all API routes
app.use('/api/', apiLimiter);

// Apply to write operations
app.post('/api/v1/check-in', writeLimiter, ...);
app.post('/api/v1/save-progress', writeLimiter, ...);
app.post('/api/v1/check-out', writeLimiter, ...);

module.exports = { apiLimiter, writeLimiter };
```

#### D. Request Timeout Handling

**Add timeout middleware:**
```javascript
// server/src/middleware/timeout.js
const timeout = require('connect-timeout');

function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}

// Apply 30-second timeout to all requests
app.use(timeout('30s'));
app.use(haltOnTimedout);

// For long-running operations, increase timeout
app.post('/api/v1/compile-document',
  timeout('120s'), // 2 minutes for document compilation
  haltOnTimedout,
  async (req, res) => {
    // ... implementation
  }
);

// Timeout handler
app.use((req, res, next) => {
  if (req.timedout) {
    return res.status(408).json({
      error: 'request_timeout',
      message: 'Request took too long to process',
      resolution: 'The operation may still be processing. Please check status or try again.'
    });
  }
  next();
});
```

---

### 3. State Management Hardening

#### A. State Consistency Validation

**Add state validator:**
```javascript
// server/src/validators/state-validator.js

function validateServerState(state) {
  const errors = [];
  
  // Check required fields
  const required = ['revision', 'documentVersion', 'lastUpdated'];
  for (const field of required) {
    if (state[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate types
  if (typeof state.revision !== 'number' || state.revision < 1) {
    errors.push('revision must be a positive number');
  }
  
  if (typeof state.documentVersion !== 'number' || state.documentVersion < 1) {
    errors.push('documentVersion must be a positive number');
  }
  
  // Validate checkout state
  if (state.checkedOutBy !== null && typeof state.checkedOutBy !== 'string') {
    errors.push('checkedOutBy must be null or string');
  }
  
  // Validate status
  const validStatuses = ['draft', 'review', 'approved', 'signed'];
  if (state.status && !validStatuses.includes(state.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateSessionState(state) {
  // Similar validation for session-specific state
  return validateServerState(state);
}

module.exports = { validateServerState, validateSessionState };
```

**Validate before persisting:**
```javascript
function persistState() {
  try {
    // Validate before writing
    const validation = validateServerState(serverState);
    if (!validation.valid) {
      console.error('[ERROR] State validation failed:', validation.errors);
      throw new Error('Cannot persist invalid state');
    }
    
    const stateJson = JSON.stringify(serverState, null, 2);
    fs.writeFileSync(stateFilePath, stateJson, 'utf8');
    console.log('✅ State persisted successfully');
  } catch (error) {
    console.error('[ERROR] Failed to persist state:', error);
    // Don't throw - allow server to continue with in-memory state
  }
}
```

#### B. Automatic Corruption Detection

**Check state on load:**
```javascript
function loadStateWithValidation() {
  try {
    if (!fs.existsSync(stateFilePath)) {
      console.log('No state file found, using defaults');
      return getDefaultState();
    }
    
    const stateJson = fs.readFileSync(stateFilePath, 'utf8');
    const state = JSON.parse(stateJson);
    
    // Validate loaded state
    const validation = validateServerState(state);
    if (!validation.valid) {
      console.error('[ERROR] Corrupted state file detected:', validation.errors);
      console.log('Creating backup and using defaults...');
      
      // Backup corrupted state
      const backupPath = `${stateFilePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(stateFilePath, backupPath);
      console.log(`Backup saved to: ${backupPath}`);
      
      // Use defaults
      return getDefaultState();
    }
    
    console.log('✅ State loaded and validated successfully');
    return state;
  } catch (error) {
    console.error('[ERROR] Failed to load state:', error);
    return getDefaultState();
  }
}

function getDefaultState() {
  return {
    checkedOutBy: null,
    lastUpdated: new Date().toISOString(),
    revision: 1,
    documentVersion: 1,
    title: 'Redlined & Signed',
    status: 'draft',
    updatedBy: null,
    updatedPlatform: null,
    approvalsRevision: 1
  };
}

// Use on startup
const serverState = loadStateWithValidation();
```

#### C. Atomic State Updates

**Implement transaction-like updates:**
```javascript
// server/src/utils/atomic-state.js

class StateTransaction {
  constructor(state) {
    this.originalState = JSON.parse(JSON.stringify(state));
    this.newState = JSON.parse(JSON.stringify(state));
    this.committed = false;
  }
  
  update(updates) {
    Object.assign(this.newState, updates);
  }
  
  validate() {
    const validation = validateServerState(this.newState);
    if (!validation.valid) {
      throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
    }
  }
  
  commit(targetState) {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    
    this.validate();
    Object.assign(targetState, this.newState);
    this.committed = true;
  }
  
  rollback(targetState) {
    Object.assign(targetState, this.originalState);
  }
}

// Usage
function updateServerStateAtomic(updates) {
  const transaction = new StateTransaction(serverState);
  
  try {
    transaction.update(updates);
    transaction.validate();
    transaction.commit(serverState);
    persistState();
    return { ok: true };
  } catch (error) {
    console.error('[ERROR] State update failed:', error);
    transaction.rollback(serverState);
    return { ok: false, error: error.message };
  }
}

module.exports = { StateTransaction, updateServerStateAtomic };
```

---

### 4. File Operations Hardening

#### A. File Size Limits

**Add file size middleware:**
```javascript
// server/src/middleware/file-limits.js
const multer = require('multer');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf'
    ];
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
    
    cb(null, true);
  }
});

// Error handler for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'file_too_large',
        message: `File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        resolution: 'Please upload a smaller file'
      });
    }
  }
  next(error);
});

module.exports = { upload, MAX_FILE_SIZE };
```

#### B. Disk Space Checking

**Check before file operations:**
```javascript
const diskusage = require('diskusage');

async function checkDiskSpace(requiredBytes) {
  try {
    const info = await diskusage.check('/');
    const availableGB = info.available / (1024 * 1024 * 1024);
    const requiredGB = requiredBytes / (1024 * 1024 * 1024);
    
    if (info.available < requiredBytes) {
      throw new HardenedError({
        code: 'DISK_FULL',
        message: `Insufficient disk space. Required: ${requiredGB.toFixed(2)}GB, Available: ${availableGB.toFixed(2)}GB`,
        resolution: 'Free up disk space or contact system administrator',
        statusCode: 507
      });
    }
    
    return { ok: true, available: availableGB };
  } catch (error) {
    if (error instanceof HardenedError) throw error;
    // If diskusage check fails, allow operation but log warning
    console.warn('[WARNING] Could not check disk space:', error);
    return { ok: true, available: null };
  }
}

// Use before file writes
app.post('/api/v1/upload-document', async (req, res) => {
  try {
    const fileSize = parseInt(req.headers['content-length'] || '0');
    await checkDiskSpace(fileSize * 2); // 2x for temp files
    
    // ... continue with upload
  } catch (error) {
    handleError(error, req, res);
  }
});
```

#### C. Atomic File Operations

**Use temp files and rename:**
```javascript
const { v4: uuidv4 } = require('uuid');

async function safeFileWrite(filePath, content) {
  const tempPath = `${filePath}.tmp.${uuidv4()}`;
  
  try {
    // Write to temp file first
    await fs.promises.writeFile(tempPath, content, 'utf8');
    
    // Verify write succeeded
    const written = await fs.promises.readFile(tempPath, 'utf8');
    if (written !== content) {
      throw new Error('File write verification failed');
    }
    
    // Atomic rename (or as close as possible)
    await fs.promises.rename(tempPath, filePath);
    
    return { ok: true };
  } catch (error) {
    // Clean up temp file
    try {
      await fs.promises.unlink(tempPath);
    } catch {}
    
    throw new HardenedError({
      code: 'FILE_WRITE_FAILED',
      message: `Failed to write file: ${error.message}`,
      resolution: 'Check file permissions and disk space',
      context: { filePath, error: error.message }
    });
  }
}
```

#### D. Orphaned File Cleanup

**Schedule periodic cleanup:**
```javascript
// server/src/cleanup/orphaned-files.js

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours

async function cleanupOrphanedFiles() {
  console.log('[CLEANUP] Starting orphaned file cleanup...');
  
  const patterns = [
    'data/working/*/documents/*.tmp.*',
    'data/working/*/versions/*.tmp.*',
    'data/working/temp/*'
  ];
  
  let cleanedCount = 0;
  const now = Date.now();
  
  for (const pattern of patterns) {
    try {
      const files = await glob(pattern);
      for (const file of files) {
        const stats = await fs.promises.stat(file);
        const age = now - stats.mtimeMs;
        
        if (age > MAX_FILE_AGE) {
          await fs.promises.unlink(file);
          cleanedCount++;
          console.log(`[CLEANUP] Removed: ${file} (age: ${(age / 1000 / 60 / 60).toFixed(1)}h)`);
        }
      }
    } catch (error) {
      console.error(`[CLEANUP] Error with pattern ${pattern}:`, error);
    }
  }
  
  console.log(`[CLEANUP] Cleanup complete. Removed ${cleanedCount} orphaned files.`);
}

// Start cleanup scheduler
function startCleanupScheduler() {
  setInterval(cleanupOrphanedFiles, CLEANUP_INTERVAL);
  
  // Run immediately on startup
  setTimeout(cleanupOrphanedFiles, 10000); // 10 second delay after startup
}

module.exports = { startCleanupScheduler, cleanupOrphanedFiles };
```

---

### 5. Session Management Hardening

#### A. Session Timeout Handling

**Implement session expiry:**
```javascript
// server/src/middleware/session-management.js

const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
const sessionLastActive = new Map();

function trackSessionActivity(req, res, next) {
  const sessionId = req.sessionId || 'default';
  sessionLastActive.set(sessionId, Date.now());
  next();
}

function checkSessionExpiry(req, res, next) {
  const sessionId = req.sessionId || 'default';
  const lastActive = sessionLastActive.get(sessionId);
  
  if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT) {
    sessionLastActive.delete(sessionId);
    
    return res.status(440).json({
      error: 'session_expired',
      message: 'Your session has expired due to inactivity',
      resolution: 'Please refresh the page to start a new session'
    });
  }
  
  next();
}

app.use(trackSessionActivity);
app.use('/api', checkSessionExpiry);

module.exports = { trackSessionActivity, checkSessionExpiry };
```

#### B. Abandoned Session Cleanup

**Clean up old sessions:**
```javascript
const SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

async function cleanupAbandonedSessions() {
  console.log('[CLEANUP] Starting session cleanup...');
  
  const workingDir = path.join(__dirname, '../../data');
  const sessions = await fs.promises.readdir(workingDir);
  
  let cleanedCount = 0;
  const now = Date.now();
  
  for (const dir of sessions) {
    if (!dir.startsWith('working-sess_')) continue;
    
    const sessionPath = path.join(workingDir, dir);
    const lastActive = sessionLastActive.get(dir.replace('working-', ''));
    
    // If no activity record or expired
    if (!lastActive || now - lastActive > SESSION_TIMEOUT * 2) {
      try {
        const stats = await fs.promises.stat(sessionPath);
        const age = now - stats.mtimeMs;
        
        // Only delete if not modified recently (double timeout as safety)
        if (age > SESSION_TIMEOUT * 2) {
          await fs.promises.rm(sessionPath, { recursive: true, force: true });
          cleanedCount++;
          console.log(`[CLEANUP] Removed abandoned session: ${dir}`);
        }
      } catch (error) {
        console.error(`[CLEANUP] Error removing session ${dir}:`, error);
      }
    }
  }
  
  console.log(`[CLEANUP] Session cleanup complete. Removed ${cleanedCount} sessions.`);
}

// Start scheduler
function startSessionCleanup() {
  setInterval(cleanupAbandonedSessions, SESSION_CLEANUP_INTERVAL);
  setTimeout(cleanupAbandonedSessions, 60000); // Run 1 min after startup
}

module.exports = { cleanupAbandonedSessions, startSessionCleanup };
```

---

### 6. Network Operations Hardening

#### A. Retry Logic with Exponential Backoff

**Implement retry helper:**
```javascript
// server/src/utils/retry.js

async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
        
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, delay, error);
        }
        
        console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new HardenedError({
    code: 'MAX_RETRIES_EXCEEDED',
    message: `Operation failed after ${maxRetries} retries`,
    resolution: 'The service may be temporarily unavailable. Please try again later.',
    context: { maxRetries, lastError: lastError.message }
  });
}

module.exports = { retryWithBackoff };
```

**Use for external API calls:**
```javascript
const { retryWithBackoff } = require('./utils/retry');

async function callLLMProvider(prompt) {
  return await retryWithBackoff(
    async () => {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false
        }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`LLM API returned ${response.status}`);
      }
      
      return await response.json();
    },
    {
      maxRetries: 3,
      onRetry: (attempt, max, delay, error) => {
        console.log(`[LLM] Retry ${attempt}/${max}: ${error.message}`);
      }
    }
  );
}
```

#### B. Circuit Breaker Pattern

**Implement circuit breaker:**
```javascript
// server/src/utils/circuit-breaker.js

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new HardenedError({
          code: 'CIRCUIT_BREAKER_OPEN',
          message: 'Service temporarily unavailable',
          resolution: `Please try again after ${new Date(this.nextAttempt).toLocaleTimeString()}`,
          statusCode: 503
        });
      }
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log('[CIRCUIT] Circuit closed - service recovered');
        this.state = 'CLOSED';
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    
    if (this.failureCount >= this.failureThreshold) {
      console.error(`[CIRCUIT] Circuit opened - ${this.failureCount} failures`);
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Create circuit breakers for external services
const llmCircuit = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 60000
});

// Usage
async function callLLMWithCircuitBreaker(prompt) {
  return await llmCircuit.execute(async () => {
    return await callLLMProvider(prompt);
  });
}

module.exports = { CircuitBreaker, llmCircuit };
```

---

### 7. Client-Side Hardening

#### A. React Error Boundaries

**Create error boundary component:**
```javascript
// shared-ui/ErrorBoundary.js

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log to server
    if (typeof window !== 'undefined') {
      fetch('/api/v1/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silent fail if error reporting fails
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: {
          padding: 20,
          border: '2px solid #EF4444',
          borderRadius: 8,
          background: '#FEF2F2',
          margin: 20
        }
      }, [
        React.createElement('h2', { key: 'title', style: { color: '#DC2626', marginTop: 0 } }, '⚠️ Something went wrong'),
        React.createElement('p', { key: 'msg', style: { color: '#991B1B' } }, 'An error occurred in this component. The rest of the application should still work.'),
        React.createElement('button', {
          key: 'retry',
          onClick: () => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          },
          style: {
            background: '#DC2626',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            marginRight: 8
          }
        }, 'Reload Page'),
        React.createElement('button', {
          key: 'continue',
          onClick: () => this.setState({ hasError: false, error: null }),
          style: {
            background: '#6B7280',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }
        }, 'Try to Continue'),
        (process.env.NODE_ENV === 'development' && this.state.error && 
          React.createElement('details', { key: 'details', style: { marginTop: 16 } }, [
            React.createElement('summary', { key: 'sum' }, 'Error Details'),
            React.createElement('pre', { key: 'stack', style: { fontSize: 12, overflow: 'auto' } }, 
              this.state.error.toString() + '\n\n' + this.state.errorInfo?.componentStack
            )
          ])
        )
      ]);
    }
    
    return this.props.children;
  }
}

// Wrap main app
function mountReactApp(opts) {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    React.createElement(ErrorBoundary, null,
      React.createElement(App, opts)
    )
  );
}
```

#### B. API Call Error Handling

**Standardize API calls:**
```javascript
// shared-ui/utils/api.js

async function apiCall(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    timeout = 30000,
    retries = 3
  } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'unknown_error',
          message: `Request failed with status ${response.status}`
        }));
        
        throw new APIError(error.error, error.message, error.resolution, response.status);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Don't retry on abort
      if (error.name === 'AbortError') {
        throw new APIError(
          'request_timeout',
          'Request took too long',
          'Please check your connection and try again'
        );
      }
      
      // Retry on network errors or 5xx
      if (attempt < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new APIError(
    'network_error',
    'Failed to connect to server',
    'Please check your internet connection and try again',
    0,
    lastError
  );
}

class APIError extends Error {
  constructor(code, message, resolution, status = 500, originalError = null) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.resolution = resolution;
    this.status = status;
    this.originalError = originalError;
  }
}

// Usage in components
async function handleCheckIn(userId) {
  try {
    const result = await apiCall('/api/v1/check-in', {
      method: 'POST',
      body: { userId, platform: 'web' }
    });
    
    console.log('Check-in successful');
    return result;
  } catch (error) {
    if (error instanceof APIError) {
      // Show user-friendly error
      showToast(error.message, 'error');
      if (error.resolution) {
        console.log('Resolution:', error.resolution);
      }
    } else {
      showToast('An unexpected error occurred', 'error');
    }
    throw error;
  }
}
```

#### C. Offline Mode Handling

**Detect offline state:**
```javascript
// shared-ui/utils/offline-detector.js

function createOfflineDetector(onStatusChange) {
  let isOnline = navigator.onLine;
  
  const checkStatus = async () => {
    try {
      const response = await fetch('/api/v1/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const newStatus = response.ok;
      if (newStatus !== isOnline) {
        isOnline = newStatus;
        onStatusChange(isOnline);
      }
    } catch {
      if (isOnline) {
        isOnline = false;
        onStatusChange(false);
      }
    }
  };
  
  // Check periodically
  const intervalId = setInterval(checkStatus, 30000); // 30 seconds
  
  // Listen to browser events
  window.addEventListener('online', () => {
    isOnline = true;
    onStatusChange(true);
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    onStatusChange(false);
  });
  
  return {
    isOnline: () => isOnline,
    stop: () => clearInterval(intervalId)
  };
}

// Use in app
const offlineDetector = createOfflineDetector((isOnline) => {
  if (isOnline) {
    showToast('Connection restored', 'success');
  } else {
    showToast('You are offline. Some features may not work.', 'warning');
  }
});
```

---

## Implementation Roadmap

### Phase 1: Critical Infrastructure (Week 1)
**Priority: Prevent data loss and system crashes**

- [ ] Server startup checks (Node version, modules, directories)
- [ ] Graceful shutdown handling
- [ ] Health check endpoint
- [ ] State consistency validation
- [ ] Atomic state updates
- [ ] Atomic file operations
- [ ] Disk space checking

**Success Criteria:**
- Server cannot start with invalid configuration
- No data corruption from interrupted operations
- System can recover from crashes

### Phase 2: API Hardening (Week 2)
**Priority: Robust request handling**

- [ ] Input validation framework (Joi)
- [ ] Standardized error handling
- [ ] Request rate limiting
- [ ] Request timeout handling
- [ ] API retry logic with backoff
- [ ] Circuit breaker for external services

**Success Criteria:**
- All endpoints validate inputs
- Consistent error responses with resolutions
- System handles load spikes gracefully
- External service failures don't crash server

### Phase 3: Client Hardening (Week 3)
**Priority: Graceful UI degradation**

- [ ] React error boundaries
- [ ] Standardized API calls with retry
- [ ] Offline mode detection
- [ ] User-friendly error messages
- [ ] Loading states for all operations

**Success Criteria:**
- One component error doesn't break entire UI
- Network failures show helpful messages
- Users can continue working when offline

### Phase 4: Maintenance & Cleanup (Week 4)
**Priority: Long-term system health**

- [ ] Orphaned file cleanup
- [ ] Session timeout and cleanup
- [ ] Memory leak detection
- [ ] Performance monitoring
- [ ] Log rotation

**Success Criteria:**
- System runs indefinitely without manual intervention
- No resource leaks over time
- Automatic cleanup of old data

### Phase 5: Testing & Documentation (Week 5)
**Priority: Comprehensive coverage**

- [ ] Unit tests for all validators
- [ ] Integration tests for error scenarios
- [ ] Load testing with error injection
- [ ] Documentation of all error codes
- [ ] Runbooks for common issues

**Success Criteria:**
- 90%+ test coverage of error paths
- All error codes documented
- Team can diagnose issues quickly

---

## Testing Strategy

### Error Injection Testing

**Create test utility:**
```javascript
// server/tests/utils/error-injector.js

class ErrorInjector {
  constructor() {
    this.enabled = false;
    this.scenarios = new Map();
  }
  
  enable() {
    this.enabled = true;
  }
  
  disable() {
    this.enabled = false;
    this.scenarios.clear();
  }
  
  inject(scenarioName, errorFn) {
    if (this.enabled && this.scenarios.has(scenarioName)) {
      const scenario = this.scenarios.get(scenarioName);
      if (scenario.shouldFail()) {
        throw errorFn();
      }
    }
  }
  
  addScenario(name, config) {
    const {
      failureRate = 0.5, // 50% failure rate
      errorType = Error,
      errorMessage = 'Injected error'
    } = config;
    
    this.scenarios.set(name, {
      shouldFail: () => Math.random() < failureRate,
      error: () => new errorType(errorMessage)
    });
  }
}

const errorInjector = new ErrorInjector();

// Use in tests
describe('Error Handling', () => {
  beforeAll(() => errorInjector.enable());
  afterAll(() => errorInjector.disable());
  
  it('handles file write failures', async () => {
    errorInjector.addScenario('file_write', {
      failureRate: 1.0,
      errorType: Error,
      errorMessage: 'ENOSPC: no space left on device'
    });
    
    // Test should handle error gracefully
    await expect(saveDocument()).rejects.toThrow('DISK_FULL');
  });
});
```

### Load Testing with Chaos

**Use Artillery with chaos:**
```yaml
# server/tests/load/chaos-test.yml
config:
  target: 'https://localhost:4001'
  phases:
    - duration: 300 # 5 minutes
      arrivalRate: 10
      name: "Sustained load"
  processor: "./chaos-processor.js"

scenarios:
  - name: "Normal operations with chaos"
    flow:
      - post:
          url: "/api/v1/check-in"
          json:
            userId: "user1"
            platform: "web"
          afterResponse: "injectChaos"
      
      - think: 2
      
      - post:
          url: "/api/v1/check-out"
          json:
            userId: "user1"
            platform: "web"
```

```javascript
// server/tests/load/chaos-processor.js
module.exports = {
  injectChaos: (req, res, context, events, done) => {
    const chaos = Math.random();
    
    // 10% chance of network timeout
    if (chaos < 0.1) {
      setTimeout(() => done(), 35000); // Trigger timeout
      return;
    }
    
    // 5% chance of abrupt connection close
    if (chaos < 0.15) {
      req.destroy();
      return;
    }
    
    done();
  }
};
```

---

## Monitoring & Observability

### Structured Logging

**Implement logger:**
```javascript
// server/src/utils/logger.js

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'wordftw-server',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Convenience methods
logger.logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    code: error.code,
    stack: error.stack,
    ...context
  });
};

logger.logRequest = (req, duration, statusCode) => {
  logger.info({
    type: 'http_request',
    method: req.method,
    path: req.path,
    userId: req.body?.userId || req.query?.userId,
    duration,
    statusCode
  });
};

module.exports = logger;
```

**Use in middleware:**
```javascript
const logger = require('./utils/logger');

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, duration, res.statusCode);
  });
  
  next();
});
```

### Metrics Collection

**Track key metrics:**
```javascript
// server/src/utils/metrics.js

class Metrics {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }
  
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }
  
  setGauge(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }
  
  recordHistogram(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(value);
  }
  
  getKey(name, labels) {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  
  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          {
            count: v.length,
            min: Math.min(...v),
            max: Math.max(...v),
            avg: v.reduce((a, b) => a + b, 0) / v.length,
            p95: this.percentile(v, 0.95),
            p99: this.percentile(v, 0.99)
          }
        ])
      )
    };
  }
  
  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}

const metrics = new Metrics();

// Track common metrics
metrics.incrementCounter('server_starts');
metrics.setGauge('active_sessions', 0);

// Expose metrics endpoint
app.get('/api/v1/metrics', (req, res) => {
  res.json({
    ...metrics.getMetrics(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
});

module.exports = { metrics };
```

---

## Success Criteria

### Reliability Metrics
- ✅ **99.9% uptime** - Server stays running under normal conditions
- ✅ **0% data corruption** - All state transitions are atomic
- ✅ **95%+ operation success rate** - Operations complete or rollback cleanly
- ✅ **< 1s recovery time** - System recovers from transient errors quickly

### Error Handling Metrics
- ✅ **100% error resolution** - Every error has actionable steps
- ✅ **< 5s user feedback** - Users see helpful errors within 5 seconds
- ✅ **90%+ self-service** - Users can resolve issues without support
- ✅ **0 silent failures** - All failures are logged and reported

### Testing Metrics
- ✅ **90%+ error path coverage** - All error scenarios tested
- ✅ **37+ installation tests** - Full install/uninstall coverage
- ✅ **100+ API endpoint tests** - All endpoints tested with error injection
- ✅ **50+ integration tests** - End-to-end failure scenarios

### Performance Metrics
- ✅ **< 100ms p95 response time** - Most requests complete quickly
- ✅ **< 1% memory growth/hour** - No memory leaks
- ✅ **< 10GB disk growth/day** - Cleanup working effectively
- ✅ **< 5% CPU idle load** - Efficient background tasks

---

## Rollout Plan

### Week 1: Foundation
- Implement startup checks
- Add graceful shutdown
- Create error handling framework
- Add state validation

**Risk**: Breaking existing functionality  
**Mitigation**: Feature flags, staged rollout

### Week 2: API Layer
- Roll out input validation
- Implement rate limiting
- Add retry logic
- Deploy circuit breakers

**Risk**: Increased latency  
**Mitigation**: Monitor p95 latency, adjust thresholds

### Week 3: Client Layer
- Deploy error boundaries
- Update API client
- Add offline detection
- Improve error messages

**Risk**: UI regressions  
**Mitigation**: Comprehensive UI testing

### Week 4: Automation
- Deploy cleanup schedulers
- Enable session management
- Activate monitoring
- Start collecting metrics

**Risk**: Resource usage increase  
**Mitigation**: Monitor CPU/memory, tune intervals

### Week 5: Verification
- Run full test suite
- Perform load testing
- Conduct chaos testing
- Update documentation

**Risk**: Uncaught edge cases  
**Mitigation**: Gradual rollout, monitoring

---

## Related Documents

- `features/addin-installation-hardening.md` - Installation-specific hardening
- `features/automated-testing-suite.md` - Testing strategy
- `architecture/state-machine.md` - State management rules
- `features/version-sharing.md` - Version access control
- `operations/deployment.md` - Deployment procedures

---

**Total Estimated Time:** 5 weeks  
**Priority Order:** Critical Infrastructure → API → Client → Maintenance → Testing  
**Success Measure:** System runs reliably for 30+ days without intervention


