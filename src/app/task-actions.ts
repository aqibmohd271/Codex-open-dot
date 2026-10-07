"use server";
import { requireRole } from "@/server/access";
import { verificationStatus, taskChecks } from "@/server/quality";
import { listTasks } from "@/server/tasks";
import { recoverTask, stop } from "@/server/agent/runtime";
export async function getTasks() {
  await requireRole("viewer", "getTasks");
  return listTasks().map((t) => ({
    ...t,
    verification: verificationStatus(t.id),
    checks: taskChecks(t.id),
  }));
}
export async function resumeTask(id: string) {
  await requireRole("member", "resumeTask");
  recoverTask(id);
  return listTasks().map((t) => ({
    ...t,
    verification: verificationStatus(t.id),
    checks: taskChecks(t.id),
  }));
}
export async function stopTaskDot(dotId: string) {
  await requireRole("member", "stopTaskDot");
  stop(dotId);
  return listTasks().map((t) => ({
    ...t,
    verification: verificationStatus(t.id),
    checks: taskChecks(t.id),
  }));
}
