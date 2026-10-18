import assert from "node:assert/strict";
import { test } from "node:test";

import { LlmError, OpenCodeClient, type ChatMessage } from "./client.js";
import type { OpenCodeConfig } from "./config.js";

const config: OpenCodeConfig = {
  apiKey: "sk-secret",
  model: "deepseek-v4.1-flash",
  baseUrl: "https://opencode.ai/inference",
  chatCompletionsUrl: "https://opencode.ai/inference/openai/v1/chat/completions",
};

const messages: ChatMessage[] = [{ role: "user", content: "oi" }];

test("sends the key, model and messages and returns the assistant tool call", async () => {
  let seen: { url: string; init?: RequestInit } | undefined;
  const client = new OpenCodeClient({
    config,
    fetchImpl: async (url, init) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  { id: "call_1", type: "function", function: { name: "listAddresses", arguments: "{}" } },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  const reply = await client.complete(messages, [
    { type: "function", function: { name: "listAddresses", description: "d", parameters: {} } },
  ]);

  assert.equal(seen?.url, config.chatCompletionsUrl);
  const headers = seen?.init?.headers as unknown as Record<string, string>;
  assert.equal(headers.authorization, "Bearer sk-secret");
  const payload = JSON.parse(String(seen?.init?.body));
  assert.equal(payload.model, "deepseek-v4.1-flash");
  assert.equal(payload.messages[0].content, "oi");
  assert.equal(payload.tools[0].function.name, "listAddresses");
  assert.equal(reply.tool_calls?.[0].function.name, "listAddresses");
});

test("sends a stable x-opencode-session header (required by the Go endpoint)", async () => {
  const sessions: string[] = [];
  const client = new OpenCodeClient({
    config,
    fetchImpl: async (_url, init) => {
      const headers = init?.headers as unknown as Record<string, string>;
      sessions.push(headers["x-opencode-session"]);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
      });
    },
  });

  await client.complete(messages);
  await client.complete(messages);

  assert.equal(sessions.length, 2);
  assert.ok(sessions[0] && sessions[0].length > 0);
  assert.equal(sessions[0], sessions[1]);
});

test("omits tools when there are none", async () => {
  let body: Record<string, unknown> = {};
  const client = new OpenCodeClient({
    config,
    fetchImpl: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
      });
    },
  });

  const reply = await client.complete(messages);
  assert.equal("tools" in body, false);
  assert.equal(reply.content, "ok");
});

test("maps transport failure, HTTP error and malformed body to LlmError", async () => {
  const unavailable = new OpenCodeClient({
    config,
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  await assert.rejects(
    unavailable.complete(messages),
    (error: unknown) => error instanceof LlmError && error.code === "UNAVAILABLE",
  );

  const httpError = new OpenCodeClient({
    config,
    fetchImpl: async () => new Response("nope", { status: 502 }),
  });
  await assert.rejects(
    httpError.complete(messages),
    (error: unknown) => error instanceof LlmError && error.code === "HTTP_ERROR",
  );

  const malformed = new OpenCodeClient({
    config,
    fetchImpl: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
  });
  await assert.rejects(
    malformed.complete(messages),
    (error: unknown) => error instanceof LlmError && error.code === "MALFORMED_RESPONSE",
  );
});

test("never leaks the key in the error message", async () => {
  const client = new OpenCodeClient({
    config,
    fetchImpl: async () => new Response("supersecret-backend-detail", { status: 500 }),
  });
  await assert.rejects(client.complete(messages), (error: unknown) => {
    assert.doesNotMatch((error as Error).message, /supersecret|sk-secret/);
    return true;
  });
});
