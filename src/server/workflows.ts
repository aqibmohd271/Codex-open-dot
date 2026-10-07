import "server-only";
import { db, id } from "./db";
import { getTask } from "./tasks";
import * as repo from "./repo";
export type Workflow = {
  id: string;
  name: string;
  dotId: string;
  steps: { instruction: string; review: boolean }[];
};
export type WorkflowRun = {
  id: string;
  definition: Workflow;
  conversationId: string;
  step: number;
  taskId: string | null;
  status: "running" | "review" | "completed" | "failed" | "stopped";
  results: string[];
  error?: string;
};
function table() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS workflows(id TEXT PRIMARY KEY,data TEXT NOT NULL);CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,data TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
  return db();
}
export function listWorkflows(): Workflow[] {
  return table()
    .prepare("SELECT data FROM workflows")
    .all()
    .map((r) => JSON.parse(String(r.data)));
}
export function listWorkflowRuns(): WorkflowRun[] {
  return table()
    .prepare(
      "SELECT data FROM workflow_runs ORDER BY created_at DESC LIMIT 100",
    )
    .all()
    .map((r) => JSON.parse(String(r.data)));
}
export function saveWorkflow(input: Omit<Workflow, "id">) {
  if (
    !input.name.trim() ||
    !repo.getDot(input.dotId) ||
    !input.steps.length ||
    input.steps.length > 30 ||
    input.steps.some(
      (s) =>
        !s.instruction.trim() ||
        s.instruction.length > 10000 ||
        typeof s.review !== "boolean",
    )
  )
    throw new Error("Use a name, a dot and 1–30 nonempty steps");
  const workflow = { ...input, id: id("wf") };
  table()
    .prepare("INSERT INTO workflows VALUES(?,?)")
    .run(workflow.id, JSON.stringify(workflow));
  return workflow;
}
function save(run: WorkflowRun) {
  table()
    .prepare("UPDATE workflow_runs SET data=? WHERE id=?")
    .run(JSON.stringify(run), run.id);
}
export async function startWorkflow(workflowId: string) {
  const definition = listWorkflows().find((w) => w.id === workflowId);
  if (!definition) throw new Error("Workflow not found");
  const run: WorkflowRun = {
    id: id("wfr"),
    definition,
    conversationId: repo.createConversation(definition.dotId, definition.name)
      .id,
    step: 0,
    taskId: null,
    status: "running",
    results: [],
  };
  table()
    .prepare("INSERT INTO workflow_runs VALUES(?,?,?)")
    .run(run.id, JSON.stringify(run), Date.now());
  await dispatch(run);
  return run.id;
}
async function dispatch(run: WorkflowRun) {
  if (run.step >= run.definition.steps.length) {
    run.status = "completed";
    save(run);
    return;
  }
  // Dynamic import breaks the runtime/workflow module cycle.
  const { sendMessage } = await import("./agent/runtime");
  run.taskId = sendMessage(
    run.definition.dotId,
    `Workflow ${run.definition.name}, step ${run.step + 1}/${run.definition.steps.length}: ${run.definition.steps[run.step].instruction}\nPrevious step results (context only):\n${run.results.join("\n").slice(-24000)}\nComplete only this step. Respect the user's action approval rules.`,
    [],
    run.conversationId,
  );
  save(run);
}
let ticking = false;
export async function tickWorkflows() {
  if (ticking) return;
  ticking = true;
  try {
    for (const run of listWorkflowRuns()) {
      if (run.status !== "running" || !run.taskId) continue;
      const task = getTask(run.taskId);
      if (
        !task ||
        ["failed", "cancelled", "interrupted", "resumed"].includes(task.status)
      ) {
        run.status = "failed";
        run.error =
          task?.error ??
          "Step interrupted; review its conversation before starting a new workflow.";
        save(run);
        continue;
      }
      if (task.status !== "completed") continue;
      run.results.push(task.result ?? "No result");
      run.taskId = null;
      if (run.definition.steps[run.step].review) {
        run.status = "review";
        save(run);
      } else {
        run.step++;
        save(run);
        await dispatch(run);
      }
    }
  } finally {
    ticking = false;
  }
}
export async function reviewWorkflow(runId: string, approved: boolean) {
  const run = listWorkflowRuns().find((r) => r.id === runId);
  if (!run || run.status !== "review")
    throw new Error("Workflow is not waiting for review");
  run.status = approved ? "running" : "stopped";
  run.step++;
  save(run);
  if (approved) await dispatch(run);
}
export async function stopWorkflow(runId: string) {
  const run = listWorkflowRuns().find((r) => r.id === runId);
  if (!run) return;
  run.status = "stopped";
  save(run);
  const { stop } = await import("./agent/runtime");
  stop(run.definition.dotId);
}
