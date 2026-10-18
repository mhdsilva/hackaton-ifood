/**
 * Cliente MCP (Streamable HTTP, JSON-RPC 2.0) de um único participante.
 *
 * Cada instância carrega o próprio token e a própria sessão MCP; não há estado global, então
 * vários participantes podem coexistir no mesmo processo (ADR 0001). O cliente não grava no
 * registro de sessões: quando renova o token, avisa quem o criou por `onSessionRefreshed`.
 */

import type { McpTokenSession } from "../mcp/session-registry.js";
import { DEFAULT_IFOOD_MCP_URL } from "./config.js";
import type { OAuthTokenResponse } from "./provider.js";
import { needsRefresh } from "./token-refresh.js";

type Fetch = typeof globalThis.fetch;

const PROTOCOL_VERSION = "2025-06-18";

export type IfoodMcpErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "TOOL_ERROR"
  | "PROTOCOL_ERROR"
  | "UNAVAILABLE";

export class IfoodMcpError extends Error {
  constructor(
    readonly code: IfoodMcpErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "IfoodMcpError";
  }
}

export interface IfoodMcpClientOptions {
  session: McpTokenSession;
  mcpUrl?: string;
  refreshTokens?: (refreshToken: string) => Promise<OAuthTokenResponse>;
  onSessionRefreshed?: (session: McpTokenSession) => void;
  fetchImpl?: Fetch;
  now?: () => number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export class IfoodMcpClient {
  private session: McpTokenSession;
  private readonly mcpUrl: string;
  private readonly fetchImpl: Fetch;
  private readonly now: () => number;
  private mcpSessionId?: string;
  private initialized?: Promise<void>;
  private nextId = 1;

  constructor(private readonly options: IfoodMcpClientOptions) {
    this.session = structuredClone(options.session);
    this.mcpUrl = options.mcpUrl ?? DEFAULT_IFOOD_MCP_URL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
  }

  /** Chama uma tool e devolve o conteúdo estruturado (ou o JSON do primeiro bloco de texto). */
  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.ensureInitialized();
    const result = (await this.request("tools/call", { name, arguments: args })) as ToolResult;
    const payload = result.structuredContent ?? parseTextContent(result.content);

    if (result.isError || hasMcpErrors(payload)) {
      const errors = (payload as { errors?: { code?: string; message?: string } })?.errors;
      if (errors?.code === "AUTHENTICATION_REQUIRED") {
        throw new IfoodMcpError("AUTHENTICATION_REQUIRED", "A sessão do iFood expirou", errors);
      }
      throw new IfoodMcpError(
        "TOOL_ERROR",
        `A tool ${name} falhou${errors?.code ? ` (${errors.code})` : ""}`,
        errors ?? payload,
      );
    }
    return payload as T;
  }

  private ensureInitialized(): Promise<void> {
    this.initialized ??= this.initialize().catch((error) => {
      this.initialized = undefined;
      throw error;
    });
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "sidequest-party", version: "0.1.0" },
    });
    await this.post({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const response = await this.post({ jsonrpc: "2.0", id, method, params });
    const message = await readJsonRpc(response, id);
    if (message.error) {
      throw new IfoodMcpError("PROTOCOL_ERROR", `MCP ${method} falhou: ${message.error.message}`);
    }
    return message.result;
  }

  private async post(body: unknown): Promise<Response> {
    await this.refreshIfNeeded();
    let response: Response;
    try {
      response = await this.fetchImpl(this.mcpUrl, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${this.session.accessToken}`,
          "Content-Type": "application/json",
          "MCP-Protocol-Version": PROTOCOL_VERSION,
          ...(this.mcpSessionId ? { "Mcp-Session-Id": this.mcpSessionId } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new IfoodMcpError("UNAVAILABLE", "Não foi possível alcançar o MCP do iFood");
    }

    if (response.status === 401) {
      throw new IfoodMcpError("AUTHENTICATION_REQUIRED", "A sessão do iFood expirou");
    }
    if (!response.ok && response.status !== 202) {
      throw new IfoodMcpError(
        response.status >= 500 ? "UNAVAILABLE" : "PROTOCOL_ERROR",
        `O MCP do iFood respondeu HTTP ${response.status}`,
      );
    }
    this.mcpSessionId = response.headers.get("mcp-session-id") ?? this.mcpSessionId;
    return response;
  }

  private async refreshIfNeeded(): Promise<void> {
    if (!this.options.refreshTokens || !needsRefresh(this.session, this.now())) return;
    const tokens = await this.options.refreshTokens(this.session.refreshToken);
    const issuedAt = this.now();
    this.session = {
      ...this.session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: new Date(issuedAt + tokens.expiresInSeconds * 1000).toISOString(),
      ...(tokens.refreshTokenExpiresInSeconds
        ? {
            refreshTokenExpiresAt: new Date(
              issuedAt + tokens.refreshTokenExpiresInSeconds * 1000,
            ).toISOString(),
          }
        : {}),
    };
    this.options.onSessionRefreshed?.(structuredClone(this.session));
  }
}

async function readJsonRpc(response: Response, id: number): Promise<JsonRpcResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const messages: JsonRpcResponse[] = contentType.includes("text/event-stream")
    ? text
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => safeJson(line.slice(5).trim()))
        .filter((message): message is JsonRpcResponse => message !== undefined)
    : [safeJson(text)].filter((message): message is JsonRpcResponse => message !== undefined);

  const match = messages.find((message) => message.id === id);
  if (!match) {
    throw new IfoodMcpError("PROTOCOL_ERROR", "O MCP do iFood não respondeu ao pedido");
  }
  return match;
}

function safeJson(text: string): JsonRpcResponse | undefined {
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    return undefined;
  }
}

function parseTextContent(content: ToolResult["content"]): unknown {
  const text = content?.find((block) => block.type === "text")?.text;
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function hasMcpErrors(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && "errors" in payload;
}
