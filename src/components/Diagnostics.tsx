"use client";
import { useState, useEffect, useTransition } from "react";
import { diagnostics } from "@/app/diagnostic-actions";
export default function Diagnostics() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof diagnostics>>>(
      [],
    ),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    diagnostics()
      .then(setItems)
      .catch(() => setError("Could not load diagnostics"));
  }, []);
  return (
    <section className="surface mb-5 space-y-3 p-4">
      <div className="flex justify-between">
        <h2 className="font-medium">Setup and diagnostics</h2>
        <button
          disabled={busy}
          className="btn-quiet"
          onClick={() =>
            start(async () => {
              try {
                setItems(await diagnostics());
                setError("");
              } catch {
                setError("Could not refresh diagnostics");
              }
            })
          }
        >
          Refresh
        </button>
      </div>
      <p className="text-sm">
        1. Connect a provider below. 2. Choose a model. 3. Create a dot. 4. Run
        a small task and review its result before adding routines.
      </p>
      {items.map((i) => (
        <div key={i.name} className="flex gap-3 text-sm">
          <span aria-label={i.ok ? "Ready" : "Needs attention"}>
            {i.ok ? "✓" : "!"}
          </span>
          <strong>{i.name}</strong>
          <span>{i.detail}</span>
        </div>
      ))}
      <p role="status">{error}</p>
    </section>
  );
}
