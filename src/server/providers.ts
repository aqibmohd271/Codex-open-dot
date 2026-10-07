import "server-only";
import OpenAI from "openai";
import { getSetting, setSetting, id, db } from "./db";
import { seal, unseal } from "./vault";
import {
  validateProvider,
  parseCustomModel,
  customModelId,
  type ProviderConfig,
  type ProviderInput,
} from "@/lib/providers";
import { withChatAdapter } from "./agent/chat-adapter";

type Stored = Omit<ProviderConfig, "hasKey"> & { secret: string | null };
const read = (): Stored[] => JSON.parse(getSetting("custom_providers") ?? "[]");
export function listProviders(): ProviderConfig[] {
  return read().map(({ secret, ...config }) => ({
    ...config,
    hasKey: Boolean(secret),
  }));
}
export const customModels = () =>
  listProviders().flatMap((p) => p.models.map((m) => customModelId(p.id, m)));
export function saveProvider(raw: ProviderInput): ProviderConfig[] {
  const input = validateProvider(raw),
    all = read();
  const old = input.id ? all.find((p) => p.id === input.id) : undefined;
  if (input.id && !old) throw new Error("Provider not found");
  // A saved secret may never be silently forwarded to a different endpoint.
  if (
    old &&
    old.baseURL !== input.baseURL &&
    !input.apiKey &&
    input.auth !== "none"
  )
    throw new Error("Re-enter the API key when changing the endpoint");
  const secret =
    input.auth === "none"
      ? null
      : input.apiKey
        ? seal(input.apiKey.trim())
        : (old?.secret ?? null);
  if (input.auth !== "none" && !secret) throw new Error("Enter an API key");
  const next: Stored = {
    id: old?.id ?? id("provider"),
    name: input.name,
    baseURL: input.baseURL,
    format: input.format,
    auth: input.auth,
    models: input.models,
    tools: input.tools,
    images: input.images,
    secret,
  };
  setSetting(
    "custom_providers",
    JSON.stringify([...all.filter((p) => p.id !== next.id), next]),
  );
  return listProviders();
}
export function deleteProvider(providerId: string) {
  const prefix = `custom:${providerId}:`;
  const used = db()
    .prepare("SELECT model FROM dots WHERE model LIKE ?")
    .get(prefix + "%");
  if (used || getSetting("default_model")?.startsWith(prefix))
    throw new Error(
      "Choose a different model for dots and the default before removing this provider",
    );
  setSetting(
    "custom_providers",
    JSON.stringify(read().filter((p) => p.id !== providerId)),
  );
}
export function customClient(appModel: string) {
  const { providerId, model } = parseCustomModel(appModel);
  const p = read().find((p) => p.id === providerId);
  if (!p || !p.models.includes(model))
    throw new Error(
      "The custom provider or deployment is no longer configured",
    );
  const key = p.secret ? unseal(p.secret) : "local-no-key";
  const client = new OpenAI({
    apiKey: key,
    baseURL: p.baseURL,
    maxRetries: 0,
    timeout: 120_000,
    defaultHeaders:
      p.auth === "api-key"
        ? { "api-key": key, Authorization: null }
        : p.auth === "none"
          ? { Authorization: null }
          : {},
    // Do not forward an API key across redirects from a custom server.
    fetch: (url, init) => fetch(url, { ...init, redirect: "error" }),
  });
  return {
    client: p.format === "chat" ? withChatAdapter(client) : client,
    model,
    stateless: true,
    custom: true,
    tools: p.tools,
    images: p.images,
  };
}
export async function testProvider(providerId: string): Promise<string> {
  const p = listProviders().find((p) => p.id === providerId);
  if (!p) throw new Error("Provider not found");
  try {
    const { client, model } = customClient(customModelId(p.id, p.models[0]));
    const response = await client.responses.create({
      model,
      input: "Reply with OK.",
      max_output_tokens: 32,
      store: false,
    });
    if (!response.output_text)
      return "Connected, but the model returned no text. Check the selected deployment.";
    return "Connection verified with a small model request. Tool and image support still depend on the deployment.";
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    return `Connection failed${status ? ` (HTTP ${status})` : ""}. Check the endpoint, key, model name and API format. Provider error details are hidden to protect credentials.`;
  }
}
export async function discoverModels(providerId: string): Promise<string[]> {
  const p = listProviders().find((p) => p.id === providerId);
  if (!p) throw new Error("Provider not found");
  try {
    const { client } = customClient(customModelId(p.id, p.models[0]));
    const page = await client.models.list();
    return page.data.slice(0, 100).map((m) => m.id);
  } catch {
    throw new Error(
      "Model discovery is unavailable. Enter model or Azure deployment names manually.",
    );
  }
}
