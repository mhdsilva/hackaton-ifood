/**
 * Cliente do provedor de LLM (opencode Console, endpoint OpenAI-compatible).
 *
 * Recebe o `fetch` por injeção para os testes. Não conhece o iFood nem as tools: só troca
 * mensagens, incluindo tool calls. Quem decide o que fazer com isso é `agent/planner.ts`.
 */

import { randomUUID } from "node:crypto";

import type { OpenCodeConfig } from "./config.js";

type Fetch = typeof globalThis.fetch;

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

/** O que o planner precisa do modelo. Um fake implementa isto nos testes. */
export interface ChatClient {
  complete(messages: ChatMessage[], tools: ChatTool[]): Promise<ChatMessage>;
}

export type LlmErrorCode = "HTTP_ERROR" | "MALFORMED_RESPONSE" | "UNAVAILABLE";

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export interface OpenCodeClientOptions {
  config: OpenCodeConfig;
  fetchImpl?: Fetch;
}

interface CompletionResponse {
  choices?: Array<{
    message?: { role?: string; content?: string | null; tool_calls?: ChatToolCall[] };
  }>;
}

export class OpenCodeClient implements ChatClient {
  private readonly config: OpenCodeConfig;
  private readonly fetchImpl: Fetch;
  private readonly sessionId: string;

  constructor(options: OpenCodeClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.sessionId = options.config.sessionId ?? randomUUID();
  }

  async complete(messages: ChatMessage[], tools: ChatTool[] = []): Promise<ChatMessage> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.config.chatCompletionsUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
          "x-opencode-session": this.sessionId,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          ...(tools.length > 0 ? { tools } : {}),
        }),
      });
    } catch {
      throw new LlmError("UNAVAILABLE", "Não foi possível falar com o provedor de LLM");
    }

    if (!response.ok) {
      throw new LlmError("HTTP_ERROR", `O provedor de LLM respondeu ${response.status}`);
    }

    let body: CompletionResponse;
    try {
      body = (await response.json()) as CompletionResponse;
    } catch {
      throw new LlmError("MALFORMED_RESPONSE", "A resposta do provedor de LLM não é JSON");
    }

    const message = body.choices?.[0]?.message;
    const toolCalls = message?.tool_calls;
    const hasContent = typeof message?.content === "string";
    const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
    if (!message || (!hasContent && !hasToolCalls)) {
      throw new LlmError("MALFORMED_RESPONSE", "A resposta do provedor de LLM veio sem mensagem");
    }

    return {
      role: "assistant",
      content: message.content ?? null,
      ...(hasToolCalls ? { tool_calls: toolCalls } : {}),
    };
  }
}
