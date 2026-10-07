"use client";
import { useEffect, useState, useTransition } from "react";
import {
  getProviders,
  saveCustomProvider,
  removeCustomProvider,
  testCustomProvider,
  fetchCustomModels,
} from "@/app/provider-actions";
import type { ProviderConfig, ProviderInput } from "@/lib/providers";
const empty: ProviderInput = {
  name: "",
  baseURL: "",
  apiKey: "",
  format: "chat",
  auth: "bearer",
  models: [],
  tools: true,
  images: false,
};
export default function CustomProviders() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState<ProviderInput>(empty);
  const [names, setNames] = useState("");
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    getProviders()
      .then(setProviders)
      .catch(() => setMessage("Could not load providers"));
  }, []);
  const run = (action: () => Promise<void>) =>
    start(async () => {
      try {
        setMessage("");
        await action();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Operation failed");
      }
    });
  return (
    <div className="surface mb-3 space-y-4 p-4">
      <h3 className="font-medium">Custom API providers</h3>
      <p className="text-body-sm text-foreground/60">
        Connect Azure deployments or compatible APIs. Chat Completions responses
        appear when finished; Responses endpoints stream. Test requests may
        incur API charges.
      </p>
      {providers.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-3"
        >
          <span className="mr-auto">
            {p.name} · {p.models.join(", ")}
          </span>
          <button
            className="btn-quiet"
            disabled={busy}
            onClick={() => {
              setForm({ ...p, apiKey: "" });
              setNames(p.models.join("\n"));
            }}
          >
            Edit
          </button>
          <button
            className="btn-quiet"
            disabled={busy}
            onClick={() =>
              run(async () => setMessage(await testCustomProvider(p.id)))
            }
          >
            Test connection
          </button>
          <button
            className="btn-quiet"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const ids = await fetchCustomModels(p.id);
                setForm({ ...p, apiKey: "" });
                setNames(ids.join("\n"));
                setMessage(
                  "Review discovered names, then save. Azure may require your deployment name instead.",
                );
              })
            }
          >
            Fetch models
          </button>
          <button
            className="btn-quiet"
            disabled={busy}
            onClick={() =>
              run(async () => setProviders(await removeCustomProvider(p.id)))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            setProviders(
              await saveCustomProvider({
                ...form,
                models: names
                  .split(/[,\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              }),
            );
            setForm(empty);
            setNames("");
            setMessage("Provider saved. Choose its model in the model picker.");
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
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
            API base URL
            <input
              required
              className="field"
              type="url"
              placeholder="https://resource.openai.azure.com/openai/v1"
              value={form.baseURL}
              onChange={(e) => setForm({ ...form, baseURL: e.target.value })}
            />
          </label>
          <label>
            API format
            <select
              aria-label="API format"
              className="field"
              value={form.format}
              onChange={(e) =>
                setForm({
                  ...form,
                  format: e.target.value as ProviderInput["format"],
                })
              }
            >
              <option value="chat">Chat Completions</option>
              <option value="responses">Responses</option>
            </select>
          </label>
          <label>
            Authentication
            <select
              aria-label="Authentication"
              className="field"
              value={form.auth}
              onChange={(e) =>
                setForm({
                  ...form,
                  auth: e.target.value as ProviderInput["auth"],
                })
              }
            >
              <option value="bearer">Bearer token</option>
              <option value="api-key">API-key header (Azure)</option>
              <option value="none">None (local server)</option>
            </select>
          </label>
          <label>
            API key
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              placeholder={
                form.id ? "Leave blank to keep saved key" : "Secret key"
              }
              value={form.apiKey ?? ""}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </label>
          <label>
            Model / deployment names
            <textarea
              required
              className="field"
              placeholder="One per line"
              value={names}
              onChange={(e) => setNames(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          <label>
            <input
              type="checkbox"
              checked={form.tools}
              onChange={(e) => setForm({ ...form, tools: e.target.checked })}
            />{" "}
            Tool calling
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.images}
              onChange={(e) => setForm({ ...form, images: e.target.checked })}
            />{" "}
            Image input
          </label>
        </div>
        <button className="btn-primary px-4 py-2" disabled={busy}>
          {busy ? "Working…" : form.id ? "Save changes" : "Add provider"}
        </button>
        {form.id && (
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              setForm(empty);
              setNames("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {message && (
        <p role="status" className="text-body-sm">
          {message}
        </p>
      )}
    </div>
  );
}
