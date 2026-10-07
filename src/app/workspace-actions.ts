"use server";
import { requireRole } from "@/server/access";
import {
  authEnabled,
  workspaceId,
  members,
  addMember,
  disableMember,
  type Role,
} from "@/server/auth";
import { auditHistory, audit } from "@/server/audit";
export async function workspaceState() {
  await requireRole("owner", "workspaceState");
  return {
    enabled: authEnabled(),
    id: workspaceId(),
    members: authEnabled() ? members() : [],
    activity: auditHistory(),
  };
}
export async function createMember(
  username: string,
  password: string,
  role: Role,
) {
  const actor = await requireRole("owner", "createMember");
  if (!authEnabled()) throw new Error("Enable authenticated server mode first");
  addMember(username, password, role);
  audit(actor.username, `Added ${role}: ${username}`);
  return workspaceState();
}
export async function revokeMember(username: string) {
  const actor = await requireRole("owner", "revokeMember");
  disableMember(username, actor.username);
  audit(actor.username, `Disabled member: ${username}`);
  return workspaceState();
}
