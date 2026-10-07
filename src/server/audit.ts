import "server-only";
import { db, id } from "./db";
export function audit(actor: string, action: string) {
  db().exec(
    "CREATE TABLE IF NOT EXISTS workspace_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
  db()
    .prepare("INSERT INTO workspace_audit VALUES(?,?,?,?)")
    .run(id("audit"), actor, action, Date.now());
}
export function auditHistory() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS workspace_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
  return db()
    .prepare(
      "SELECT actor,action,created_at AS createdAt FROM workspace_audit ORDER BY created_at DESC LIMIT 200",
    )
    .all()
    .map((r) => ({ ...r }));
}
