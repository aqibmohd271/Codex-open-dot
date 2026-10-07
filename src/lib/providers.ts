export type ProviderConfig = {
  id: string;
  name: string;
  baseURL: string;
  format: "chat" | "responses";
  auth: "bearer" | "api-key" | "none";
  models: string[];
  tools: boolean;
  images: boolean;
  hasKey: boolean;
};
export type ProviderInput = Omit<ProviderConfig, "id" | "hasKey"> & {
  id?: string;
  apiKey?: string;
};
export const customModelId = (id: string, model: string) =>
  `custom:${id}:${encodeURIComponent(model)}`;
export function parseCustomModel(value: string) {
  const m = /^custom:([a-zA-Z0-9_-]+):(.+)$/.exec(value);
  if (!m) throw new Error("Invalid custom model identifier");
  return { providerId: m[1], model: decodeURIComponent(m[2]) };
}
export function validateProvider(input: ProviderInput): ProviderInput {
  if (
    !input ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 80
  )
    throw new Error("Enter a provider name (1–80 characters)");
  const url = new URL(input.baseURL);
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "Use a base URL without credentials, query parameters or a fragment",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("Use HTTPS, or HTTP for a local model server");
  if (
    !["chat", "responses"].includes(input.format) ||
    !["bearer", "api-key", "none"].includes(input.auth)
  )
    throw new Error("Unsupported API format or authentication");
  if (
    !Array.isArray(input.models) ||
    !input.models.length ||
    input.models.length > 100 ||
    input.models.some(
      (m) => typeof m !== "string" || !m.trim() || m.length > 200,
    )
  )
    throw new Error("Enter 1–100 model or deployment names");
  if (typeof input.tools !== "boolean" || typeof input.images !== "boolean")
    throw new Error("Choose model capabilities");
  if (
    input.apiKey &&
    (input.apiKey.length > 8192 || /[\r\n]/.test(input.apiKey))
  )
    throw new Error("Invalid API key");
  return {
    ...input,
    name: input.name.trim(),
    baseURL: url.href.replace(/\/$/, ""),
    models: [...new Set(input.models.map((m) => m.trim()))],
  };
}
