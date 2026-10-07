import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-exec-"));
process.env.DOTS_DATA_DIR = dir;
const { executeOnce, retryRead } = await import("../src/server/execution.ts");
test("side effects execute once; ambiguous outcomes block new call IDs", async () => {
  let count = 0;
  const fn = async () => {
    count++;
    return "sent";
  };
  assert.equal(
    await executeOnce("dot", "one", "send", { to: "a" }, fn),
    "sent",
  );
  assert.equal(
    await executeOnce("dot", "one", "send", { to: "a" }, fn),
    "sent",
  );
  assert.equal(count, 1);
  await assert.rejects(
    () => executeOnce("dot", "one", "send", { to: "b" }, fn),
    /changed/,
  );
  await assert.rejects(() =>
    executeOnce("dot", "two", "send", { to: "c" }, async () => {
      throw new Error("connection lost");
    }),
  );
  await assert.rejects(
    () => executeOnce("dot", "three", "send", { to: "c" }, fn),
    /may already/,
  );
  assert.equal(count, 1);
});
test("only transient read failures retry and cancellation interrupts backoff", async () => {
  let attempts = 0;
  assert.equal(
    await retryRead(async () => {
      if (++attempts === 1) throw { status: 503 };
      return "ok";
    }, new AbortController().signal),
    "ok",
  );
  assert.equal(attempts, 2);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(() => retryRead(async () => 1, abort.signal));
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
