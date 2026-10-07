"use server";
import { requireRole } from "@/server/access";
import * as w from "@/server/workflows";
export async function workflowState() {
  await requireRole("viewer", "workflowState");
  return { definitions: w.listWorkflows(), runs: w.listWorkflowRuns() };
}
export async function createWorkflow(
  input: Parameters<typeof w.saveWorkflow>[0],
) {
  await requireRole("member", "createWorkflow");
  w.saveWorkflow(input);
  return workflowState();
}
export async function runWorkflow(id: string) {
  await requireRole("member", "runWorkflow");
  await w.startWorkflow(id);
  return workflowState();
}
export async function decideWorkflow(id: string, approved: boolean) {
  await requireRole("member", "decideWorkflow");
  await w.reviewWorkflow(id, approved);
  return workflowState();
}
export async function haltWorkflow(id: string) {
  await requireRole("member", "haltWorkflow");
  await w.stopWorkflow(id);
  return workflowState();
}
