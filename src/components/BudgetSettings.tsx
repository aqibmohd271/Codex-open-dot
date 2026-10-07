"use client";
import { useEffect, useState, useTransition } from "react";
import { getBudget, updateBudget } from "@/app/budget-actions";
import type { BudgetConfig } from "@/server/budget";
export default function BudgetSettings() {
  const [config, setConfig] = useState<BudgetConfig | null>(null),
    [prices, setPrices] = useState("{}"),
    [usage, setUsage] = useState(""),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    getBudget()
      .then((r) => {
        setConfig(r.config);
        setPrices(JSON.stringify(r.config.prices, null, 2));
        setUsage(JSON.stringify(r.usage, null, 2));
      })
      .catch(() => setError("Could not load budgets"));
  }, []);
  if (!config) return <p>{error || "Loading budgets…"}</p>;
  return (
    <section className="surface mb-3 space-y-3 p-4">
      <h3 className="font-medium">Model spending and run limits</h3>
      <p className="text-sm">
        Prices are USD per million tokens, keyed by the exact model picker ID.
        Limits cover model requests made by the agent, reviewer and title
        generator. External tool/service fees and connection tests are separate.
        Daily limits reset at midnight UTC. Missing prices block requests when
        limits are enabled; uncertain charges remain reserved.
      </p>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />{" "}
        Enforce model spending limits (text-only; voice and hosted search
        disabled)
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["dailyPerDot", "Daily budget per dot ($)"],
            ["perTask", "Budget per task ($)"],
            ["maxSteps", "Maximum model steps"],
            ["maxOutputTokens", "Maximum output tokens"],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              className="field"
              type="number"
              min="0"
              step="any"
              value={config[k]}
              onChange={(e) =>
                setConfig({ ...config, [k]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <label>
        Model prices
        <textarea
          className="field min-h-28 font-mono"
          value={prices}
          onChange={(e) => setPrices(e.target.value)}
          placeholder={'{"model-id":{"input":1,"output":5}}'}
        />
      </label>
      <button
        className="btn-primary px-3 py-2"
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              const r = await updateBudget({
                ...config,
                prices: JSON.parse(prices),
              });
              setConfig(r.config);
              setUsage(JSON.stringify(r.usage, null, 2));
              setError("Saved");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invalid settings");
            }
          })
        }
      >
        Save limits
      </button>
      <p role="status">{error}</p>
      <details>
        <summary>
          Usage by dot and model (unpriced requests are not free)
        </summary>
        <pre className="overflow-auto text-xs">{usage}</pre>
      </details>
    </section>
  );
}
