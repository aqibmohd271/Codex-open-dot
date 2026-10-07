"use server";
import { requireRole } from "@/server/access";
import { computerInfo } from "@/server/snapshot";
import { canThink } from "@/server/agent/client";
import { db, DATA_DIR } from "@/server/db";
import { listTasks } from "@/server/tasks";
import fs from "node:fs";
export async function diagnostics() {
  await requireRole("owner", "diagnostics");
  let writable = true;
  try {
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
  } catch {
    writable = false;
  }
  const info = computerInfo();
  return [
    {
      name: "AI provider",
      ok: canThink(),
      detail: canThink()
        ? "Configured; use Test connection to verify a custom endpoint"
        : "Add an OpenAI, OpenRouter or custom API provider",
    },
    {
      name: "Database",
      ok: db().prepare("PRAGMA quick_check").get()?.quick_check === "ok",
      detail: "SQLite integrity check",
    },
    {
      name: "Data storage",
      ok: writable,
      detail: writable ? "Writable" : "Cannot write application data",
    },
    {
      name: "Runtime",
      ok: Number(process.versions.node.split(".")[0]) >= 22,
      detail: `Node ${process.versions.node}`,
    },
    {
      name: "Agent computer",
      ok: true,
      detail: `${info.mode}. Local mode is a workspace folder, not an operating-system sandbox.`,
    },
    {
      name: "Recovery",
      ok: !listTasks().some((t) => t.status === "interrupted"),
      detail: `${listTasks().filter((t) => t.status === "interrupted").length} interrupted tasks; review the Task dashboard`,
    },
    {
      name: "Voice",
      ok: info.hasKey,
      detail: info.hasKey
        ? "OpenAI key configured; microphone permission is requested at call start"
        : "Voice needs a direct OpenAI key",
    },
  ];
}
