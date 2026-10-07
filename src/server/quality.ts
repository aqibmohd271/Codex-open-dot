import "server-only";
import { randomUUID } from "node:crypto";
import { db, id } from "./db";
import { activeTask } from "./tasks";
import * as computer from "./computer";
const quote = (s: string) => "'" + s.replace(/'/g, "'\"'\"'") + "'";
function table() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS quality_checks(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,name TEXT NOT NULL,passed INTEGER NOT NULL,evidence TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
  return db();
}
export function recordCheck(
  dotId: string,
  name: string,
  passed: boolean,
  evidence: string,
) {
  const task = activeTask(dotId);
  if (!task) throw new Error("Verification needs an active task");
  table()
    .prepare("INSERT INTO quality_checks VALUES(?,?,?,?,?,?)")
    .run(
      id("check"),
      task,
      name,
      passed ? 1 : 0,
      evidence.slice(0, 20000),
      Date.now(),
    );
}
export function taskChecks(taskId: string) {
  return table()
    .prepare(
      "SELECT name,passed,evidence,created_at AS createdAt FROM quality_checks WHERE task_id=? ORDER BY created_at",
    )
    .all(taskId)
    .map((r) => ({
      name: String(r.name),
      passed: Number(r.passed),
      evidence: String(r.evidence),
      createdAt: Number(r.createdAt),
    }));
}
export function verificationStatus(
  taskId: string,
): "unverified" | "passed" | "failed" {
  const checks = taskChecks(taskId);
  return checks.length
    ? checks.every((c) => c.passed === 1)
      ? "passed"
      : "failed"
    : "unverified";
}
export function exitFromEvidence(output: string, marker: string) {
  const match = new RegExp(`${marker}:(\\d+)`).exec(output);
  return match ? Number(match[1]) : null;
}
export async function verifyCommand(
  dotId: string,
  command: string,
  signal: AbortSignal,
) {
  const marker = "DOT_CHECK_" + randomUUID().replace(/-/g, "");
  const output = await computer.runCommand(
    dotId,
    `bash -lc ${quote(command)}; dot_check_exit=$?; printf '\n${marker}:%s\n' "$dot_check_exit"`,
    signal,
  );
  const code = exitFromEvidence(output, marker);
  recordCheck(
    dotId,
    command,
    code === 0,
    output.replace(new RegExp(`${marker}:\\d+`), "").trim(),
  );
  return `Verification ${code === 0 ? "passed" : "failed"} (exit ${code ?? "unknown"}).\n${output}`;
}
