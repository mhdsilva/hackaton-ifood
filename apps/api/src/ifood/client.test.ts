import assert from "node:assert/strict";
import { test } from "node:test";

import type { McpTokenSession } from "../mcp/session-registry.js";
import { IfoodMcpClient, IfoodMcpError } from "./client.js";
import { validateConnection } from "./validate-connection.js";

const NOW = Date.parse("2026-10-17T12:00:00Z");

function session(accessToken: string, expiresAt = "2026-10-17T13:00:00Z"): McpTokenSession {
  return {
    accessToken,
    refreshToken: `${accessToken}-refresh`,
    accessTokenExpiresAt: expiresAt,
  };
}

interface Seen {
  authorization: string;
  sessionId?: string;
  body: { method: string; id?: number; params?: { name?: string } };
}

/** Servidor MCP falso: responde `initialize` em SSE e `tools/call` em JSON. */
function fakeMcp(toolPayload: (token: string, tool: string) => unknown, status = 200) {
  const seen: Seen[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body)) as Seen["body"];
    const token = headers.Authorization.replace("Bearer ", "");
    seen.push({ authorization: headers.Authorization, sessionId: headers["Mcp-Session-Id"], body });

    if (status !== 200) return new Response("{}", { status });
    if (body.method === "initialize") {
      const message = JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18" } });
      return new Response(`event: message\ndata: ${message}\n\n`, {
        headers: { "Content-Type": "text/event-stream", "Mcp-Session-Id": `session-${token}` },
      });
    }
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    const payload = toolPayload(token, body.params?.name ?? "");
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    });
  }) as typeof globalThis.fetch;
  return { fetchImpl, seen };
}

test("each client sends only its own token and MCP session", async () => {
  const { fetchImpl, seen } = fakeMcp((token) => ({ success: true, data: { owner: token } }));
  const ana = new IfoodMcpClient({ session: session("token-ana"), fetchImpl, now: () => NOW });
  const bruno = new IfoodMcpClient({ session: session("token-bruno"), fetchImpl, now: () => NOW });

  const results = [
    await ana.callTool<{ data: { owner: string } }>("getUser"),
    await bruno.callTool<{ data: { owner: string } }>("getUser"),
    await ana.callTool<{ data: { owner: string } }>("getUser"),
  ];

  assert.deepEqual(
    results.map((result) => result.data.owner),
    ["token-ana", "token-bruno", "token-ana"],
  );
  for (const request of seen) {
    const token = request.authorization.replace("Bearer ", "");
    if (request.sessionId) assert.equal(request.sessionId, `session-${token}`);
  }
  assert.equal(seen.filter((request) => request.body.method === "initialize").length, 2);
});

test("refreshes a token that is about to expire and reports the new session", async () => {
  const { fetchImpl, seen } = fakeMcp(() => ({ success: true }));
  const refreshed: McpTokenSession[] = [];
  const client = new IfoodMcpClient({
    session: session("old-token", "2026-10-17T12:03:00Z"),
    fetchImpl,
    now: () => NOW,
    refreshTokens: async (refreshToken) => {
      assert.equal(refreshToken, "old-token-refresh");
      return { accessToken: "new-token", refreshToken: "new-refresh", expiresInSeconds: 3600 };
    },
    onSessionRefreshed: (next) => refreshed.push(next),
  });

  await client.callTool("getUser");

  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].accessToken, "new-token");
  assert.equal(refreshed[0].accessTokenExpiresAt, "2026-10-17T13:00:00.000Z");
  assert.ok(seen.every((request) => request.authorization === "Bearer new-token"));
});

test("maps HTTP 401 to AUTHENTICATION_REQUIRED", async () => {
  const { fetchImpl } = fakeMcp(() => ({}), 401);
  const client = new IfoodMcpClient({ session: session("expired"), fetchImpl, now: () => NOW });

  await assert.rejects(
    client.callTool("getUser"),
    (error: unknown) => error instanceof IfoodMcpError && error.code === "AUTHENTICATION_REQUIRED",
  );
});

test("maps an MCP errors envelope to TOOL_ERROR", async () => {
  const { fetchImpl } = fakeMcp(() => ({
    errors: { code: "SERVICE_UNAVAILABLE", message: "down", retryable: true },
  }));
  const client = new IfoodMcpClient({ session: session("token"), fetchImpl, now: () => NOW });

  await assert.rejects(
    client.callTool("listAddresses"),
    (error: unknown) =>
      error instanceof IfoodMcpError &&
      error.code === "TOOL_ERROR" &&
      /SERVICE_UNAVAILABLE/.test(error.message),
  );
});

test("validateConnection exposes only connected or error", async () => {
  const ok = fakeMcp(() => ({ success: true, data: { fullName: "Pessoa", email: "x@y" } }));
  const okClient = new IfoodMcpClient({ session: session("t"), fetchImpl: ok.fetchImpl, now: () => NOW });
  assert.equal(await validateConnection(okClient), "connected");

  const denied = fakeMcp(() => ({}), 401);
  const deniedClient = new IfoodMcpClient({ session: session("t"), fetchImpl: denied.fetchImpl, now: () => NOW });
  assert.equal(await validateConnection(deniedClient), "error");
});
