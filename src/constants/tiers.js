/**
 * Frontend tier constants — mirrors FEATURE_TIERS from lib/license-manager.js
 *
 * Single source of truth for which modes require Pro on the frontend.
 * If a mode isn't listed here, it defaults to 'free'.
 */

export const MODE_TIERS = {
  chat: 'free',
  explain: 'free',
  bugs: 'free',
  refactor: 'free',
  'translate-tech': 'free',
  'translate-biz': 'free',
  review: 'free',
  prompting: 'free',
  skillz: 'pro',
  agentic: 'pro',
  create: 'free',
};

export function isModeLocked(modeId, licenseInfo) {
  const required = MODE_TIERS[modeId] || 'free';
  if (required === 'free') return false;
  if (licenseInfo?.features?.includes(modeId)) return false;
  if (licenseInfo?.tier === 'pro') return false;
  return true;
}
