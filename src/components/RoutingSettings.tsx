"use client";
import { useEffect, useState, useTransition } from "react";
import { getRouting, updateRouting } from "@/app/routing-actions";
import type { RoutingConfig } from "@/server/routing";
import ModelPicker from "./ModelPicker";
export default function RoutingSettings() {
  const [config, setConfig] = useState<RoutingConfig | null>(null),
    [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    getRouting()
      .then(setConfig)
      .catch(() => setMessage("Could not load routing"));
  }, []);
  if (!config) return <p>{message}</p>;
  return (
    <section className="surface mb-3 space-y-3 p-4">
      <h3>Automatic model selection</h3>
      <p className="text-sm">
        Applies to dots using the default model. Choose economical and stronger
        models yourself; routing uses your keywords and request length. Spending
        limits still apply.
      </p>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />{" "}
        Enable routing
      </label>
      <div className="flex flex-wrap gap-4">
        <label>
          Simple tasks
          <ModelPicker
            allowDefault={false}
            value={config.simple || null}
            onChange={(m) => setConfig({ ...config, simple: m ?? "" })}
          />
        </label>
        <label>
          Complex tasks
          <ModelPicker
            allowDefault={false}
            value={config.complex || null}
            onChange={(m) => setConfig({ ...config, complex: m ?? "" })}
          />
        </label>
      </div>
      <label>
        Complex-task keywords (comma separated)
        <input
          className="field"
          value={config.keywords.join(",")}
          onChange={(e) =>
            setConfig({ ...config, keywords: e.target.value.split(",") })
          }
        />
      </label>
      <label>
        Request length threshold
        <input
          className="field"
          type="number"
          value={config.threshold}
          onChange={(e) =>
            setConfig({ ...config, threshold: Number(e.target.value) })
          }
        />
      </label>
      <button
        className="btn-primary px-3 py-2"
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              setConfig(await updateRouting(config));
              setMessage("Saved");
            } catch (e) {
              setMessage(String(e));
            }
          })
        }
      >
        Save routing
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
