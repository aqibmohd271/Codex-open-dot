import { test } from "node:test";
import assert from "node:assert/strict";
import { selectModel, defaultRouting } from "../src/server/routing.ts";
test("routing is explicit and deterministic", () => {
  const c = {
    ...defaultRouting,
    enabled: true,
    simple: "cheap",
    complex: "strong",
    threshold: 100,
  };
  assert.equal(selectModel(c, "Hello", "default"), "cheap");
  assert.equal(selectModel(c, "Debug this", "default"), "strong");
  assert.equal(selectModel(c, "x".repeat(100), "default"), "strong");
  assert.equal(
    selectModel({ ...c, enabled: false }, "Debug", "default"),
    "default",
  );
});
