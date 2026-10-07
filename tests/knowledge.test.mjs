import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-knowledge-"));
process.env.DOTS_DATA_DIR = dir;
const k = await import("../src/server/knowledge.ts");
const { db } = await import("../src/server/db.ts");
test("knowledge search is scoped, cited and deleted consistently", async () => {
  for (const id of ["a", "b"])
    db()
      .prepare("INSERT INTO dots(id,name,look,created_at) VALUES(?,?,?,?)")
      .run(id, id, "{}", Date.now());
  const parts = await k.extractDocument(
    "guide.md",
    Buffer.from("Maryams delivery takes two days."),
  );
  const id = k.indexDocument(
    "a",
    "guide.md",
    "text/plain",
    Buffer.from("text"),
    parts,
  );
  assert.equal(
    k.searchKnowledge("a", "delivery")[0].source,
    `/api/knowledge/${id}`,
  );
  assert.equal(k.searchKnowledge("b", "delivery").length, 0);
  k.deleteDocument("a", id);
  assert.equal(k.searchKnowledge("a", "delivery").length, 0);
  await assert.rejects(
    () => k.extractDocument("bad.exe", Buffer.from("x")),
    /Supported/,
  );
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

test("real PDF and DOCX extraction retains searchable text", async () => {
  const pdf = await k.extractDocument(
    "sample.pdf",
    Buffer.from(
      "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNTMgPj4Kc3RyZWFtCkJUIC9GMSAxMiBUZiA3MiA3MjAgVGQgKFZlcmlmaWVkIFBERiBrbm93bGVkZ2UpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAzMTEgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0MTQKJSVFT0Y=",
      "base64",
    ),
  );
  assert.match(pdf[0].text, /Verified PDF knowledge/);
  assert.equal(pdf[0].location, "page 1");
  const doc = await k.extractDocument(
    "sample.docx",
    Buffer.from(
      "UEsDBBQAAAAAAHGyRF1Rl+gEFAEAABQBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDxUeXBlcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9jb250ZW50LXR5cGVzIj48RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3dvcmQvZG9jdW1lbnQueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQubWFpbit4bWwiLz48L1R5cGVzPlBLAwQUAAAAAABxskRdex0t4akAAACpAAAAEQAAAHdvcmQvZG9jdW1lbnQueG1sPHc6ZG9jdW1lbnQgeG1sbnM6dz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3dvcmRwcm9jZXNzaW5nbWwvMjAwNi9tYWluIj48dzpib2R5Pjx3OnA+PHc6cj48dzp0PlZlcmlmaWVkIERPQ1gga25vd2xlZGdlPC93OnQ+PC93OnI+PC93OnA+PC93OmJvZHk+PC93OmRvY3VtZW50PlBLAQIUAxQAAAAAAHGyRF1Rl+gEFAEAABQBAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAAAcbJEXXsdLeGpAAAAqQAAABEAAAAAAAAAAAAAAIABRQEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAAB0CAAAAAA==",
      "base64",
    ),
  );
  assert.match(doc[0].text, /Verified DOCX knowledge/);
});
