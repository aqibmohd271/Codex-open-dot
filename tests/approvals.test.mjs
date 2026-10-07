import { test } from "node:test";
import assert from "node:assert/strict";
import { checkApproval, approvalDetails } from "../src/server/approvals.ts";
import { fingerprint } from "../src/server/execution.ts";
test("approval is bound to exact action and expires", () => {
  const call = { name: "send", arguments: '{"to":"a","body":"Hello"}' };
  const card = { expiresAt: 200, actionHash: fingerprint(call) };
  assert.doesNotThrow(() => checkApproval(card, call, 100));
  assert.throws(
    () => checkApproval(card, { ...call, arguments: '{"to":"b"}' }, 100),
    /changed/,
  );
  assert.throws(() => checkApproval(card, call, 200), /expired/);
  assert.throws(() => checkApproval({}, call), /expired/);
  assert.ok(!approvalDetails({ apiKey: "SECRET" }).includes("SECRET"));
});
