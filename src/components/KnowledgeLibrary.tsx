"use client";
import { useState, useEffect } from "react";
export default function KnowledgeLibrary({ dotId }: { dotId: string }) {
  const [docs, setDocs] = useState<
      { id: string; name: string; size: number }[]
    >([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const response = await fetch(
      `/api/knowledge?dotId=${encodeURIComponent(dotId)}`,
    );
    if (!response.ok) throw new Error("Could not load library");
    setDocs(await response.json());
  };
  useEffect(() => {
    fetch(`/api/knowledge?dotId=${encodeURIComponent(dotId)}`)
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => setStatus("Could not load library"));
  }, [dotId]);
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    let count = 0;
    const errors = [];
    for (const file of Array.from(files).slice(0, 100)) {
      try {
        const f = new FormData();
        f.set("dotId", dotId);
        f.set("file", file);
        const r = await fetch("/api/knowledge", { method: "POST", body: f });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        count++;
      } catch (e) {
        errors.push(`${file.name}: ${String(e)}`);
      }
    }
    setStatus(
      `Imported ${count} files. ${files.length > 100 ? "Only the first 100 files were processed. " : ""}${errors.join(" · ")}`,
    );
    await refresh().catch(() => {});
    setBusy(false);
  };
  return (
    <section className="surface space-y-3 p-4">
      <h3 className="font-medium">Knowledge library</h3>
      <p className="text-sm">
        Private to this dot. Import PDFs, Word documents, text or a project
        folder. Maximum 10 MB per file, 100 files per batch. OCR is not
        included.
      </p>
      <label>
        Files
        <input
          disabled={busy}
          type="file"
          multiple
          onChange={(e) => void upload(e.target.files)}
        />
      </label>
      <label>
        Folder
        <input
          disabled={busy}
          type="file"
          multiple
          {...{ webkitdirectory: "" }}
          onChange={(e) => void upload(e.target.files)}
        />
      </label>
      <p role="status">{busy ? "Importing…" : status}</p>
      {docs.map((d) => (
        <div key={d.id} className="flex gap-3">
          <a className="flex-1 underline" href={`/api/knowledge/${d.id}`}>
            {d.name}
          </a>
          <button
            disabled={busy}
            className="btn-quiet"
            onClick={async () => {
              const r = await fetch(
                `/api/knowledge?dotId=${encodeURIComponent(dotId)}&id=${d.id}`,
                { method: "DELETE" },
              );
              if (r.ok) await refresh();
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
