import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { HTTPException } from "hono/http-exception";
import type { RunnerHost } from "./runnerHost.ts";

const Message = Type.Object({
  content: Type.String(),
  role: Type.Union([
    Type.Literal("user"),
    Type.Literal("system"),
    Type.Literal("assistant"),
    Type.Literal("tool"),
  ]),
});

const CompletionChoice = Type.Object({
  index: Type.Integer(),
  message: Message,
  logprobs: Type.Null(),
  finish_reason: Type.Union([Type.String(), Type.Null()]),
});

const CompletionChunkChoice = Type.Object({
  index: Type.Integer(),
  delta: Message, // OpenAI has more types to this but were not using them
  logprobs: Type.Null(),
  finish_reason: Type.Union([Type.String(), Type.Null()]),
});

const ChatUsage = Type.Object({
  prompt_tokens: Type.Integer(),
  completion_tokens: Type.Integer(),
  total_tokens: Type.Integer(),
  completion_tokens_details: Type.Object({
    reasoning_tokens: Type.Integer(),
  }),
});

const ChatRequest = Type.Object({
  messages: Type.Array(Message),
  n: Type.Integer({ default: 1 }),
  stream: Type.Boolean({ default: false }),
});

const ChatResponse = Type.Object({
  id: Type.String(),
  model: Type.String(),
  choices: Type.Array(CompletionChoice),
  created: Type.Number({ description: "Unix timestamp in seconds" }),
  object: Type.Literal("chat.completion"),
  usage: ChatUsage,
});

const ChatChunkResponse = Type.Object({
  id: Type.String(),
  model: Type.String(),
  choices: Type.Array(CompletionChunkChoice),
  created: Type.Number({ description: "Unix timestamp in seconds" }),
  object: Type.Literal("chat.completion.chunk"),
  // usage: ChatUsage, // TODO enable only if stream_options: {"include_usage": true}
});

export type ChatResponse = Static<typeof ChatResponse>;
export type ChatChunkResponse = Static<typeof ChatChunkResponse>;

/**
 * A minimal implementation of https://platform.openai.com/docs/api-reference/chat/create interface
 */
export function http(
  runnerHost: RunnerHost,
  port: number,
  streamKeepAlive: number = 0,
  onReady?: Promise<unknown>,
): Deno.HttpServer<Deno.NetAddr> {
  const app = new Hono();

  // The ready status should change once the project is fully loaded, including the vector DB
  let ready = false;
  onReady?.then(() => ready = true);

  app.use("*", cors());

  app.get("/health", (c) => {
    return c.text("ok");
  });

  app.get("/ready", (c) => {
    return c.text(ready.toString());
  });

  app.get("/v1/models", (c) => {
    return c.json({
      object: "list",
      data: [
        {
          id: "subql-ai",
          object: "model",
          created: new Date().getTime(),
          owner: "SubQuery",
        },
      ],
    });
  });

  app.post("/v1/chat/completions", async (c) => {
    try {
      const body = await c.req.json();
      const req = Value.Parse(ChatRequest, body);

      if (req.n != 1) {
        throw new HTTPException(400, { message: "Only `n` of 1 is supported" });
      }

      const runner = await runnerHost.getAnonymousRunner();

      // Mock streaming, current Ollama doesn't support streaming with tools. See https://github.com/subquery/subql-ai-app-framework/issues/3
      if (req.stream) {
        return streamSSE(c, async (stream) => {
          // Send empty data to keep the connection alive in browsers, they have a default timeout of 1m
          const interval = streamKeepAlive && setInterval(async () => {
            const empty = createChatChunkResponse("", "", new Date());
            await stream.writeSSE({ data: JSON.stringify(empty) });
            await stream.sleep(20);
          }, streamKeepAlive);

          const chatRes = await runner.promptMessages(req.messages);

          // Stop sending empty data and send the actual response
          interval && clearInterval(interval);

          const parts = chatRes.message.content.split(" ");
          for (const [i, part] of parts.entries()) {
            const last = i == parts.length - 1;

            const res = createChatChunkResponse(
              part,
              chatRes.model,
              chatRes.created_at,
              last ? "stop" : null,
            );
            await stream.writeSSE({ data: JSON.stringify(res) });
            await stream.sleep(20);

            // Bring back white space
            if (!last) {
              const res_space = createChatChunkResponse(
                " ",
                chatRes.model,
                chatRes.created_at,
              );
              await stream.writeSSE({ data: JSON.stringify(res_space) });
              await stream.sleep(20);
            }
          }
        });
      }

      const chatRes = await runner.promptMessages(req.messages);

      const response: ChatResponse = {
        id: "0",
        model: chatRes.model,
        choices: [{
          index: 0,
          message: {
            content: chatRes.message.content,
            role: "assistant",
          },
          logprobs: null,
          finish_reason: chatRes.done_reason,
        }],
        created: new Date(chatRes.created_at).getTime() / 1000,
        object: "chat.completion",
        usage: {
          prompt_tokens: chatRes.prompt_eval_count,
          completion_tokens: chatRes.eval_count,
          total_tokens: 0,
          completion_tokens_details: {
            reasoning_tokens: 0,
          },
        },
      };

      Value.Assert(ChatResponse, response);

      return c.json(response);
    } catch (e) {
      if (e instanceof HTTPException) {
        throw e;
      }
      console.error("Request failed", e);
      throw new HTTPException(500, { message: "Internal error", cause: e });
    }
  });

  return Deno.serve({ port }, app.fetch);
}

function createChatChunkResponse(
  message: string,
  model: string,
  createdAt: Date,
  finish_reason: string | null = null,
): ChatChunkResponse {
  const res: ChatChunkResponse = {
    id: "0",
    object: "chat.completion.chunk",
    model,
    created: new Date(createdAt).getTime() / 1000,
    choices: [{
      index: 0,
      delta: { role: "assistant", content: message },
      logprobs: null,
      finish_reason,
    }],
  };
  Value.Assert(ChatChunkResponse, res);
  return res;
}
