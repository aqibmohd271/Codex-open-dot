import "server-only";
import { db, id } from "./db";
import path from "node:path";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
function table() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS knowledge_docs(id TEXT PRIMARY KEY,dot_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,created_at INTEGER NOT NULL);CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks USING fts5(doc_id UNINDEXED,dot_id UNINDEXED,location UNINDEXED,text);`,
  );
  return db();
}
export async function extractDocument(
  name: string,
  data: Buffer,
): Promise<{ location: string; text: string }[]> {
  if (data.length > MAX_DOCUMENT_BYTES)
    throw new Error("Documents must be under 10 MB");
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
    });
    const pdf = await loading.promise;
    try {
      if (pdf.numPages > 200) throw new Error("PDFs are limited to 200 pages");
      const pages = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        pages.push({
          location: `page ${p}`,
          text: content.items.map((i) => ("str" in i ? i.str : "")).join(" "),
        });
      }
      return pages;
    } finally {
      await loading.destroy();
    }
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    return [
      {
        location: "document",
        text: (await mammoth.extractRawText({ buffer: data })).value,
      },
    ];
  }
  if (
    ![
      ".txt",
      ".md",
      ".csv",
      ".json",
      ".ts",
      ".tsx",
      ".js",
      ".py",
      ".html",
      ".css",
      ".log",
    ].includes(ext)
  )
    throw new Error(
      "Supported: PDF, DOCX, text, Markdown, CSV, JSON and source files",
    );
  if (data.includes(0))
    throw new Error("This file does not appear to contain plain text");
  return [{ location: "text", text: data.toString("utf8") }];
}
export function indexDocument(
  dotId: string,
  name: string,
  mime: string,
  data: Buffer,
  parts: { location: string; text: string }[],
) {
  const d = table();
  if (!d.prepare("SELECT id FROM dots WHERE id=?").get(dotId))
    throw new Error("Dot not found");
  const textLength = parts.reduce((n, p) => n + p.text.length, 0);
  if (!textLength)
    throw new Error(
      "No readable text found. Scanned PDFs need OCR before import.",
    );
  if (textLength > 1_000_000)
    throw new Error("Extracted text exceeds one million characters");
  const docId = id("doc");
  d.exec("BEGIN IMMEDIATE");
  try {
    d.prepare("INSERT INTO knowledge_docs VALUES(?,?,?,?,?,?)").run(
      docId,
      dotId,
      name.slice(0, 300),
      mime,
      data,
      Date.now(),
    );
    const insert = d.prepare(
      "INSERT INTO knowledge_chunks(doc_id,dot_id,location,text) VALUES(?,?,?,?)",
    );
    for (const part of parts)
      for (let i = 0; i < part.text.length; i += 1600)
        insert.run(
          docId,
          dotId,
          `${part.location}, section ${Math.floor(i / 1600) + 1}`,
          part.text.slice(i, i + 2000),
        );
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return docId;
}
export function listDocuments(dotId: string) {
  return table()
    .prepare(
      "SELECT id,name,mime,length(data) AS size,created_at AS createdAt FROM knowledge_docs WHERE dot_id=? ORDER BY created_at DESC",
    )
    .all(dotId);
}
export function deleteDocument(dotId: string, docId: string) {
  const d = table();
  d.exec("BEGIN IMMEDIATE");
  try {
    d.prepare("DELETE FROM knowledge_chunks WHERE dot_id=? AND doc_id=?").run(
      dotId,
      docId,
    );
    d.prepare("DELETE FROM knowledge_docs WHERE dot_id=? AND id=?").run(
      dotId,
      docId,
    );
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
export function searchKnowledge(dotId: string, query: string) {
  const terms = query.match(/[\p{L}\p{N}_-]+/gu)?.slice(0, 12) ?? [];
  if (!terms.length) return [];
  const q = terms.map((s) => '"' + s.replace(/"/g, '""') + '"').join(" OR ");
  return table()
    .prepare(
      `SELECT c.doc_id AS id,d.name,c.location,c.text,bm25(knowledge_chunks) AS rank FROM knowledge_chunks c JOIN knowledge_docs d ON d.id=c.doc_id WHERE knowledge_chunks MATCH ? AND c.dot_id=? ORDER BY rank LIMIT 8`,
    )
    .all(q, dotId)
    .map((r) => ({ ...r, source: `/api/knowledge/${r.id}` }));
}
export function getDocumentFile(docId: string) {
  return table()
    .prepare("SELECT name,mime,data FROM knowledge_docs WHERE id=?")
    .get(docId);
}
