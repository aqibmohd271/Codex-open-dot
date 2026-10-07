"use client";
import { useEffect, useState, useTransition } from "react";
import {
  workspaceState,
  createMember,
  revokeMember,
} from "@/app/workspace-actions";
export default function WorkspaceSettings() {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof workspaceState>
    > | null>(null),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState<"owner" | "member" | "viewer">("member"),
    [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    workspaceState()
      .then(setData)
      .catch(() => setMessage("Could not load workspace"));
  }, []);
  return (
    <section className="surface mb-3 space-y-3 p-4">
      <h3>Workspace · {data?.id}</h3>
      <p className="text-sm">
        Each server instance is one isolated workspace. All its members can read
        its shared chats and files. Members can run agents and approve actions;
        owners also manage credentials and membership. Viewers have read-only
        access.
      </p>
      {!data?.enabled ? (
        <p>
          For shared access, deploy an authenticated server using
          docs/SERVER.md. This local app is currently single-user.
        </p>
      ) : (
        <>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  setData(await createMember(username, password, role));
                  setPassword("");
                  setUsername("");
                  setMessage("Member created");
                } catch (e) {
                  setMessage(String(e));
                }
              });
            }}
          >
            <label>
              Username
              <input
                className="field"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Initial password
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                required
                minLength={16}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Role
              <select
                aria-label="Role"
                className="field"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member (trusted agent operator)</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <button disabled={busy} className="btn-primary px-3">
              Add member
            </button>
          </form>
          {data.members.map((m) => (
            <div key={String(m.username)} className="flex gap-3">
              <span className="flex-1">
                {String(m.username)} · {String(m.role)} ·{" "}
                {m.enabled ? "enabled" : "disabled"}
              </span>
              <button
                disabled={busy || !m.enabled}
                className="btn-quiet"
                onClick={() =>
                  start(async () => {
                    try {
                      setData(await revokeMember(String(m.username)));
                    } catch (e) {
                      setMessage(String(e));
                    }
                  })
                }
              >
                Disable
              </button>
            </div>
          ))}
        </>
      )}
      <p role="status">{message}</p>
      <details>
        <summary>Activity history (authorization records)</summary>
        {data?.activity.map((a, i) => (
          <p key={i} className="text-xs">
            {new Date(Number(a.createdAt)).toLocaleString()} · {String(a.actor)}{" "}
            · {String(a.action)}
          </p>
        ))}
      </details>
    </section>
  );
}
