"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getTasks, resumeTask, stopTaskDot } from "@/app/task-actions";
import type { TaskRecord } from "@/server/tasks";
import { useStore } from "@/lib/store";
export default function TaskDashboard() {
  const [tasks, setTasks] = useState<
      (TaskRecord & {
        verification?: string;
        checks?: { name: unknown; evidence: unknown }[];
      })[]
    >([]),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dots = useStore((s) => s.dots);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getTasks()
        .then((t) => {
          if (alive) setTasks(t);
        })
        .catch(() => {
          if (alive) setError("Could not refresh tasks");
        });
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const act = (fn: () => Promise<TaskRecord[]>) =>
    start(async () => {
      try {
        setError("");
        setTasks(await fn());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-medium">Task dashboard</h1>
        <p className="text-foreground/60">
          Saved progress across your dots. Resuming reviews earlier work; it
          does not blindly replay external actions.
        </p>
        <select
          aria-label="Filter task status"
          className="field max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "all",
            "queued",
            "running",
            "waiting",
            "completed",
            "failed",
            "interrupted",
            "cancelled",
            "resumed",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {error && <p role="alert">{error}</p>}
        {tasks
          .filter((t) => filter === "all" || t.status === filter)
          .map((t) => (
            <article key={t.id} className="surface space-y-3 p-4">
              <div className="flex flex-wrap gap-3">
                <strong>
                  {dots.find((d) => d.id === t.dotId)?.name ?? "Deleted dot"}
                </strong>
                <span className="rounded bg-black/5 px-2">{t.status}</span>
                <time className="ml-auto text-sm">
                  {new Date(t.updatedAt).toLocaleString()}
                </time>
              </div>
              <p className="whitespace-pre-wrap">{t.instruction}</p>
              <p className="text-sm text-foreground/60">
                {t.progress || "Waiting to start"} · {t.steps} model steps ·
                Verification: {t.verification ?? "unverified"}
              </p>
              {t.checks?.length ? (
                <details>
                  <summary>Verification evidence</summary>
                  {t.checks.map((c, i) => (
                    <pre key={i} className="whitespace-pre-wrap text-xs">
                      {String(c.name)}: {String(c.evidence)}
                    </pre>
                  ))}
                </details>
              ) : null}
              {t.error && <p className="text-destructive">{t.error}</p>}
              {t.result && (
                <details>
                  <summary>Result / latest response</summary>
                  <p className="whitespace-pre-wrap">{t.result}</p>
                </details>
              )}
              <div className="flex gap-3">
                <Link
                  className="btn-quiet"
                  href={`/dots/${t.dotId}?c=${t.conversationId}`}
                >
                  Open conversation
                </Link>
                {["interrupted", "failed", "cancelled"].includes(t.status) && (
                  <button
                    className="btn-primary px-3"
                    disabled={busy}
                    onClick={() => act(() => resumeTask(t.id))}
                  >
                    Review and resume
                  </button>
                )}
                {t.status === "running" && (
                  <button
                    className="btn-quiet"
                    disabled={busy}
                    onClick={() => act(() => stopTaskDot(t.dotId))}
                  >
                    Stop dot
                  </button>
                )}
              </div>
            </article>
          ))}
        {!tasks.length && (
          <p>No tasks yet. Send a message to a dot to start.</p>
        )}
      </div>
    </div>
  );
}
