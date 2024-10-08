import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { Hono } from "hono";
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
  finish_reason: Type.String(),
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

export type ChatResponse = Static<typeof ChatResponse>;

/**
 * A minimal implementation of https://platform.openai.com/docs/api-reference/chat/create interface
 */
export function http(
  runnerHost: RunnerHost,
  port: number,
): Deno.HttpServer<Deno.NetAddr> {
  const app = new Hono();

  app.get('/health', (c) => {
    return c.text('ok');
  });

  app.post("/v1/chat/completions", async (c) => {
    try {
      const body = await c.req.json();
      const req = Value.Parse(ChatRequest, body);

      if (req.stream) {
        throw new HTTPException(400, { message: "Streaming is not supported" });
      }
      if (req.n != 1) {
        throw new HTTPException(400, { message: "Only `n` of 1 is supported" });
      }

      const runner = await runnerHost.getAnonymousRunner();
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
