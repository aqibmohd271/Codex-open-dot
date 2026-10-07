import { test } from "node:test";
import assert from "node:assert/strict";
import { browserIssue } from "../src/server/browser-recovery.ts";
test("browser recovery detects actionable blockers", () => {
  assert.match(browserIssue("Your session has expired"), /Sign in/);
  assert.match(browserIssue("Verify you are human"), /verification/);
  assert.match(browserIssue("Timeout 30000ms exceeded"), /page changed/);
  assert.equal(browserIssue("Welcome to our store"), null);
});
