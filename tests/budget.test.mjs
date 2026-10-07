import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-budget-"));
process.env.DOTS_DATA_DIR = dir;
const b = await import("../src/server/budget.ts");
test("budgets reject unknown prices and reserve uncertain requests", () => {
  b.saveBudget({
    ...b.defaultBudget,
    enabled: true,
    dailyPerDot: 0.02,
    perTask: 0.02,
    maxOutputTokens: 100,
    prices: { model: { input: 1, output: 2 } },
  });
  assert.throws(
    () => b.reserveRequest("dot", "unknown", { model: "unknown", input: "hi" }),
    /prices/,
  );
  const r = b.reserveRequest("dot", "model", { model: "model", input: "hi" });
  assert.ok(b.usageSummary()[0].reserved > 0);
  b.recordUsage(r, { usage: { input_tokens: 1000, output_tokens: 500 } });
  assert.equal(b.usageSummary()[0].cost, 0.002);
  assert.equal(b.usageSummary()[0].reserved, 0);
  assert.throws(
    () =>
      b.reserveRequest("dot", "model", {
        model: "model",
        input: "x".repeat(30000),
      }),
    /exceed/,
  );
  assert.throws(
    () =>
      b.reserveRequest("dot", "model", {
        model: "model",
        previous_response_id: "opaque",
        input: "hi",
      }),
    /local text history/,
  );
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
