"use client";
import { useEffect, useState, useTransition } from "react";
import { useStore } from "@/lib/store";
import {
  workflowState,
  createWorkflow,
  runWorkflow,
  decideWorkflow,
  haltWorkflow,
} from "@/app/workflow-actions";
export default function Workflows() {
  const dots = useStore((s) => s.dots);
  const [data, setData] = useState<Awaited<ReturnType<typeof workflowState>>>({
      definitions: [],
      runs: [],
    }),
    [name, setName] = useState(""),
    [dotId, setDotId] = useState(""),
    [steps, setSteps] = useState(""),
    [review, setReview] = useState(true),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      workflowState()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    void refresh();
    const t = setInterval(refresh, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const act = (fn: () => ReturnType<typeof workflowState>) =>
    start(async () => {
      try {
        setData(await fn());
        setError("");
      } catch (e) {
        setError(String(e));
      }
    });
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-2xl">Workflows</h1>
        <form
          className="surface space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            act(() =>
              createWorkflow({
                name,
                dotId,
                steps: steps
                  .split("\n")
                  .filter((s) => s.trim())
                  .map((instruction) => ({ instruction, review })),
              }),
            );
          }}
        >
          <label>
            Name
            <input
              required
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Dot
            <select
              required
              className="field"
              value={dotId}
              onChange={(e) => setDotId(e.target.value)}
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
            Steps (one instruction per line)
            <textarea
              required
              className="field min-h-32"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={review}
              onChange={(e) => setReview(e.target.checked)}
            />{" "}
            Review each step before continuing
          </label>
          <button disabled={busy} className="btn-primary px-3">
            Save workflow
          </button>
        </form>
        <p role="alert">{error}</p>
        {data.definitions.map((w) => (
          <div key={w.id} className="surface flex justify-between p-4">
            <span>
              {w.name} · {w.steps.length} steps
            </span>
            <button
              disabled={busy}
              className="btn-primary px-3"
              onClick={() => act(() => runWorkflow(w.id))}
            >
              Run
            </button>
          </div>
        ))}
        {data.runs.map((r) => (
          <article key={r.id} className="surface space-y-3 p-4">
            <h2>
              {r.definition.name} · {r.status} · step{" "}
              {Math.min(r.step + 1, r.definition.steps.length)}/
              {r.definition.steps.length}
            </h2>
            <p>{r.error}</p>
            <details>
              <summary>Step results</summary>
              {r.results.map((s, i) => (
                <pre key={i} className="whitespace-pre-wrap text-sm">
                  {i + 1}. {s}
                </pre>
              ))}
            </details>
            {r.status === "review" && (
              <>
                <button
                  disabled={busy}
                  className="btn-primary px-3"
                  onClick={() => act(() => decideWorkflow(r.id, true))}
                >
                  Approve result and continue
                </button>
                <button
                  disabled={busy}
                  className="btn-quiet"
                  onClick={() => act(() => decideWorkflow(r.id, false))}
                >
                  Reject and stop
                </button>
              </>
            )}
            {r.status === "running" && (
              <button
                disabled={busy}
                className="btn-quiet"
                onClick={() => act(() => haltWorkflow(r.id))}
              >
                Stop workflow and dot
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
