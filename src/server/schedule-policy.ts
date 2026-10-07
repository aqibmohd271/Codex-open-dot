import { Cron } from "croner";
export function nextOccurrence(
  schedule: string,
  timezone: string,
  after = new Date(),
): number {
  if (schedule.trim().split(/\s+/).length !== 5)
    throw new Error("Use a five-field cron schedule");
  new Intl.DateTimeFormat("en", { timeZone: timezone });
  const next = new Cron(schedule, { paused: true, timezone })
    .nextRun(after)
    ?.getTime();
  if (!next) throw new Error("The schedule has no future occurrence");
  return next;
}
export function duePolicy(
  due: number,
  now: number,
  policy: "skip" | "catch-up",
) {
  return due > now
    ? "future"
    : now - due > 90_000 && policy === "skip"
      ? "skipped"
      : "dispatch";
}
