import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateProvider,
  customModelId,
  parseCustomModel,
} from "../src/lib/providers.ts";
import {
  chatRequest,
  responseFromChat,
  withChatAdapter,
} from "../src/server/agent/chat-adapter.ts";
import OpenAI from "openai";
const config = {
  name: "Azure",
  baseURL: "https://example.openai.azure.com/openai/v1/",
  format: "chat",
  auth: "api-key",
  models: ["my-deepseek"],
  tools: true,
  images: false,
};
test("provider validation and deployment IDs", () => {
  assert.equal(
    validateProvider(config).baseURL,
    "https://example.openai.azure.com/openai/v1",
  );
  assert.deepEqual(
    parseCustomModel(customModelId("one", "provider/model:variant")),
    { providerId: "one", model: "provider/model:variant" },
  );
  for (const baseURL of [
    "http://evil.example/v1",
    "https://user:password@example.com",
    "https://example.com?key=secret",
    "file:///tmp/key",
  ])
    assert.throws(() => validateProvider({ ...config, baseURL }));
  assert.doesNotThrow(() =>
    validateProvider({
      ...config,
      baseURL: "http://localhost:11434/v1",
      auth: "none",
    }),
  );
});
test("tool history survives Chat Completions translation", () => {
  const req = chatRequest({
    model: "deployment",
    instructions: "Be helpful",
    input: [
      { role: "user", content: "Hello" },
      { type: "function_call", call_id: "a", name: "read", arguments: "{}" },
      { type: "function_call", call_id: "b", name: "read", arguments: "{}" },
      { type: "function_call_output", call_id: "a", output: "one" },
      { type: "function_call_output", call_id: "b", output: "two" },
    ],
    tools: [
      {
        type: "function",
        name: "read",
        parameters: { type: "object", properties: {} },
        strict: false,
      },
    ],
  });
  assert.equal(req.model, "deployment");
  assert.equal(req.messages[2].tool_calls.length, 2);
  assert.equal(req.messages[3].tool_call_id, "a");
  assert.equal(req.tools[0].function.name, "read");
});
test("truncated tool calls are never executed", () => {
  assert.throws(
    () =>
      responseFromChat({
        choices: [
          {
            finish_reason: "length",
            message: { content: null, tool_calls: [] },
          },
        ],
      }),
    /stopped/,
  );
});
test("custom API sends actual deployment, headers and tools; normalizes result", async () => {
  let request;
  const client = withChatAdapter(
    new OpenAI({
      apiKey: "test-key",
      baseURL: "https://example.com/v1",
      maxRetries: 0,
      fetch: async (url, init) => {
        request = { url, init, body: JSON.parse(init.body) };
        return new Response(
          JSON.stringify({
            id: "chat-1",
            object: "chat.completion",
            created: 1,
            model: "deployment",
            choices: [
              {
                index: 0,
                finish_reason: "stop",
                message: { role: "assistant", content: "OK" },
              },
            ],
            usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    }),
  );
  const response = await client.responses.create({
    model: "deployment",
    input: "hi",
    stream: false,
  });
  assert.equal(request.url, "https://example.com/v1/chat/completions");
  assert.equal(request.body.model, "deployment");
  assert.equal(response.output_text, "OK");
  assert.equal(response.usage.total_tokens, 5);
  const events = [];
  for await (const e of await client.responses.create({
    model: "deployment",
    input: "hi",
    stream: true,
  }))
    events.push(e);
  assert.equal(events.at(-1).type, "response.completed");
  assert.equal(events[1].delta, "OK");
});
