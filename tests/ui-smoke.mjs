import { chromium } from "playwright";
import assert from "node:assert/strict";
import http from "node:http";
const stamp = Date.now();
const base = process.env.DOT_TEST_URL || "http://127.0.0.1:3310";
const errors = [];
const mock = http.createServer(async (req, res) => {
  for await (const chunk of req) {
    void chunk;
  }
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      id: "mock",
      object: "chat.completion",
      created: 1,
      model: "demo-deployment",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "Mock provider connected successfully.",
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
  );
});
await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
try {
  assert.equal(
    (await context.request.get(base + "/api/session")).status(),
    401,
  );
  await page.goto(base + "/settings");
  await page.waitForURL("**/login");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-open-dot-123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(base + "/");
  assert.equal(
    (await context.request.get(base + "/api/session")).status(),
    200,
  );
  assert.equal(
    (
      await context.request.post(base + "/api/auth/logout", {
        headers: { origin: "https://evil.example" },
      })
    ).status(),
    403,
  );
  await page.goto(base + "/settings");
  await page
    .getByRole("heading", { name: "Custom API providers", exact: true })
    .waitFor();
  const form = page
    .getByRole("heading", { name: "Custom API providers", exact: true })
    .locator("..");
  await form.getByLabel("Name", { exact: true }).fill("UI mock " + Date.now());
  await form
    .getByLabel("API base URL", { exact: true })
    .fill(`http://127.0.0.1:${mock.address().port}/v1`);
  await form.getByLabel("Authentication", { exact: true }).selectOption("none");
  await form
    .getByLabel("Model / deployment names", { exact: true })
    .fill("demo-deployment");
  await form.getByRole("button", { name: "Add provider", exact: true }).click();
  await form.getByText("Provider saved.", { exact: false }).waitFor();
  await form
    .getByRole("button", { name: "Test connection", exact: true })
    .last()
    .click();
  await form.getByText("Connection verified", { exact: false }).waitFor();
  await form.screenshot({ path: "/private/tmp/open-dot-work/providers.png" });
  await page.goto(base + "/new");
  await page.getByLabel("Name", { exact: true }).fill("Smoke Dot");
  await page
    .getByRole("button", { name: "Create Smoke Dot", exact: true })
    .click();
  await page.waitForURL("**/dots/**");
  await page.getByPlaceholder("Message Smoke Dot…").fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByText("Mock provider connected successfully.", { exact: true })
    .waitFor();
  await page.goto(base + "/tasks");
  await page
    .getByRole("heading", { name: "Task dashboard", exact: true })
    .waitFor();
  await page.screenshot({ path: "/private/tmp/open-dot-work/dashboard.png" });
  await page.goto(base + "/workflows");
  await page.getByRole("heading", { name: "Workflows", exact: true }).waitFor();
  await page.goto(base + "/settings");
  await page.getByRole("heading", { name: /Workspace ·/ }).waitFor();
  const workspace = page
    .getByRole("heading", { name: /Workspace ·/ })
    .locator("..");
  await workspace
    .getByLabel("Username", { exact: true })
    .fill("readonly" + stamp);
  await workspace
    .getByLabel("Initial password", { exact: true })
    .fill("test-viewer-password-12345");
  await workspace.getByLabel("Role", { exact: true }).selectOption("viewer");
  await workspace
    .getByRole("button", { name: "Add member", exact: true })
    .click();
  await workspace.getByText("Member created", { exact: true }).waitFor();
  const viewer = await browser.newContext();
  assert.equal(
    (
      await viewer.request.post(base + "/api/auth/login", {
        form: {
          username: "readonly" + stamp,
          password: "test-viewer-password-12345",
        },
      })
    ).status(),
    200,
  );
  assert.equal((await viewer.request.get(base + "/settings")).status(), 403);
  assert.equal(
    (
      await viewer.request.post(base + "/api/knowledge", { data: "x" })
    ).status(),
    403,
  );
  assert.equal(
    (
      await viewer.request.post(base + "/api/knowledge", {
        headers: { "next-action": "spoofed" },
        data: "x",
      })
    ).status(),
    403,
  );
  assert.equal(
    (await viewer.request.post(base + "/api/auth/logout")).status(),
    200,
  );
  await viewer.close();
  assert.deepEqual(errors, []);
  console.log(
    "UI smoke passed: login, CSRF, provider save/test, dot creation, dashboard, workflows, membership and viewer denial.",
  );
} finally {
  await browser.close();
  mock.close();
}
