import { test } from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence, duePolicy } from "../src/server/schedule-policy.ts";
test("schedules honor explicit time zones and validate input", () => {
  const now = new Date("2026-10-04T00:00:00Z");
  assert.equal(
    new Date(nextOccurrence("0 8 * * *", "Asia/Dubai", now)).toISOString(),
    "2026-10-04T04:00:00.000Z",
  );
  assert.throws(() => nextOccurrence("bad", "UTC"));
  assert.throws(() => nextOccurrence("0 8 * * *", "Not/AZone"));
});
test("missed schedules catch up once or skip; future runs never dispatch", () => {
  assert.equal(duePolicy(1000, 200000, "skip"), "skipped");
  assert.equal(duePolicy(1000, 200000, "catch-up"), "dispatch");
  assert.equal(duePolicy(300000, 200000, "catch-up"), "future");
});
