/**
 * Mode tabs use data-testid="mode-tab-{id}" (see App.jsx). Prefer these over role+name
 * so Playwright does not match sidebar history or in-panel copy containing "Review".
 */
function reviewModeTab(page) {
  return page.getByTestId('mode-tab-review');
}
function securityModeTab(page) {
  return page.getByTestId('mode-tab-pentest');
}
function createModeTab(page) {
  return page.getByTestId('mode-tab-create');
}
function promptingModeTab(page) {
  return page.getByTestId('mode-tab-prompting');
}

module.exports = { reviewModeTab, securityModeTab, createModeTab, promptingModeTab };
