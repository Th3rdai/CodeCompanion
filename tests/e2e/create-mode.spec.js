const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const browserAppReady = require("../helpers/app-ready.js");
const { createModeTab } = require("../helpers/mode-tabs.js");

async function reloadAndWaitForModels(page) {
  const modelsPromise = page.waitForResponse(
    (r) => r.url().includes("/api/models"),
    { timeout: 30_000 },
  );
  await page.reload();
  await modelsPromise;
  await page.waitForSelector("#model-select", {
    state: "visible",
    timeout: 30_000,
  });
}

function slugify(value) {
  return (
    String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 64) || "new-project"
  );
}

async function getAllowedRoot(request) {
  const base = (process.env.BASE_URL || "http://127.0.0.1:4173").replace(
    /\/$/,
    "",
  );
  const configResponse = await request.get(`${base}/api/config`);
  expect(configResponse.ok()).toBeTruthy();
  const config = await configResponse.json();
  const outputRoot =
    config.createModeAllowedRoots?.[0] || path.join(os.homedir(), "AI_Dev");
  fs.mkdirSync(outputRoot, { recursive: true });
  return outputRoot;
}

async function openCreateMode(page) {
  await page.addInitScript(browserAppReady);
  await page.goto("/");
  await reloadAndWaitForModels(page);
  await expect(page.getByTestId("mode-tab-create")).toBeVisible({
    timeout: 30_000,
  });
  await createModeTab(page).click();
}

test("Create mode renders when models endpoint fails", async ({ page }) => {
  await page.route("**/api/models", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Ollama offline" }),
    }),
  );

  await openCreateMode(page);
  await expect(
    page.getByRole("form", { name: "Create project wizard" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Project Info" }),
  ).toBeVisible();
});

test("wizard creates project and opens it in file browser", async ({
  page,
  request,
}) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Create ${Date.now()}`;
  const projectSlug = slugify(projectName);
  const projectPath = path.join(outputRoot, projectSlug);

  try {
    await openCreateMode(page);

    await page.getByLabel("Project name").fill(projectName);
    await page
      .getByLabel("Description")
      .fill("Create mode end-to-end validation project");
    await page
      .getByLabel("AI role")
      .fill("A PM-focused project setup assistant");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Target audience").fill("Product managers");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel(/Parent folder/).fill(outputRoot);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(
      page.getByRole("heading", { name: "Your project is ready!" }),
    ).toBeVisible();
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("API guardrails reject duplicate and invalid-root creates", async ({
  request,
}) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Duplicate ${Date.now()}`;
  const payload = {
    name: projectName,
    description: "API guardrail test",
    role: "Validation assistant",
    audience: "PM",
    tone: "Professional",
    stages: [
      { name: "Research", purpose: "Gather context" },
      { name: "Draft", purpose: "Create draft output" },
      { name: "Review", purpose: "Finalize output" },
    ],
    outputRoot,
    overwrite: false,
  };

  const projectPath = path.join(outputRoot, slugify(projectName));

  try {
    const firstCreate = await request.post("/api/create-project", {
      data: payload,
    });
    expect(firstCreate.status()).toBe(201);

    const duplicateCreate = await request.post("/api/create-project", {
      data: payload,
    });
    expect(duplicateCreate.status()).toBe(409);
    const duplicateJson = await duplicateCreate.json();
    expect(duplicateJson.code).toBe("ALREADY_EXISTS");

    const invalidRootCreate = await request.post("/api/create-project", {
      data: {
        ...payload,
        name: `${projectName}-bad-root`,
        outputRoot: os.tmpdir(),
      },
    });
    expect(invalidRootCreate.status()).toBe(403);
    const invalidRootJson = await invalidRootCreate.json();
    expect(invalidRootJson.code).toBe("PATH_OUTSIDE_ROOT");
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});
