/**
 * License Middleware for Code Companion Pro
 *
 * Express middleware factory that gates routes by feature tier.
 * Uses the declarative FEATURE_TIERS registry from license-manager.
 */

const { isFeatureAllowed, getTier, FEATURE_TIERS } = require('./license-manager');

/**
 * Creates middleware that blocks requests if the current license tier
 * doesn't include the specified feature.
 *
 * @param {string} featureId - Feature ID from FEATURE_TIERS (e.g., 'mode:prompting')
 * @returns {Function} Express middleware
 */
function requireTier(featureId) {
  return (req, res, next) => {
    if (isFeatureAllowed(featureId)) return next();
    res.status(403).json({
      error: 'upgrade_required',
      feature: featureId,
      currentTier: getTier(),
      requiredTier: FEATURE_TIERS[featureId] || 'pro',
      message: 'This feature is available in Code Companion Pro',
    });
  };
}

/**
 * Middleware that checks the mode field in the request body against
 * the feature tier registry. Use on multi-mode endpoints like /api/chat.
 */
function requireTierForMode(req, res, next) {
  const mode = req.body?.mode;
  if (!mode) return next(); // No mode specified, let the route handler deal with it
  const featureId = `mode:${mode}`;
  if (isFeatureAllowed(featureId)) return next();
  res.status(403).json({
    error: 'upgrade_required',
    feature: featureId,
    currentTier: getTier(),
    requiredTier: FEATURE_TIERS[featureId] || 'pro',
    message: 'This feature is available in Code Companion Pro',
  });
}

module.exports = { requireTier, requireTierForMode };
