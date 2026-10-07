import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-mcp-"));
process.env.DOTS_DATA_DIR = dir;
const c = await import("../src/server/connections.ts");
let auth = [];
const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  auth.push(req.headers.authorization);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const mcp = new Server(
    { name: "test", version: "1.0" },
    { capabilities: { tools: {} } },
  );
  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "echo",
        description: "Echo",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    ],
  }));
  mcp.setRequestHandler(CallToolRequestSchema, async (r) => ({
    content: [{ type: "text", text: r.params.arguments.text }],
  }));
  await mcp.connect(transport);
  await transport.handleRequest(req, res);
  res.on("close", () => {
    void transport.close();
    void mcp.close();
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});
test("MCP discovers and executes tools with encrypted auth and dot scope", async () => {
  await c.addConnection({
    name: "Test MCP",
    url: `http://127.0.0.1:${server.address().port}/mcp`,
    kind: "mcp",
    dotId: "a",
    apiKey: "mock-test-key",
  });
  assert.ok(!JSON.stringify(c.listConnections()).includes("mock-test-key"));
  assert.equal(c.customTools("b").length, 0);
  const tool = c.customTools("a")[0];
  assert.equal(tool.defaultDecision(), "ask");
  const ctx = {
    dot: { id: "a" },
    signal: new AbortController().signal,
    depth: 0,
  };
  assert.match(await tool.execute({ text: "MCP success" }, ctx), /MCP success/);
  assert.ok(auth.every((a) => a === "Bearer mock-test-key"));
  await assert.rejects(
    () => tool.execute({ text: "no" }, { ...ctx, dot: { id: "b" } }),
    /scope/,
  );
});
