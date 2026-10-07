import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getSetting, setSetting, id } from "./db";
import { seal, unseal } from "./vault";
import { fingerprint } from "./execution";
import { validateProvider } from "@/lib/providers";
import type { ToolDef } from "./agent/tools";
type Connection = {
  id: string;
  name: string;
  url: string;
  kind: "mcp" | "http";
  dotId: string;
  secret: string | null;
  tools: {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }[];
};
const read = (): Connection[] =>
  JSON.parse(getSetting("tool_connections") ?? "[]");
export const listConnections = () =>
  read().map(({ secret, ...c }) => ({ ...c, hasKey: Boolean(secret) }));
async function connect(c: Connection) {
  const client = new Client({ name: "codex-open-dot", version: "0.2.0" });
  const transport = new StreamableHTTPClientTransport(new URL(c.url), {
    requestInit: {
      headers: c.secret ? { Authorization: `Bearer ${unseal(c.secret)}` } : {},
      redirect: "error",
    },
    fetch: (url, init) =>
      fetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.any([
          ...(init?.signal ? [init.signal] : []),
          AbortSignal.timeout(30000),
        ]),
      }),
  });
  try {
    await client.connect(transport);
    return client;
  } catch {
    await client.close().catch(() => {});
    throw new Error("Could not connect to the MCP server");
  }
}
export async function addConnection(input: {
  name: string;
  url: string;
  kind: "mcp" | "http";
  dotId: string;
  apiKey?: string;
}) {
  validateProvider({
    name: input.name,
    baseURL: input.url,
    format: "chat",
    auth: "none",
    models: ["validation"],
    tools: true,
    images: false,
  });
  if (!["mcp", "http"].includes(input.kind) || !input.dotId)
    throw new Error("Choose a connection type and dot");
  const c: Connection = {
    id: id("conn"),
    name: input.name.trim(),
    url: input.url,
    kind: input.kind,
    dotId: input.dotId,
    secret: input.apiKey ? seal(input.apiKey) : null,
    tools: [],
  };
  if (c.kind === "mcp") {
    const client = await connect(c);
    try {
      c.tools = (await client.listTools()).tools.slice(0, 50).map((t) => ({
        name: t.name,
        description: t.description?.slice(0, 1000),
        inputSchema: t.inputSchema,
      }));
    } finally {
      await client.close();
    }
  } else
    c.tools = [
      {
        name: "request",
        description: `Send JSON to ${c.name}`,
        inputSchema: {
          type: "object",
          properties: { body: { type: "object", additionalProperties: true } },
          required: ["body"],
        },
      },
    ];
  setSetting("tool_connections", JSON.stringify([...read(), c]));
  return listConnections();
}
export function removeConnection(connectionId: string) {
  setSetting(
    "tool_connections",
    JSON.stringify(read().filter((c) => c.id !== connectionId)),
  );
}
export function customTools(dotId?: string): ToolDef[] {
  return read()
    .filter((c) => !dotId || c.dotId === dotId)
    .flatMap((c) =>
      c.tools.map((t) => ({
        name: `ext_${fingerprint(c.id + ":" + t.name).slice(0, 24)}`,
        label: `Using ${c.name}`,
        description: t.description ?? t.name,
        parameters: t.inputSchema,
        strict: false,
        describe: () => `call ${c.name}: ${t.name}`,
        defaultDecision: () => "ask" as const,
        detail: (a: Record<string, unknown>) =>
          `${c.url}\n${JSON.stringify(a, null, 2)}`,
        precheck: async (_a, ctx) =>
          ctx.dot.id === c.dotId
            ? null
            : "This connection belongs to another dot",
        execute: async (a, ctx) => {
          if (ctx.dot.id !== c.dotId)
            throw new Error("Connection scope mismatch");
          ctx.signal.throwIfAborted();
          if (c.kind === "mcp") {
            const client = await connect(c);
            try {
              const r = await client.callTool(
                { name: t.name, arguments: a },
                undefined,
                { signal: ctx.signal, timeout: 30000 },
              );
              return JSON.stringify(r).slice(0, 60000);
            } finally {
              await client.close();
            }
          }
          const response = await fetch(c.url, {
            method: "POST",
            redirect: "error",
            headers: {
              "Content-Type": "application/json",
              ...(c.secret
                ? { Authorization: `Bearer ${unseal(c.secret)}` }
                : {}),
            },
            body: JSON.stringify(a.body ?? {}),
            signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(30000)]),
          });
          if (!response.ok)
            throw new Error(`HTTP tool returned ${response.status}`);
          const reader = response.body?.getReader();
          if (!reader) return "";
          let size = 0;
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 60000) {
              await reader.cancel();
              throw new Error("Tool response exceeds 60 KB");
            }
            chunks.push(value);
          }
          return Buffer.concat(chunks).toString("utf8");
        },
      })),
    );
}
