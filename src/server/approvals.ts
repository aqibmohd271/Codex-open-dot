import "server-only";
import { db } from "./db";
import { fingerprint } from "./execution";
export function approvalDetails(call: unknown) {
  return JSON.stringify(
    call,
    (key, value) => {
      if (/password|api.?key|authorization|secret|token/i.test(key))
        return "[redacted]";
      if (key === "arguments" && typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    },
    2,
  );
}
export function checkApproval(
  card: { expiresAt?: number; actionHash?: string },
  call: unknown,
  now = Date.now(),
) {
  if (!card.expiresAt || card.expiresAt <= now)
    throw new Error(
      "This approval expired. Ask the dot to prepare the action again.",
    );
  if (!card.actionHash || card.actionHash !== fingerprint(call))
    throw new Error("The action changed. A new approval is required.");
}
export function auditApproval(
  cardId: string,
  dotId: string,
  decision: string,
  hash: string,
) {
  db().exec(
    "CREATE TABLE IF NOT EXISTS approval_audit(card_id TEXT PRIMARY KEY,dot_id TEXT NOT NULL,decision TEXT NOT NULL,action_hash TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
  db()
    .prepare("INSERT INTO approval_audit VALUES(?,?,?,?,?)")
    .run(cardId, dotId, decision, hash, Date.now());
}
