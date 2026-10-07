import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-memory-"));
process.env.DOTS_DATA_DIR = dir;
const repo = await import("../src/server/repo.ts");
test("memory edit and project isolation", () => {
  const a = repo.createDot({ name: "A", purpose: "", look: {} }),
    b = repo.createDot({ name: "B", purpose: "", look: {} });
  repo.updateDot(a.id, { projectId: "one" });
  repo.updateDot(b.id, { projectId: "two" });
  const m = repo.addMemory(a.id, "Secret project", "project");
  repo.addMemory(a.id, "Personal preference", "personal");
  assert.equal(repo.listMemories(b.id).length, 1);
  repo.editMemory(m.id, "Corrected");
  assert.ok(repo.listMemories(a.id).some((x) => x.text === "Corrected"));
  repo.updateDot(b.id, { projectId: "one" });
  assert.equal(repo.listMemories(b.id).length, 2);
  repo.deleteMemory(m.id);
  assert.equal(repo.listMemories(b.id).length, 1);
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
