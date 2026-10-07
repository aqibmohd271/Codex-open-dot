import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-runtime-"));
process.env.DOTS_DATA_DIR = dir;
process.env.DOTS_COMPUTER = "local";
delete process.env.OPENAI_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.E2B_API_KEY;
const repo = await import("../src/server/repo.ts"),
  providers = await import("../src/server/providers.ts"),
  tasks = await import("../src/server/tasks.ts"),
  runtime = await import("../src/server/agent/runtime.ts"),
  connections = await import("../src/server/connections.ts"),
  workflows = await import("../src/server/workflows.ts");
let phase = "plain",
  sent = 0,
  requests = [],
  externalTool = "";
const server = http.createServer(async (req, res) => {
  let text = "";
  for await (const c of req) text += c;
  if (req.url === "/tool") {
    sent++;
    res.setHeader("content-type", "application/json");
    res.end('{"sent":true}');
    return;
  }
  const body = JSON.parse(text);
  requests.push(body);
  const hadTool = body.messages?.some((m) => m.role === "tool");
  const message =
    phase === "approval" && !hadTool
      ? {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "send_call",
              type: "function",
              function: {
                name: externalTool,
                arguments:
                  '{"body":{"recipient":"test@example.invalid","message":"Hello"}}',
              },
            },
          ],
        }
      : { role: "assistant", content: "Finished and checked context" };
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      id: "response_" + requests.length,
      object: "chat.completion",
      created: Date.now() / 1000,
      model: "test",
      choices: [
        {
          index: 0,
          finish_reason: message.tool_calls ? "tool_calls" : "stop",
          message,
        },
      ],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    }),
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
providers.saveProvider({
  name: "Mock",
  baseURL: url + "/v1",
  format: "chat",
  auth: "none",
  models: ["test"],
  tools: true,
  images: false,
});
const dot = repo.createDot({ name: "Test", purpose: "", look: {} });
await connections.addConnection({
  name: "Mock send",
  url: url + "/tool",
  kind: "http",
  dotId: dot.id,
});
externalTool = connections.customTools(dot.id)[0].name;
const wait = async (fn) => {
  for (let i = 0; i < 100; i++) {
    const result = fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("Timed out waiting for runtime");
};
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});
test("custom provider drives a complete agent task and records usage", async () => {
  const conv = repo.createConversation(dot.id);
  const id = runtime.sendMessage(dot.id, "Hello", [], conv.id);
  await wait(() => tasks.getTask(id)?.status === "completed");
  assert.equal(tasks.getTask(id).steps, 1);
  assert.equal(tasks.getTask(id).result, "Finished and checked context");
  assert.equal(requests[0].model, "test");
});
test("approval pauses side effect and resumes once with correct tool history", async () => {
  phase = "approval";
  const conv = repo.createConversation(dot.id);
  const id = runtime.sendMessage(dot.id, "Send test message", [], conv.id);
  await wait(() => tasks.getTask(id)?.status === "waiting");
  assert.equal(sent, 0);
  const card = repo.pendingCards(dot.id)[0];
  assert.match(card.card.detail, /test@example.invalid/);
  await runtime.resolveCard(card.id, "approve");
  await wait(() => tasks.getTask(id)?.status === "completed");
  assert.equal(sent, 1);
  await runtime.resolveCard(card.id, "approve");
  assert.equal(sent, 1);
  assert.ok(requests.at(-1).messages.some((m) => m.role === "tool"));
  phase = "plain";
});
test("workflow review gate prevents automatic progression", async () => {
  const w = workflows.saveWorkflow({
    name: "Two steps",
    dotId: dot.id,
    steps: [
      { instruction: "Research", review: true },
      { instruction: "Summarize", review: true },
    ],
  });
  const id = await workflows.startWorkflow(w.id);
  await wait(
    () =>
      workflows.listWorkflowRuns().find((r) => r.id === id)?.status ===
      "review",
  );
  assert.equal(workflows.listWorkflowRuns().find((r) => r.id === id).step, 0);
  await workflows.reviewWorkflow(id, true);
  await wait(
    () =>
      workflows.listWorkflowRuns().find((r) => r.id === id)?.status ===
      "review",
  );
  assert.equal(
    workflows.listWorkflowRuns().find((r) => r.id === id).results.length,
    2,
  );
  await workflows.reviewWorkflow(id, false);
  assert.equal(
    workflows.listWorkflowRuns().find((r) => r.id === id).status,
    "stopped",
  );
});

test("durable scheduler dispatches a missed run once and records skips", async () => {
  const { db } = await import("../src/server/db.ts");
  const { tickSchedules } = await import("../src/server/scheduler.ts");
  const routine = repo.addRoutine({
    dotId: dot.id,
    name: "Catch up",
    instruction: "Schedule test",
    schedule: "* * * * *",
    timezone: "UTC",
    missedPolicy: "catch-up",
  });
  const due = Date.now() - 300000;
  db()
    .prepare("UPDATE routines SET next_due=? WHERE id=?")
    .run(due, routine.id);
  const before = tasks.listTasks(dot.id).length;
  tickSchedules();
  tickSchedules();
  assert.equal(tasks.listTasks(dot.id).length, before + 1);
  assert.equal(
    db()
      .prepare("SELECT COUNT(*) AS n FROM schedule_runs WHERE routine_id=?")
      .get(routine.id).n,
    1,
  );
  await wait(() =>
    tasks
      .listTasks(dot.id)
      .every((t) => t.status !== "running" && t.status !== "queued"),
  );
  repo.updateRoutine(routine.id, { enabled: false });
  const skipped = repo.addRoutine({
    dotId: dot.id,
    name: "Skip",
    instruction: "Never run",
    schedule: "* * * * *",
    timezone: "UTC",
    missedPolicy: "skip",
  });
  db()
    .prepare("UPDATE routines SET next_due=? WHERE id=?")
    .run(due, skipped.id);
  tickSchedules();
  assert.equal(
    db()
      .prepare("SELECT outcome FROM schedule_runs WHERE routine_id=?")
      .get(skipped.id).outcome,
    "skipped",
  );
  repo.updateRoutine(skipped.id, { enabled: false });
});
test("specialists create durable handoffs and enforce nested and per-parent limits", async () => {
  const { findTool } = await import("../src/server/agent/tools.ts");
  const target = repo.createDot({
    name: "Reviewer",
    purpose: "Review",
    look: {},
  });
  const parent = tasks.createTask(
    dot.id,
    repo.createConversation(dot.id).id,
    "Parent",
  );
  tasks.startTask(dot.id, parent);
  const ctx = {
    dot: repo.getDot(dot.id),
    signal: new AbortController().signal,
    depth: 0,
  };
  const tool = findTool("message_dot");
  assert.match(
    await tool.execute({ dot_name: "Reviewer", message: "Review" }, ctx),
    /completed/,
  );
  assert.equal(tasks.childTaskCount(parent), 1);
  const child = tasks.listTasks().find((t) => t.parentId === parent);
  tasks.startTask(target.id, child.id);
  assert.match(
    await tool.execute(
      { dot_name: dot.name, message: "Loop" },
      { ...ctx, dot: target },
    ),
    /Nested/,
  );
  tasks.finishTask(target.id, "completed");
  for (let i = 0; i < 4; i++)
    tasks.createTask(target.id, child.conversationId, "Prior handoff", parent);
  assert.match(
    await tool.execute({ dot_name: "Reviewer", message: "Sixth" }, ctx),
    /five-handoff/,
  );
  tasks.finishTask(dot.id, "completed");
});

test("quality checks execute commands and preserve failed evidence", async () => {
  const { verifyCommand, verificationStatus, taskChecks } = await import(
    "../src/server/quality.ts"
  );
  const id = tasks.createTask(
    dot.id,
    repo.createConversation(dot.id).id,
    "Verify",
  );
  tasks.startTask(dot.id, id);
  const signal = new AbortController().signal;
  assert.match(
    await verifyCommand(dot.id, "printf 'check succeeded'; exit 0", signal),
    /Verification passed/,
  );
  assert.equal(verificationStatus(id), "passed");
  assert.match(
    await verifyCommand(dot.id, "printf 'check failed'; exit 2", signal),
    /Verification failed/,
  );
  assert.equal(verificationStatus(id), "failed");
  assert.match(taskChecks(id)[1].evidence, /check failed/);
  tasks.finishTask(dot.id, "failed");
});
