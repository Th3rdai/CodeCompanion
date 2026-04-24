/**
 * Mode tabs use data-testid="mode-tab-{id}" (see App.jsx). Prefer these over role+name
 * so Playwright does not match sidebar history or in-panel copy containing "Review".
 * Secondary modes live under the "More" menu; open it before clicking those tabs.
 */
async function openMoreModesMenu(page) {
  await page.getByTestId("mode-tab-more").click();
}

function reviewModeTab(page) {
  return page.getByTestId("mode-tab-review");
}
function securityModeTab(page) {
  return page.getByTestId("mode-tab-pentest");
}
function createModeTab(page) {
  return page.getByTestId("mode-tab-create");
}
function promptingModeTab(page) {
  return page.getByTestId("mode-tab-prompting");
}

module.exports = {
  openMoreModesMenu,
  reviewModeTab,
  securityModeTab,
  createModeTab,
  promptingModeTab,
};
