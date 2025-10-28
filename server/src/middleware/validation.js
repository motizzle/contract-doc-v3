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
 * No-op parameter validation - passes all requests through
 */
const noOpParamValidate = (req, res, next) => next();

// Export no-op middleware
const validate = noOpValidate;
const validateVersionParam = noOpParamValidate;
const validateVarIdParam = noOpParamValidate;

module.exports = {
  validate,
  validateVersionParam,
  validateVarIdParam
};
