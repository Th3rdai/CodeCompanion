/**
 * Splash + onboarding gates hide the main shell (#model-select, mode tabs).
 * Use with page.addInitScript(browserAppReady) before the first goto to this origin,
 * or page.evaluate(browserAppReady) before reload.
 */
function browserAppReady() {
  sessionStorage.setItem("th3rdai_splash_dismissed", "true");
  localStorage.setItem("th3rdai_onboarding_complete", "true");
}

module.exports = browserAppReady;
