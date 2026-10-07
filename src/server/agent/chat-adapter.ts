import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import type {
  ResponseCreateParams,
  ResponseInputItem,
  Response,
} from "openai/resources/responses/responses";

/** Translate the runtime's Responses history into the portable Chat Completions protocol. */
export function chatRequest(
  body: ResponseCreateParams,
): ChatCompletionCreateParamsNonStreaming {
  const messages: ChatCompletionMessageParam[] = [];
  if (body.instructions)
    messages.push({ role: "system", content: body.instructions });
  const input =
    typeof body.input === "string"
      ? [{ role: "user", content: body.input }]
      : (body.input ?? []);
  for (const raw of input) {
    const item = raw as ResponseInputItem;
    if (item.type === "function_call") {
      const tool = {
        id: item.call_id,
        type: "function" as const,
        function: { name: item.name, arguments: item.arguments },
      };
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.tool_calls)
        last.tool_calls.push(tool);
      else
        messages.push({ role: "assistant", content: null, tool_calls: [tool] });
    } else if (item.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id!,
        content:
          typeof item.output === "string"
            ? item.output
            : JSON.stringify(item.output),
      });
    } else if ("role" in item && "content" in item) {
      const role = item.role === "developer" ? "system" : item.role;
      if (typeof item.content === "string")
        messages.push({
          role,
          content: item.content,
        } as ChatCompletionMessageParam);
      else {
        const content = item.content.map((p) => {
          if (p.type === "input_text" || p.type === "output_text")
            return { type: "text" as const, text: p.text };
          if (p.type === "input_image" && p.image_url)
            return {
              type: "image_url" as const,
              image_url: { url: p.image_url },
            };
          throw new Error(
            "This custom Chat Completions provider cannot accept this attachment. Import documents into the knowledge library instead.",
          );
        });
        messages.push({ role, content } as ChatCompletionMessageParam);
      }
    }
  }
  const tools = body.tools
    ?.filter((t) => t.type === "function")
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description ?? undefined,
        parameters: t.parameters ?? { type: "object", properties: {} },
      },
    }));
  return {
    model: body.model!,
    messages,
    ...(tools?.length ? { tools, parallel_tool_calls: false } : {}),
    ...(body.max_output_tokens ? { max_tokens: body.max_output_tokens } : {}),
    ...(body.text?.format?.type === "json_schema"
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: body.text.format.name,
              schema: body.text.format.schema,
              strict: body.text.format.strict ?? false,
            },
          } as const,
        }
      : {}),
    stream: false,
  };
}
export function responseFromChat(chat: ChatCompletion): Response {
  const choice = chat.choices[0];
  if (!choice) throw new Error("The provider returned no completion");
  if (
    choice.finish_reason === "length" ||
    choice.finish_reason === "content_filter"
  )
    throw new Error(`Provider stopped the response: ${choice.finish_reason}`);
  const message = choice.message;
  const output: Response["output"] = [];
  if (message.content)
    output.push({
      type: "message",
      id: `${chat.id}_message`,
      role: "assistant",
      status: "completed",
      content: [
        {
          type: "output_text",
          text: message.content,
          annotations: [],
          logprobs: [],
        },
      ],
    });
  for (const call of message.tool_calls ?? []) {
    if (call.type !== "function")
      throw new Error("Unsupported tool call from provider");
    output.push({
      type: "function_call",
      call_id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    });
  }
  return {
    id: chat.id,
    object: "response",
    created_at: chat.created,
    status: "completed",
    model: chat.model,
    output,
    output_text: message.content ?? "",
    usage: chat.usage
      ? {
          input_tokens: chat.usage.prompt_tokens,
          output_tokens: chat.usage.completion_tokens,
          total_tokens: chat.usage.total_tokens,
          input_tokens_details: {
            cached_tokens: chat.usage.prompt_tokens_details?.cached_tokens ?? 0,
          },
          output_tokens_details: {
            reasoning_tokens:
              chat.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          },
        }
      : null,
  } as Response;
}
/** Buffered compatibility mode also works with servers that do not implement SSE. */
export function withChatAdapter(client: OpenAI): OpenAI {
  client.responses.create = (async (
    body: ResponseCreateParams,
    options?: { signal?: AbortSignal | null },
  ) => {
    const result = responseFromChat(
      await client.chat.completions.create(chatRequest(body), options),
    );
    if (!body.stream) return result;
    return (async function* () {
      for (const item of result.output) {
        yield { type: "response.output_item.added", item };
        if (item.type === "message") {
          for (const part of item.content)
            if (part.type === "output_text")
              yield {
                type: "response.output_text.delta",
                item_id: item.id,
                delta: part.text,
              };
        }
        yield { type: "response.output_item.done", item };
      }
      yield { type: "response.completed", response: result };
    })();
  }) as unknown as typeof client.responses.create;
  return client;
}
