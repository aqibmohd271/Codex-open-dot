"use client";
import { useState } from "react";
export default function BackupSettings() {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="surface mb-3 space-y-3 p-4">
      <h3>Backup and restore</h3>
      <p className="text-sm">
        Exports chats, memories, workflows, schedules, knowledge documents and
        attached files. API keys, passwords, login sessions, browser profiles
        and remote workspaces are excluded. Chat/document content may still be
        sensitive. Restore requires an empty workspace; imported dots and
        schedules remain paused.
      </p>
      <a className="btn-secondary" href="/api/admin/backup">
        Download backup
      </a>
      <label className="block">
        Restore into this empty workspace
        <input
          disabled={busy}
          type="file"
          accept=".json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              const r = await fetch("/api/admin/backup", {
                method: "POST",
                body: f,
              });
              const result = await r.json();
              if (!r.ok) throw new Error(result.error);
              setStatus(
                "Restored. Reload the app, add credentials, and review imported settings before resuming.",
              );
            } catch (e) {
              setStatus(String(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p role="status">{status}</p>
    </section>
  );
}
