import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-backup-"));
process.env.DOTS_DATA_DIR = dir;
const b = await import("../src/server/backup.ts");
const { db, setSetting } = await import("../src/server/db.ts");
test("backup excludes credentials; restore is transactional and rejects paths", () => {
  db()
    .prepare("INSERT INTO dots(id,name,look,created_at) VALUES('a','A','{}',1)")
    .run();
  setSetting("openai_key", "SECRET");
  const copy = b.exportBackup();
  assert.ok(!JSON.stringify(copy).includes("SECRET"));
  assert.equal(copy.tables.dots[0].status, "paused");
  assert.throws(() => b.restoreBackup(copy), /empty/);
  db().prepare("DELETE FROM dots").run();
  assert.throws(
    () => b.restoreBackup({ ...copy, files: { "../escape": "YQ==" } }),
    /path/,
  );
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM dots").get().n, 0);
  assert.throws(
    () =>
      b.restoreBackup({
        ...copy,
        tables: {
          ...copy.tables,
          dots: [...copy.tables.dots, ...copy.tables.dots],
        },
      }),
    /UNIQUE/,
  );
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM dots").get().n, 0);
  b.restoreBackup(copy);
  assert.equal(db().prepare("SELECT name,status FROM dots").get().name, "A");
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
