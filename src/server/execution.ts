import "server-only";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { db } from "./db";
export function fingerprint(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}
function table() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS executions (key TEXT PRIMARY KEY,dot_id TEXT NOT NULL,fingerprint TEXT NOT NULL,tool TEXT NOT NULL,state TEXT NOT NULL,output TEXT,updated_at INTEGER NOT NULL);`,
  );
  return db();
}
export async function retryRead<T>(
  fn: () => Promise<T>,
  signal: AbortSignal,
  attempts = 3,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number })?.status;
      const transient =
        status === 429 ||
        (status !== undefined && status >= 500) ||
        /ECONNRESET|ETIMEDOUT/.test(String(e));
      if (!transient || attempt >= attempts - 1) throw e;
      await delay(250 * 2 ** attempt, undefined, { signal });
    }
  }
}
export async function executeOnce(
  dotId: string,
  callId: string,
  tool: string,
  args: unknown,
  fn: () => Promise<string>,
): Promise<string> {
  const key = `${dotId}:${callId}`,
    hash = fingerprint({ tool, args }),
    d = table();
  const previous = d.prepare("SELECT * FROM executions WHERE key=?").get(key);
  if (previous) {
    if (previous.fingerprint !== hash)
      throw new Error("Tool call changed after it was recorded");
    if (previous.state === "completed") return String(previous.output);
    throw new Error(
      "This action has an uncertain outcome. Check the external service before attempting it again.",
    );
  }
  const uncertain = d
    .prepare(
      "SELECT key FROM executions WHERE dot_id=? AND fingerprint=? AND state='started'",
    )
    .get(dotId, hash);
  if (uncertain)
    throw new Error(
      "An identical action may already have happened. Check its outcome before repeating it.",
    );
  d.prepare(
    "INSERT INTO executions(key,dot_id,fingerprint,tool,state,updated_at) VALUES(?,?,?,?,?,?)",
  ).run(key, dotId, hash, tool, "started", Date.now());
  const output = await fn();
  d.prepare(
    "UPDATE executions SET state='completed',output=?,updated_at=? WHERE key=?",
  ).run(output, Date.now(), key);
  return output;
}
