import "server-only";
import { db, id } from "./db";
export type TaskStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "interrupted"
  | "cancelled"
  | "resumed";
export type TaskRecord = {
  id: string;
  dotId: string;
  conversationId: string;
  instruction: string;
  status: TaskStatus;
  progress: string;
  result: string | null;
  error: string | null;
  steps: number;
  createdAt: number;
  updatedAt: number;
  parentId: string | null;
};
function table() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, dot_id TEXT NOT NULL, conversation_id TEXT NOT NULL, instruction TEXT NOT NULL, status TEXT NOT NULL, progress TEXT NOT NULL DEFAULT '', result TEXT, error TEXT, steps INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, parent_id TEXT); CREATE INDEX IF NOT EXISTS tasks_dot_status ON tasks(dot_id,status);`,
  );
  return db();
}
function from(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    dotId: String(row.dot_id),
    conversationId: String(row.conversation_id),
    instruction: String(row.instruction),
    status: row.status as TaskStatus,
    progress: String(row.progress),
    result: row.result as string | null,
    error: row.error as string | null,
    steps: Number(row.steps),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    parentId: row.parent_id as string | null,
  };
}
export function listTasks(dotId?: string): TaskRecord[] {
  return (
    dotId
      ? table()
          .prepare(
            "SELECT * FROM tasks WHERE dot_id=? ORDER BY created_at DESC LIMIT 200",
          )
          .all(dotId)
      : table()
          .prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200")
          .all()
  ).map(from);
}
export function getTask(taskId: string) {
  const row = table().prepare("SELECT * FROM tasks WHERE id=?").get(taskId);
  return row ? from(row) : null;
}
export function createTask(
  dotId: string,
  conversationId: string,
  instruction: string,
  parentId: string | null = null,
) {
  const taskId = id("task"),
    now = Date.now();
  table()
    .prepare(
      "INSERT INTO tasks(id,dot_id,conversation_id,instruction,status,created_at,updated_at,parent_id) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      taskId,
      dotId,
      conversationId,
      instruction,
      "queued",
      now,
      now,
      parentId,
    );
  return taskId;
}
export function updateTask(
  taskId: string,
  patch: Partial<
    Pick<TaskRecord, "status" | "progress" | "result" | "error" | "steps">
  >,
) {
  const columns = {
    status: "status",
    progress: "progress",
    result: "result",
    error: "error",
    steps: "steps",
  };
  for (const [key, value] of Object.entries(patch))
    if (key in columns)
      table()
        .prepare(
          `UPDATE tasks SET ${columns[key as keyof typeof columns]}=?,updated_at=? WHERE id=?`,
        )
        .run(value ?? null, Date.now(), taskId);
}
const globalTasks = globalThis as unknown as {
  __activeTasks?: Map<string, string>;
};
const active = (globalTasks.__activeTasks ??= new Map<string, string>());
export const activeTask = (dotId: string) => active.get(dotId);
export function startTask(dotId: string, taskId: string) {
  active.set(dotId, taskId);
  updateTask(taskId, { status: "running", error: null });
}
export function finishTask(
  dotId: string,
  status: TaskStatus,
  result?: string,
  error?: string,
) {
  const taskId = active.get(dotId);
  if (taskId)
    updateTask(taskId, {
      status,
      result: result ?? null,
      error: error ?? null,
    });
  active.delete(dotId);
}
export function progressTask(dotId: string, progress: string) {
  const taskId = active.get(dotId);
  if (taskId) updateTask(taskId, { progress });
}
export function interruptedTasks() {
  table()
    .prepare(
      "UPDATE tasks SET status='interrupted',progress='App restarted. Review progress before resuming.',updated_at=? WHERE status IN ('running','queued')",
    )
    .run(Date.now());
}
export function cancelQueued(dotId: string) {
  table()
    .prepare(
      "UPDATE tasks SET status='cancelled',updated_at=? WHERE dot_id=? AND status='queued'",
    )
    .run(Date.now(), dotId);
}

export function childTaskCount(parentId: string) {
  return Number(
    table()
      .prepare("SELECT COUNT(*) AS n FROM tasks WHERE parent_id=?")
      .get(parentId)?.n ?? 0,
  );
}
