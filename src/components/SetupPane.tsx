"use client";
import KnowledgeLibrary from "./KnowledgeLibrary";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import * as actions from "@/app/actions";
import { useStore } from "@/lib/store";
import LookEditor from "./LookEditor";
import { DotTriggers } from "./Triggers";
import Dot3DLazy from "./Dot3DLazy";
import {
  Empty,
  PageHeader,
  RemoveButton,
  RuleEditor,
  Section,
} from "./SettingsKit";
import type { Dot } from "@/lib/types";

const SCHEDULES = [
  { label: "Every morning", cron: "0 8 * * *" },
  { label: "Weekdays 9am", cron: "0 9 * * 1-5" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Mondays", cron: "0 9 * * 1" },
];

export default function SetupPane({ dot }: { dot: Dot }) {
  const router = useRouter();
  const allRoutines = useStore((s) => s.routines);
  const allMemories = useStore((s) => s.memories);
  const allSkills = useStore((s) => s.skills);
  const routines = useMemo(
    () => allRoutines.filter((r) => r.dotId === dot.id),
    [allRoutines, dot.id],
  );
  const memories = useMemo(
    () =>
      allMemories.filter(
        (m) =>
          m.scope === "personal" ||
          (m.scope === "project" &&
            dot.projectId &&
            m.projectId === dot.projectId) ||
          (m.scope === "dot" && m.dotId === dot.id),
      ),
    [allMemories, dot.id, dot.projectId],
  );
  const skills = useMemo(
    () => allSkills.filter((k) => k.dotId === dot.id),
    [allSkills, dot.id],
  );

  const [name, setName] = useState(dot.name);
  const [purpose, setPurpose] = useState(dot.purpose);
  const [instructions, setInstructions] = useState(dot.instructions);
  const [look, setLook] = useState(dot.look);
  const [memory, setMemory] = useState("");
  const [projectId, setProjectId] = useState(dot.projectId ?? "");
  const [memoryScope, setMemoryScope] = useState<
    "dot" | "personal" | "project"
  >("dot");
  const [editingMemory, setEditingMemory] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [routine, setRoutine] = useState({
    name: "",
    instruction: "",
    schedule: "0 8 * * *",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    missedPolicy: "skip" as "skip" | "catch-up",
  });
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [skillOpen, setSkillOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const dirty =
    projectId !== (dot.projectId ?? "") ||
    name !== dot.name ||
    purpose !== dot.purpose ||
    instructions !== dot.instructions ||
    JSON.stringify(look) !== JSON.stringify(dot.look);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="rails mx-auto min-h-full max-w-[1080px] px-4 sm:px-8 pb-16">
        <PageHeader
          eyebrow="Setup"
          title={`How ${dot.name} works`}
          description="Personality, rules, routines, memory, and skills. Your dot also updates these itself as you work together."
        />

        <Section
          eyebrow="Identity"
          title="Personality & appearance"
          description="Its name, job, and how you want it to work."
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <label className="block">
                <span className="eyebrow mb-1.5 block">Name</span>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1.5 block">
                  Project (dots with the same project share project memories)
                </span>
                <input
                  className="field"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Optional project name"
                />
                <span className="eyebrow mb-1.5 block">Job</span>
                <input
                  className="field"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What this dot is for"
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1.5 block">Instructions</span>
                <textarea
                  className="field h-auto min-h-28 resize-y py-2 leading-normal"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Tone, preferences, things to always or never do…"
                />
              </label>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Specialist role presets"
              >
                {[
                  [
                    "Researcher",
                    "Research the assigned question, compare primary sources, and cite evidence. Distinguish findings from assumptions.",
                  ],
                  [
                    "Developer",
                    "Implement the assigned change, preserve existing behavior, and run relevant tests. Report exact changes and verification.",
                  ],
                  [
                    "Reviewer",
                    "Independently review the assigned work for correctness, security, and missing tests. Give actionable findings with evidence.",
                  ],
                ].map(([role, body]) => (
                  <button
                    key={role}
                    type="button"
                    className="btn-quiet"
                    onClick={() => {
                      setPurpose(role);
                      setInstructions(body);
                    }}
                  >
                    Use {role} role
                  </button>
                ))}
              </div>
              <div className="pt-2">
                <LookEditor look={look} onChange={setLook} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 lg:sticky lg:top-6 lg:self-start">
              <div className="dot-grid surface flex w-full justify-center py-2">
                <Dot3DLazy look={look} size={190} stage />
              </div>
              <button
                className="btn-primary w-full"
                disabled={!dirty || pending}
                onClick={() =>
                  start(() =>
                    actions.updateDot(dot.id, {
                      name,
                      purpose,
                      instructions,
                      look,
                      projectId,
                    }),
                  )
                }
              >
                {dirty ? "Save changes" : "Saved"}
              </button>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Approvals"
          title="Rules"
          description={`${dot.name} knows when to take action and when to ask for approval. Add custom rules for more control.`}
        >
          <RuleEditor dotId={dot.id} name={dot.name} />
        </Section>

        <Section
          eyebrow="Automation"
          title="Routines"
          description={`Recurring tasks ${dot.name} runs on a schedule. You can also just ask it in chat.`}
        >
          <div className="space-y-3">
            {routines.length > 0 ? (
              <div className="surface divide-y divide-black/[0.06]">
                {routines.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 py-3 pr-2 pl-4"
                  >
                    <span
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${r.enabled ? "bg-success" : "bg-foreground/25"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px]">{r.name}</span>
                        <code className="rounded-xs bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-foreground/55">
                          {r.schedule} · {r.timezone} · {r.missedPolicy}
                        </code>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-body-sm text-foreground/55">
                        {r.instruction}
                      </div>
                      <div className="mt-1 font-mono text-[10px] tracking-wider text-foreground/40 uppercase">
                        {r.enabled && r.nextRunAt
                          ? `Next ${new Date(r.nextRunAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                          : "Paused"}
                        {r.lastRunAt
                          ? ` · Last ${new Date(r.lastRunAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                          : ""}
                      </div>
                    </div>
                    <button
                      className="btn-quiet"
                      onClick={() => start(() => actions.runRoutineNow(r.id))}
                    >
                      <Play className="size-3" strokeWidth={2} /> Run
                    </button>
                    <button
                      className="btn-quiet"
                      onClick={() =>
                        start(() => actions.toggleRoutine(r.id, !r.enabled))
                      }
                    >
                      {r.enabled ? "Pause" : "Resume"}
                    </button>
                    <RemoveButton
                      label="Delete routine"
                      onClick={() => start(() => actions.deleteRoutine(r.id))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                No routines yet. Try &ldquo;Every weekday at 8am, brief me on AI
                news&rdquo; in chat.
              </Empty>
            )}
            <form
              className="surface space-y-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const err = await actions.addRoutine(
                    dot.id,
                    routine.name,
                    routine.instruction,
                    routine.schedule,
                    routine.timezone,
                    routine.missedPolicy,
                  );
                  setRoutineError(err);
                  if (!err)
                    setRoutine({ ...routine, name: "", instruction: "" });
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <input
                  className="field"
                  placeholder="Name"
                  value={routine.name}
                  onChange={(e) =>
                    setRoutine({ ...routine, name: e.target.value })
                  }
                />
                <input
                  className="field"
                  placeholder="What to do each time"
                  value={routine.instruction}
                  onChange={(e) =>
                    setRoutine({ ...routine, instruction: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SCHEDULES.map((s) => (
                  <button
                    key={s.cron}
                    type="button"
                    onClick={() => setRoutine({ ...routine, schedule: s.cron })}
                    className={`h-8 rounded-md border px-2.5 text-[13px] transition-colors ${routine.schedule === s.cron ? "border-foreground bg-foreground text-card" : "border-black/10 text-foreground/70 hover:border-black/25"}`}
                  >
                    {s.label}
                  </button>
                ))}
                <input
                  className="field h-8 w-36 font-mono text-[12px]"
                  value={routine.schedule}
                  onChange={(e) =>
                    setRoutine({ ...routine, schedule: e.target.value })
                  }
                  aria-label="Cron schedule"
                />
                <input
                  className="field h-8 w-44"
                  aria-label="Schedule time zone"
                  value={routine.timezone}
                  onChange={(e) =>
                    setRoutine({ ...routine, timezone: e.target.value })
                  }
                />
                <select
                  className="field h-8 w-44"
                  aria-label="Missed runs"
                  value={routine.missedPolicy}
                  onChange={(e) =>
                    setRoutine({
                      ...routine,
                      missedPolicy: e.target.value as "skip" | "catch-up",
                    })
                  }
                >
                  <option value="skip">Skip missed runs</option>
                  <option value="catch-up">Catch up once</option>
                </select>
                <button
                  className="btn-primary ml-auto h-8 px-3 text-[13px]"
                  disabled={pending || !routine.instruction.trim()}
                >
                  Add routine
                </button>
              </div>
              {routineError && (
                <p className="text-caption text-destructive">{routineError}</p>
              )}
            </form>
          </div>
        </Section>

        <Section
          eyebrow="Automation"
          title="Triggers"
          description={`Wake ${dot.name} when something happens in your apps, like a new email or a Slack mention. It runs in its own chat and still asks before sending anything.`}
        >
          <DotTriggers dot={dot} />
        </Section>

        <Section
          eyebrow="Memory"
          title="What it knows about you"
          description={`${dot.name} adds to this as you work together. Remove anything that's wrong.`}
        >
          <div className="space-y-3">
            {memories.length > 0 ? (
              <div className="surface divide-y divide-black/[0.06]">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 py-2 pr-2 pl-4"
                  >
                    {editingMemory === m.id ? (
                      <>
                        <input
                          className="field"
                          value={memoryDraft}
                          onChange={(e) => setMemoryDraft(e.target.value)}
                        />
                        <button
                          className="btn-quiet"
                          onClick={() =>
                            start(async () => {
                              await actions.editMemory(m.id, memoryDraft);
                              setEditingMemory(null);
                            })
                          }
                        >
                          Save
                        </button>
                        <button
                          className="btn-quiet"
                          onClick={() => setEditingMemory(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-body-sm">
                          {m.text}{" "}
                          <small>
                            ({m.scope}
                            {m.projectId ? ` · ${m.projectId}` : ""})
                          </small>
                        </span>
                        <button
                          className="btn-quiet"
                          onClick={() => {
                            setEditingMemory(m.id);
                            setMemoryDraft(m.text);
                          }}
                        >
                          Edit
                        </button>
                      </>
                    )}
                    <RemoveButton
                      label="Forget"
                      onClick={() => start(() => actions.deleteMemory(m.id))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Nothing yet.</Empty>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(() => actions.addMemory(dot.id, memory, memoryScope));
                setMemory("");
              }}
            >
              <select
                className="field max-w-40"
                aria-label="Memory scope"
                value={memoryScope}
                onChange={(e) =>
                  setMemoryScope(e.target.value as typeof memoryScope)
                }
              >
                <option value="dot">Only this dot</option>
                <option value="personal">Personal (all dots)</option>
                <option value="project" disabled={!dot.projectId}>
                  This project
                </option>
              </select>
              <input
                className="field"
                placeholder="Add something it should remember"
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
              />
              <button
                className="btn-secondary shrink-0"
                disabled={!memory.trim()}
              >
                Add
              </button>
            </form>
          </div>
        </Section>

        <KnowledgeLibrary dotId={dot.id} />

        <Section
          eyebrow="Skills"
          title="Repeatable know-how"
          description="Markdown instructions it follows for tasks it repeats. Ask your dot to save one after it figures something out."
        >
          {skills.length > 0 ? (
            <div className="surface divide-y divide-black/[0.06]">
              {skills.map((k) => (
                <div key={k.id} className="py-2.5 pr-2 pl-4">
                  <div className="flex items-center gap-3">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setSkillOpen(skillOpen === k.id ? null : k.id)
                      }
                    >
                      <span className="block text-[14px]">{k.name}</span>
                      <span className="block truncate text-body-sm text-foreground/55">
                        {k.description}
                      </span>
                    </button>
                    <RemoveButton
                      label="Delete skill"
                      onClick={() => start(() => actions.deleteSkill(k.id))}
                    />
                  </div>
                  {skillOpen === k.id && (
                    <pre className="mt-2 mr-2 rounded-md bg-popover p-3 font-mono text-[12px] whitespace-pre-wrap text-foreground/75">
                      {k.body}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty>No skills yet.</Empty>
          )}
        </Section>

        <Section
          eyebrow="Danger zone"
          title={`Delete ${dot.name}`}
          description="Removes its chat, memory, routines, triggers, and computer. This can't be undone."
        >
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                className="btn bg-destructive text-card hover:opacity-90"
                onClick={() =>
                  start(
                    async () => (
                      await actions.deleteDot(dot.id),
                      router.push("/")
                    ),
                  )
                }
              >
                Yes, delete {dot.name}
              </button>
              <button
                className="btn-quiet"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn-secondary text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete {dot.name}…
            </button>
          )}
        </Section>
      </div>
    </div>
  );
}
