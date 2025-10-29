/**
 * Input Validation Middleware (DISABLED)
 * 
 * Input validation has been completely disabled.
 * All validation middleware now passes through without validation.
 * 
 * The validation schemas were written based on assumptions
 * rather than actual API contracts, causing production issues:
 * - Approvals broken (400 errors)
 * - Messages broken (400 errors)
 * - Likely other endpoints broken
 * 
 * To re-enable validation properly:
 * 1. Audit each endpoint to see what data it actually receives
 * 2. Write schemas that match the real API contracts
 * 3. Test thoroughly before deploying
 */

/**
 * No-op validation middleware - passes all requests through
 */
const noOpValidate = (schemaName) => (req, res, next) => next();

/**
 * Parameter validation - parses params but doesn't validate
 */
const validateVersionParam = (req, res, next) => {
  // Parse version number from :n parameter
  const n = parseInt(req.params.n, 10);
  req.versionNumber = isNaN(n) ? undefined : n;
  next();
};

const validateVarIdParam = (req, res, next) => {
  // Parse variable ID from :varId parameter
  req.varId = req.params.varId;
  next();
};

// Export middleware
const validate = noOpValidate;

module.exports = {
  validate,
  validateVersionParam,
  validateVarIdParam
};
