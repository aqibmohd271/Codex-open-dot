import "server-only";
import { audit } from "./audit";
import { cookies, headers } from "next/headers";
import { principal, permits, safeOrigin, type Role } from "./auth";
export async function requireRole(role: Role = "member", action = "access") {
  const h = await headers(),
    host = h.get("host");
  if (!safeOrigin(`http://${host}`, h.get("origin"), host))
    throw new Error("Request origin is not allowed");
  const user = principal((await cookies()).get("dot_session")?.value ?? null);
  if (!user || !permits(user.role, role))
    throw new Error("You do not have permission for this action");
  if (role !== "viewer") audit(user.username, `Authorized: ${action}`);
  return user;
}
