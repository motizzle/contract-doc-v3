/**
 * Input Validation Middleware
 * 
 * Provides Joi-based validation for all API endpoints
 * Returns 400 with actionable error messages on validation failure
 */

const Joi = require('joi');

/**
 * Validation schemas for common types
 */
const schemas = {
  // User/session identifiers
  userId: Joi.string().min(1).max(100).required(),
  sessionId: Joi.string().min(1).max(100).optional(),
  platform: Joi.string().valid('web', 'word').required(),
  
  // Document operations
  checkout: Joi.object({
    userId: Joi.string().min(1).max(100).required(),
    clientVersion: Joi.number().integer().min(0).optional(),
    forceCheckout: Joi.boolean().optional()
  }),
  
  checkin: Joi.object({
    userId: Joi.string().min(1).max(100).required()
  }),
  
  saveProgress: Joi.object({
    userId: Joi.string().min(1).max(100).required(),
    base64: Joi.string().required().custom((value, helpers) => {
      // Validate base64 string (basic check)
      if (!/^[A-Za-z0-9+/=]+$/.test(value)) {
        return helpers.error('any.invalid');
      }
      // Check minimum size (at least 1KB encoded)
      if (value.length < 1400) {
        return helpers.error('string.min');
      }
      return value;
    }),
    platform: Joi.string().valid('web', 'word').optional()
  }),
  
  // Version operations
  versionView: Joi.object({
    userId: Joi.string().min(1).max(100).required(),
    version: Joi.number().integer().min(1).required()
  }),
  
  versionShare: Joi.object({
    userId: Joi.string().min(1).max(100).required(),
    shared: Joi.boolean().required()
  }),
  
  // Variables
  createVariable: Joi.object({
    type: Joi.string().valid('text', 'number', 'date', 'dropdown').required(),
    displayLabel: Joi.string().min(1).max(100).required(),
    value: Joi.string().max(1000).allow('').required(),
    userId: Joi.string().min(1).max(100).optional()
  }),
  
  updateVariable: Joi.object({
    displayLabel: Joi.string().min(1).max(100).optional(),
    type: Joi.string().valid('text', 'number', 'date', 'dropdown').optional(),
    userId: Joi.string().min(1).max(100).optional()
  }),
  
  updateVariableValue: Joi.object({
    value: Joi.string().max(1000).allow('').required(),
    userId: Joi.string().min(1).max(100).optional()
  }),
  
  // Approvals
  setApproval: Joi.object({
    userId: Joi.string().min(1).max(100).required(),
    targetUserId: Joi.string().min(1).max(100).optional(),
    approval: Joi.boolean().required(),
    notes: Joi.string().max(500).allow('').optional()
  }),
  
  // Scenarios
  saveScenario: Joi.object({
    name: Joi.string().min(3).max(50).required(),
    description: Joi.string().max(200).allow('').optional(),
    userId: Joi.string().min(1).max(100).optional()
  }),
  
  // Messages
  sendMessage: Joi.object({
    userId: Joi.string().min(1).max(100).required(),
    recipientIds: Joi.array().items(Joi.string().min(1).max(100)).min(1).required(),
    text: Joi.string().min(1).max(2000).required()
  }),
  
  // Title update
  updateTitle: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    userId: Joi.string().min(1).max(100).optional()
  }),
  
  // Compile
  compile: Joi.object({
    exhibits: Joi.array().items(Joi.string()).max(5).optional(),
    userId: Joi.string().min(1).max(100).optional()
  })
};

/**
 * Validation middleware factory
 * @param {string} schemaName - Name of the schema to validate against
 * @param {string} source - Where to get the data ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
function validate(schemaName, source = 'body') {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      console.error(`❌ [Validation] Unknown schema: ${schemaName}`);
      return res.status(500).json({
        ok: false,
        error: 'VALIDATION_CONFIG_ERROR',
        message: 'Server validation configuration error'
      });
    }
    
    const data = req[source] || {};
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all errors
      stripUnknown: true // Remove unknown fields
    });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));
      
      // Create actionable error message
      const firstError = details[0];
      let resolution = 'Please check your input and try again.';
      
      if (firstError.type === 'any.required') {
        resolution = `The field '${firstError.field}' is required.`;
      } else if (firstError.type === 'string.min') {
        resolution = `The field '${firstError.field}' is too short.`;
      } else if (firstError.type === 'string.max') {
        resolution = `The field '${firstError.field}' is too long.`;
      } else if (firstError.type === 'any.only') {
        resolution = `The field '${firstError.field}' contains an invalid value.`;
      }
      
      console.log(`⚠️  [Validation] Failed for ${req.method} ${req.path}:`, firstError.field, firstError.message);
      
      return res.status(400).json({
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        resolution,
        details: process.env.NODE_ENV === 'development' ? details : undefined
      });
    }
    
    // Replace req data with validated and sanitized data
    req[source] = value;
    next();
  };
}

/**
 * Version number parameter validator
 */
function validateVersionParam(req, res, next) {
  const versionNum = parseInt(req.params.n, 10);
  
  if (isNaN(versionNum) || versionNum < 1 || versionNum > 1000) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_VERSION',
      message: 'Invalid version number',
      resolution: 'Version must be a positive integer between 1 and 1000.'
    });
  }
  
  req.versionNumber = versionNum;
  next();
}

/**
 * Variable ID parameter validator
 */
function validateVarIdParam(req, res, next) {
  const varId = req.params.varId;
  
  if (!varId || typeof varId !== 'string' || varId.length > 100) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_VARIABLE_ID',
      message: 'Invalid variable ID',
      resolution: 'Variable ID must be a valid string.'
    });
  }
  
  next();
}

module.exports = {
  validate,
  validateVersionParam,
  validateVarIdParam,
  schemas
};

