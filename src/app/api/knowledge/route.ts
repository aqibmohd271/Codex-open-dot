import {
  extractDocument,
  indexDocument,
  MAX_DOCUMENT_BYTES,
  listDocuments,
  deleteDocument,
} from "@/server/knowledge";
export async function GET(req: Request) {
  const dotId = new URL(req.url).searchParams.get("dotId");
  return Response.json(dotId ? listDocuments(dotId) : [], {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  deleteDocument(
    url.searchParams.get("dotId") ?? "",
    url.searchParams.get("id") ?? "",
  );
  return Response.json({ ok: true });
}
export async function POST(req: Request) {
  try {
    const reader = req.body?.getReader();
    if (!reader)
      return Response.json({ error: "Missing file" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_DOCUMENT_BYTES + 65536) {
        await reader.cancel();
        return Response.json({ error: "File too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file"),
      dotId = String(form.get("dotId") ?? "");
    if (!(file instanceof File)) throw new Error("Choose a file");
    const data = Buffer.from(await file.arrayBuffer());
    const parts = await extractDocument(file.name, data);
    const id = indexDocument(
      dotId,
      file.name,
      file.type || "application/octet-stream",
      data,
      parts,
    );
    return Response.json({ id });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 },
    );
  }
}
