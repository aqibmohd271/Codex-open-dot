"use server";
import { requireRole } from "@/server/access";
import {
  listConnections,
  addConnection,
  removeConnection,
} from "@/server/connections";
import { getDot } from "@/server/repo";
export async function getConnections() {
  await requireRole("owner", "getConnections");
  return listConnections();
}
export async function saveConnection(
  input: Parameters<typeof addConnection>[0],
) {
  await requireRole("owner", "saveConnection");
  if (!getDot(input.dotId)) throw new Error("Dot not found");
  return addConnection(input);
}
export async function deleteConnection(id: string) {
  await requireRole("owner", "deleteConnection");
  removeConnection(id);
  return listConnections();
}
