import "server-only";
import { db, id, getSetting, setSetting } from "./db";
import { activeTask, getTask, updateTask } from "./tasks";
import type {
  ResponseCreateParams,
  Response,
} from "openai/resources/responses/responses";
export type BudgetConfig = {
  enabled: boolean;
  dailyPerDot: number;
  perTask: number;
  maxSteps: number;
  maxOutputTokens: number;
  prices: Record<string, { input: number; output: number }>;
};
export const defaultBudget: BudgetConfig = {
  enabled: false,
  dailyPerDot: 5,
  perTask: 1,
  maxSteps: 30,
  maxOutputTokens: 4096,
  prices: {},
};
export function budgetConfig(): BudgetConfig {
  return {
    ...defaultBudget,
    ...JSON.parse(getSetting("budget_config") ?? "{}"),
  };
}
export function saveBudget(c: BudgetConfig) {
  if (
    typeof c.enabled !== "boolean" ||
    !Number.isFinite(c.dailyPerDot) ||
    c.dailyPerDot <= 0 ||
    !Number.isFinite(c.perTask) ||
    c.perTask <= 0 ||
    !Number.isInteger(c.maxSteps) ||
    c.maxSteps < 1 ||
    c.maxSteps > 100 ||
    !Number.isInteger(c.maxOutputTokens) ||
    c.maxOutputTokens < 32 ||
    c.maxOutputTokens > 32768
  )
    throw new Error("Invalid budget or run limits");
  if (!c.prices || typeof c.prices !== "object" || Array.isArray(c.prices))
    throw new Error("Enter a model price map");
  for (const p of Object.values(c.prices))
    if (
      !p ||
      !Number.isFinite(p.input) ||
      !Number.isFinite(p.output) ||
      p.input < 0 ||
      p.output < 0
    )
      throw new Error("Prices must be non-negative dollars per million tokens");
  setSetting("budget_config", JSON.stringify(c));
}
function table() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS usage_ledger(id TEXT PRIMARY KEY,dot_id TEXT NOT NULL,task_id TEXT,model TEXT NOT NULL,input_tokens INTEGER,output_tokens INTEGER,cost REAL NOT NULL,reserved REAL NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL);`,
  );
  return db();
}
export function usageSummary() {
  return table()
    .prepare(
      "SELECT dot_id AS dotId,model,SUM(COALESCE(input_tokens,0)) AS inputTokens,SUM(COALESCE(output_tokens,0)) AS outputTokens,SUM(cost) AS cost,SUM(reserved) AS reserved,SUM(CASE WHEN state='unpriced' THEN 1 ELSE 0 END) AS unpriced FROM usage_ledger GROUP BY dot_id,model",
    )
    .all()
    .map((r) => ({ ...r }));
}
export function reserveRequest(
  dotId: string,
  model: string,
  body: ResponseCreateParams,
) {
  const config = budgetConfig(),
    taskId = activeTask(dotId) ?? null,
    price = config.prices[model];
  if (config.enabled && !price)
    throw new Error(
      `Set input/output prices for ${model} before using spending limits`,
    );
  // UTF-8 bytes conservatively bound token count for the app-supplied text. Multimodal and opaque server history cannot be bounded here.
  if (
    config.enabled &&
    (body.previous_response_id ||
      JSON.stringify(body).includes('"input_image"') ||
      JSON.stringify(body).includes('"input_file"'))
  )
    throw new Error(
      "Budget enforcement requires local text history; image/file requests need separately metered support",
    );
  const estimate = price
    ? ((Buffer.byteLength(JSON.stringify(body), "utf8") + 4096) * price.input) /
        1e6 +
      (config.maxOutputTokens * price.output) / 1e6
    : 0;
  const now = Date.now(),
    day = new Date().setUTCHours(0, 0, 0, 0),
    key = id("usage");
  const d = table();
  d.exec("BEGIN IMMEDIATE");
  try {
    const daily = Number(
      d
        .prepare(
          "SELECT COALESCE(SUM(cost+reserved),0) AS amount FROM usage_ledger WHERE dot_id=? AND created_at>=?",
        )
        .get(dotId, day)?.amount ?? 0,
    );
    const task = taskId
      ? Number(
          d
            .prepare(
              "SELECT COALESCE(SUM(cost+reserved),0) AS amount FROM usage_ledger WHERE task_id=?",
            )
            .get(taskId)?.amount ?? 0,
        )
      : 0;
    if (
      config.enabled &&
      (daily + estimate > config.dailyPerDot ||
        task + estimate > config.perTask)
    )
      throw new Error(
        "This request would exceed the configured model budget. Review usage or increase the limit.",
      );
    d.prepare(
      "INSERT INTO usage_ledger(id,dot_id,task_id,model,cost,reserved,state,created_at) VALUES(?,?,?,?,0,?,?,?)",
    ).run(key, dotId, taskId, model, estimate, "reserved", now);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return { key, price };
}
export function recordUsage(
  reservation: ReturnType<typeof reserveRequest>,
  response: Pick<Response, "usage">,
) {
  const usage = response.usage;
  if (!usage) return; // Unknown outcomes stay reserved, never treated as free.
  const cost = reservation.price
    ? (usage.input_tokens * reservation.price.input +
        usage.output_tokens * reservation.price.output) /
      1e6
    : 0;
  table()
    .prepare(
      "UPDATE usage_ledger SET input_tokens=?,output_tokens=?,cost=?,reserved=0,state=? WHERE id=?",
    )
    .run(
      usage.input_tokens,
      usage.output_tokens,
      cost,
      reservation.price ? "charged" : "unpriced",
      reservation.key,
    );
}
export function stepBudget(dotId: string) {
  const taskId = activeTask(dotId);
  if (!taskId) return;
  const task = getTask(taskId)!;
  if (task.steps >= budgetConfig().maxSteps)
    throw new Error(
      "Task step limit reached. Review progress before resuming.",
    );
  updateTask(taskId, { steps: task.steps + 1 });
}
