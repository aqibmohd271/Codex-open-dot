import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-paths-"));
process.env.DOTS_DATA_DIR = dir;
const { workspaceDir, resolveWorkspacePath } = await import(
  "../src/server/computer/shell.ts"
);
test("workspace boundaries reject prefix and symlink escapes", () => {
  const root = workspaceDir("dot");
  assert.throws(() => workspaceDir("../escape"));
  assert.throws(() =>
    resolveWorkspacePath("dot", "../workspace-other/private"),
  );
  symlinkSync(os.tmpdir(), path.join(root, "escape"));
  assert.throws(() => resolveWorkspacePath("dot", "escape/private"));
  assert.equal(
    resolveWorkspacePath("dot", "report.txt"),
    path.join(root, "report.txt"),
  );
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
