import { requireRole } from "@/server/access";
import { exportBackup, restoreBackup } from "@/server/backup";
export async function GET() {
  await requireRole("owner");
  return new Response(JSON.stringify(exportBackup()), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        'attachment; filename="codex-open-dot-backup.json"',
      "Cache-Control": "no-store",
    },
  });
}
export async function POST(req: Request) {
  await requireRole("owner");
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Missing backup");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 160 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Backup exceeds 160 MB");
      }
      chunks.push(value);
    }
    restoreBackup(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Restore failed" },
      { status: 400 },
    );
  }
}
