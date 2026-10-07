import "server-only";
import fs from "node:fs";
import path from "node:path";
import { budgetConfig, saveBudget, type BudgetConfig } from "./budget";
import { routingConfig, saveRouting, type RoutingConfig } from "./routing";
import { db, DATA_DIR } from "./db";
import { listTasks } from "./tasks";
import { listWorkflows } from "./workflows";
import { listDocuments } from "./knowledge";
const TABLES = [
  "dots",
  "messages",
  "conversations",
  "memories",
  "skills",
  "rules",
  "routines",
  "channels",
  "files",
  "tasks",
  "workflows",
  "workflow_runs",
  "knowledge_docs",
  "knowledge_chunks",
] as const;
type Backup = {
  settings?: { budget: BudgetConfig; routing: RoutingConfig };
  version: 1;
  createdAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: Record<string, string>;
};
function initialize() {
  listTasks();
  listWorkflows();
  listDocuments("");
}
export function exportBackup(): Backup {
  initialize();
  const tables: Backup["tables"] = {};
  for (const table of TABLES)
    tables[table] = db()
      .prepare(`SELECT * FROM ${table}`)
      .all()
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            v instanceof Uint8Array
              ? { base64: Buffer.from(v).toString("base64") }
              : v,
          ]),
        ),
      );
  const files: Record<string, string> = {};
  let bytes = 0;
  for (const row of tables.files) {
    const id = String(row.id);
    if (!/^file_[a-zA-Z0-9]+$/.test(id))
      throw new Error("Invalid attachment identifier");
    const p = path.join(DATA_DIR, "files", id);
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p);
      bytes += data.length;
      if (bytes > 100 * 1024 * 1024)
        throw new Error("Attached files exceed the 100 MB backup limit");
      files[id] = data.toString("base64");
    }
  }
  // Credentials, saved website passwords, sessions, browser profiles and remote computer state are intentionally excluded.
  for (const d of tables.dots) {
    d.thread = null;
    d.pending = null;
    d.box_id = null;
    d.model = null;
    d.local_access = 0;
    d.status = "paused";
  }
  for (const c of tables.conversations) {
    c.thread = null;
    c.pending = null;
    c.history = null;
  }
  for (const r of tables.routines) {
    r.enabled = 0;
    r.next_due = null;
  }
  for (const m of tables.messages)
    if (m.card) {
      const card = JSON.parse(String(m.card));
      if (card.status === "pending") card.status = "expired";
      m.card = JSON.stringify(card);
    }
  for (const t of tables.tasks)
    if (["running", "queued", "waiting"].includes(String(t.status)))
      t.status = "interrupted";
  for (const w of tables.workflow_runs) {
    const data = JSON.parse(String(w.data));
    if (["running", "review"].includes(data.status)) data.status = "stopped";
    w.data = JSON.stringify(data);
  }
  return {
    settings: { budget: budgetConfig(), routing: routingConfig() },
    version: 1,
    createdAt: new Date().toISOString(),
    tables,
    files,
  };
}
export function restoreBackup(value: unknown) {
  initialize();
  if (db().prepare("SELECT id FROM dots LIMIT 1").get())
    throw new Error(
      "Restore is only allowed in an empty workspace. Existing work will not be overwritten.",
    );
  const b = value as Backup;
  if (
    !b ||
    b.version !== 1 ||
    !b.tables ||
    !b.files ||
    typeof b.files !== "object"
  )
    throw new Error("Unsupported backup");
  if (
    Object.keys(b.tables).some(
      (t) => !TABLES.includes(t as (typeof TABLES)[number]),
    )
  )
    throw new Error("Backup contains an unsupported table");
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  for (const table of TABLES) {
    const rows = b.tables[table] ?? [];
    if (!Array.isArray(rows) || rows.length > 50000)
      throw new Error("Invalid table data");
    const cols = new Set(
      db()
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((r) => String(r.name)),
    );
    for (const row of rows) {
      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        Object.keys(row).some((k) => !cols.has(k))
      )
        throw new Error("Invalid backup columns");
      for (const [k, v] of Object.entries(row)) {
        if (
          v !== null &&
          !["string", "number"].includes(typeof v) &&
          !(
            table === "knowledge_docs" &&
            k === "data" &&
            typeof (v as { base64?: unknown })?.base64 === "string"
          )
        )
          throw new Error("Invalid backup value");
        if (
          ["look", "card", "attachments", "members", "data"].includes(k) &&
          typeof v === "string"
        )
          JSON.parse(v);
      }
      inserts.push({ table, row: { ...row } });
    }
  }
  const attached = new Set((b.tables.files ?? []).map((r) => String(r.id)));
  if ([...attached].some((id) => !/^file_[a-zA-Z0-9]+$/.test(id)))
    throw new Error("Invalid attachment path");
  let bytes = 0;
  const content: { id: string; data: Buffer }[] = [];
  for (const [id, encoded] of Object.entries(b.files)) {
    if (
      !/^file_[a-zA-Z0-9]+$/.test(id) ||
      !attached.has(id) ||
      typeof encoded !== "string"
    )
      throw new Error("Invalid attachment path");
    const data = Buffer.from(encoded, "base64");
    bytes += data.length;
    if (bytes > 100 * 1024 * 1024)
      throw new Error("Backup files exceed 100 MB");
    content.push({ id, data });
  }
  const created: string[] = [];
  db().exec("BEGIN IMMEDIATE");
  try {
    if (b.settings) {
      saveBudget(b.settings.budget);
      saveRouting({ ...b.settings.routing, enabled: false }, []);
    }
    for (const { table, row } of inserts) {
      if (table === "dots") {
        row.status = "paused";
        row.thread = null;
        row.pending = null;
        row.box_id = null;
        row.model = null;
        row.local_access = 0;
      }
      if (table === "conversations") {
        row.thread = null;
        row.pending = null;
        row.history = null;
      }
      if (table === "routines") {
        row.enabled = 0;
        row.next_due = null;
      }
      if (table === "tasks") row.status = "interrupted";
      if (table === "workflow_runs") {
        const run = JSON.parse(String(row.data));
        run.status = "stopped";
        row.data = JSON.stringify(run);
      }
      if (table === "messages" && row.card) {
        const card = JSON.parse(String(row.card));
        if (card.status === "pending") card.status = "expired";
        row.card = JSON.stringify(card);
      }
      const keys = Object.keys(row);
      db()
        .prepare(
          `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
        )
        .run(
          ...keys.map((k) =>
            typeof row[k] === "object" && row[k] !== null
              ? Buffer.from((row[k] as { base64: string }).base64, "base64")
              : (row[k] as string | number | null),
          ),
        );
    }
    fs.mkdirSync(path.join(DATA_DIR, "files"), { recursive: true });
    for (const f of content) {
      const p = path.join(DATA_DIR, "files", f.id);
      fs.writeFileSync(p, f.data, { flag: "wx", mode: 0o600 });
      created.push(p);
    }
    db().exec("COMMIT");
  } catch (e) {
    db().exec("ROLLBACK");
    for (const p of created) fs.unlinkSync(p);
    throw e;
  }
}
