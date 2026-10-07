import { getDocumentFile } from "@/server/knowledge";
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/knowledge/[id]">,
) {
  const { id } = await ctx.params;
  const doc = getDocumentFile(id);
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(doc.data as Uint8Array), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(doc.name))}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
