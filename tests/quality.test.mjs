import { test } from "node:test";
import assert from "node:assert/strict";
import { exitFromEvidence } from "../src/server/quality.ts";
test("verification needs a real completion marker", () => {
  assert.equal(exitFromEvidence("All tests passed", "CHECK"), null);
  assert.equal(exitFromEvidence("CHECK:0", "CHECK"), 0);
  assert.equal(exitFromEvidence("CHECK:2", "CHECK"), 2);
});
