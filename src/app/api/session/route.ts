import { requireRole } from "@/server/access";
import { authEnabled, workspaceId } from "@/server/auth";
export async function GET() {
  const user = await requireRole("viewer");
  return Response.json(
    { ...user, authenticated: authEnabled(), workspace: workspaceId() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
