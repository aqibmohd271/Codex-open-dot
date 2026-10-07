"use client";
import { useState, useEffect, useTransition } from "react";
import { useStore } from "@/lib/store";
import {
  getConnections,
  saveConnection,
  deleteConnection,
} from "@/app/connection-actions";
export default function ConnectionSettings() {
  const dots = useStore((s) => s.dots);
  const [connections, setConnections] = useState<
      Awaited<ReturnType<typeof getConnections>>
    >([]),
    [form, setForm] = useState({
      name: "",
      url: "",
      kind: "mcp" as "mcp" | "http",
      dotId: "",
      apiKey: "",
    }),
    [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    getConnections()
      .then(setConnections)
      .catch(() => setMessage("Could not load connections"));
  }, []);
  return (
    <section className="surface mb-3 space-y-3 p-4">
      <h3>Custom tool connections</h3>
      <p className="text-sm">
        Streamable HTTP MCP servers and JSON POST APIs. Tools are scoped to one
        dot and ask before running unless you explicitly add an allow rule.
        OAuth and local command servers are not supported here.
      </p>
      {connections.map((c) => (
        <div key={c.id} className="flex gap-3">
          <span className="flex-1">
            {c.name} · {c.tools.length} tools
          </span>
          <button
            className="btn-quiet"
            disabled={busy}
            onClick={() =>
              start(async () => {
                try {
                  setConnections(await deleteConnection(c.id));
                } catch {
                  setMessage("Could not remove connection");
                }
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              setConnections(await saveConnection(form));
              setForm({ ...form, name: "", url: "", apiKey: "" });
              setMessage("Connected");
            } catch (e) {
              setMessage(String(e));
            }
          });
        }}
      >
        <label>
          Name
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Endpoint
          <input
            required
            type="url"
            className="field"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </label>
        <label>
          Protocol
          <select
            className="field"
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as "mcp" | "http" })
            }
          >
            <option value="mcp">MCP (Streamable HTTP)</option>
            <option value="http">JSON POST API</option>
          </select>
        </label>
        <label>
          Dot
          <select
            required
            className="field"
            value={form.dotId}
            onChange={(e) => setForm({ ...form, dotId: e.target.value })}
          >
            <option value="">Choose a dot</option>
            {dots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bearer token (optional)
          <input
            type="password"
            autoComplete="new-password"
            className="field"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
        </label>
        <button disabled={busy} className="btn-primary px-3">
          {busy ? "Connecting…" : "Add connection"}
        </button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
