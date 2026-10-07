import "server-only";
import * as repo from "./repo";
import { db } from "./db";
import { runRoutine } from "./agent/runtime";
import { nextOccurrence, duePolicy } from "./schedule-policy";

export function tickSchedules(now = Date.now()) {
  for (const routine of repo.listRoutines()) {
    if (!routine.enabled) continue;
    const row = db()
      .prepare("SELECT next_due FROM routines WHERE id=?")
      .get(routine.id);
    const due = Number(
      row?.next_due ??
        nextOccurrence(
          routine.schedule,
          routine.timezone,
          new Date(routine.lastRunAt ?? routine.createdAt),
        ),
    );
    const policy = duePolicy(due, now, routine.missedPolicy);
    if (policy === "future") continue;
    const dot = repo.getDot(routine.dotId);
    // Keep catch-up due until a paused dot resumes; never pile up a backlog of runs.
    if (dot?.status === "paused" && routine.missedPolicy === "catch-up")
      continue;
    const outcome = dot?.status === "paused" ? "skipped-paused" : policy;
    db().exec("BEGIN IMMEDIATE");
    try {
      const claimed = db()
        .prepare(
          "INSERT OR IGNORE INTO schedule_runs(routine_id,due_at,outcome,recorded_at) VALUES(?,?,?,?)",
        )
        .run(routine.id, due, outcome, now).changes;
      db()
        .prepare("UPDATE routines SET next_due=? WHERE id=?")
        .run(
          nextOccurrence(routine.schedule, routine.timezone, new Date(now)),
          routine.id,
        );
      if (claimed && outcome === "dispatch") runRoutine(routine);
      db().exec("COMMIT");
    } catch (error) {
      db().exec("ROLLBACK");
      throw error;
    }
  }
}
const g = globalThis as unknown as {
  __durableScheduleTimer?: ReturnType<typeof setInterval>;
};
export function startScheduler() {
  if (g.__durableScheduleTimer) return;
  const tick = () => {
    try {
      tickSchedules();
    } catch (error) {
      console.error("[schedules] Dispatch failed", error);
    }
  };
  tick();
  g.__durableScheduleTimer = setInterval(tick, 15_000);
  g.__durableScheduleTimer.unref();
}
