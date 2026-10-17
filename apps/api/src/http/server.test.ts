import assert from "node:assert/strict";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";

import {
  McpOAuthFlow,
  type McpOAuthProvider,
  type OAuthAuthorizationInput,
  type OAuthExchangeInput,
  type OAuthTokenResponse,
} from "../mcp/oauth-flow.js";
import { McpSessionRegistry } from "../mcp/session-registry.js";
import { ParticipantAccessStore } from "../party/access.js";
import { PartyService } from "../party/service.js";
import { PartyStore } from "../party/store.js";
import { handlePartyRequest, resolveMcpOAuthMode } from "../server.js";

const allowedOrigin = "https://party.example.com";
const frontendUrl = "https://party.example.com/party";

class TestOAuthProvider implements McpOAuthProvider {
  readonly mode = "demo" as const;

  createAuthorizationUrl(input: OAuthAuthorizationInput): string {
    return `https://auth.example/authorize?state=${encodeURIComponent(input.state)}&code_challenge=${encodeURIComponent(input.codeChallenge)}`;
  }

  async exchangeCode() {
    return {
      accessToken: "private-access-token",
      refreshToken: "private-refresh-token",
      expiresInSeconds: 3600,
    };
  }
}

class RejectingOAuthProvider extends TestOAuthProvider {
  override async exchangeCode(): Promise<never> {
    throw new Error("provider response included private-code-value");
  }
}

class CodeEchoOAuthProvider implements McpOAuthProvider {
  readonly mode = "demo" as const;

  createAuthorizationUrl(input: OAuthAuthorizationInput): string {
    return `https://auth.example/authorize?state=${encodeURIComponent(input.state)}`;
  }

  async exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenResponse> {
    return {
      accessToken: `access-${input.code}`,
      refreshToken: `refresh-${input.code}`,
      expiresInSeconds: 3600,
    };
  }
}

interface TestApi {
  service: PartyService;
  sessions: McpSessionRegistry;
  oauth: McpOAuthFlow;
}

class MemoryResponse extends Writable {
  statusCode = 200;
  readonly responseHeaders = new Map<string, string>();
  private readonly chunks: Buffer[] = [];

  writeHead(statusCode: number, headers: Record<string, string>): this {
    this.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers)) {
      this.responseHeaders.set(name.toLowerCase(), value);
    }
    return this;
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  json(): any {
    return JSON.parse(Buffer.concat(this.chunks).toString("utf8"));
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

async function request(
  api: TestApi,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<MemoryResponse> {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const source = Readable.from(payload ? [Buffer.from(payload)] : []);
  const incoming = Object.assign(source, {
    method,
    url: path,
    headers: {
      origin: allowedOrigin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }) as unknown as IncomingMessage;
  const response = new MemoryResponse();
  const finished = once(response, "finish");

  await handlePartyRequest(
    incoming,
    response as unknown as ServerResponse,
    api.service,
    { allowedOrigin, frontendUrl, oauth: api.oauth } as any,
  );
  await finished;
  return response;
}

function createApi(provider: McpOAuthProvider = new TestOAuthProvider()): TestApi {
  const sessions = new McpSessionRegistry();
  return {
    service: new PartyService(new PartyStore(), new ParticipantAccessStore()),
    sessions,
    oauth: new McpOAuthFlow(provider, sessions),
  };
}

test("exposes the onboarding flow and a token-free polling snapshot", async () => {
  const api = createApi();
  const createResponse = await request(api, "POST", "/parties", {
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.responseHeaders.get("access-control-allow-origin"), allowedOrigin);
  const host = createResponse.json();

  const joinResponse = await request(api, "POST", `/parties/${host.party.party.code}/join`, {
    participant: { id: "bruno", name: "Bruno" },
  });
  assert.equal(joinResponse.statusCode, 200);
  const guest = joinResponse.json();

  const closeResponse = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/close`,
    {},
    host.participantToken,
  );
  assert.equal(closeResponse.statusCode, 200);

  await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/answers`,
    { questionnaireVersion: "v1", answers: { preference: "massa" }, completed: true },
    host.participantToken,
  );
  const finalAnswer = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/answers`,
    { questionnaireVersion: "v1", answers: { preference: "pizza" }, completed: true },
    guest.participantToken,
  );
  assert.equal(finalAnswer.statusCode, 200);
  assert.equal(finalAnswer.json().party.status, "READY_FOR_THEME");

  const pollingResponse = await request(
    api,
    "GET",
    `/parties/${host.party.party.id}`,
  );
  assert.equal(pollingResponse.statusCode, 200);
  assert.equal(pollingResponse.text().includes(host.participantToken), false);
  assert.equal(pollingResponse.text().includes(guest.participantToken), false);
});

test("requires a Party-scoped Bearer token and keeps CORS on errors", async () => {
  const api = createApi();
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  await request(api, "POST", `/parties/${host.party.party.id}/join`, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const foreign = (
    await request(api, "POST", "/parties", {
      name: "Outra Party",
      host: { id: "intruso", name: "Intruso" },
    })
  ).json();

  const missingToken = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/close`,
    {},
  );
  assert.equal(missingToken.statusCode, 401);
  assert.equal(missingToken.json().error.code, "ACCESS_TOKEN_REQUIRED");
  assert.equal(missingToken.responseHeaders.get("access-control-allow-origin"), allowedOrigin);

  const foreignToken = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/close`,
    {},
    foreign.participantToken,
  );
  assert.equal(foreignToken.statusCode, 403);
  assert.equal(foreignToken.json().error.code, "ACCESS_DENIED");
  assert.equal(foreignToken.responseHeaders.get("access-control-allow-origin"), allowedOrigin);
});

test("completes OAuth without exposing tokens and rejects a foreign Party token", async () => {
  const api = createApi();
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  const foreign = (
    await request(api, "POST", "/parties", {
      name: "Outra Party",
      host: { id: "intruso", name: "Intruso" },
    })
  ).json();

  const authorization = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection/authorize`,
    {},
    host.participantToken,
  );
  assert.equal(authorization.statusCode, 200);
  assert.equal(authorization.json().status, "validating");
  assert.equal(authorization.json().mode, "demo");
  assert.match(authorization.json().authorizationUrl, /^https:\/\/auth\.example/);
  assert.equal(authorization.text().includes(host.participantToken), false);

  const validating = await request(api, "GET", `/parties/${host.party.party.id}`);
  assert.equal(
    validating.json().participants.find((participant: any) => participant.id === "ana")
      .mcpConnectionStatus,
    "validating",
  );

  const rejected = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection/authorize`,
    {},
    foreign.participantToken,
  );
  assert.equal(rejected.statusCode, 403);

  const authorizationUrl = new URL(authorization.json().authorizationUrl);
  const state = authorizationUrl.searchParams.get("state");
  assert.ok(state);
  const callback = await request(
    api,
    "GET",
    `/parties/${host.party.party.id}/mcp-connection/callback?code=approved&state=${encodeURIComponent(state)}`,
  );
  assert.equal(callback.statusCode, 302);
  assert.equal(
    callback.responseHeaders.get("location"),
    `${frontendUrl}?partyId=${host.party.party.id}&mcp=connected`,
  );

  const session = api.sessions.get(host.party.party.id, "ana");
  assert.equal(session?.accessToken, "private-access-token");
  assert.equal(session?.refreshToken, "private-refresh-token");

  const connected = await request(api, "GET", `/parties/${host.party.party.id}`);
  assert.equal(connected.text().includes("private-access-token"), false);
  assert.equal(connected.text().includes("private-refresh-token"), false);
  assert.equal(
    connected.json().participants.find((participant: any) => participant.id === "ana")
      .mcpConnectionStatus,
    "connected",
  );

  const replay = await request(
    api,
    "GET",
    `/parties/${host.party.party.id}/mcp-connection/callback?code=replayed&state=${encodeURIComponent(state)}`,
  );
  assert.equal(replay.statusCode, 400);
  assert.equal(replay.json().error.code, "OAUTH_STATE_INVALID");
});

test("only allows the demo OAuth mode until iFood homologates the agent", () => {
  assert.equal(resolveMcpOAuthMode(undefined), "demo");
  assert.equal(resolveMcpOAuthMode("demo"), "demo");
  assert.equal(resolveMcpOAuthMode(" DEMO "), "demo");
  assert.throws(() => resolveMcpOAuthMode("ifood"), /não está implementado/);
  assert.throws(() => resolveMcpOAuthMode("bogus"), /inválido/);
});

test("marks the participant as error when token exchange fails", async () => {
  const api = createApi(new RejectingOAuthProvider());
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  const authorization = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection/authorize`,
    {},
    host.participantToken,
  );
  const state = new URL(authorization.json().authorizationUrl).searchParams.get("state");
  assert.ok(state);

  const callback = await request(
    api,
    "GET",
    `/parties/${host.party.party.id}/mcp-connection/callback?code=rejected&state=${encodeURIComponent(state)}`,
  );

  assert.equal(callback.statusCode, 400);
  assert.equal(callback.json().error.code, "OAUTH_EXCHANGE_FAILED");
  assert.equal(callback.text().includes("private-code-value"), false);
  const snapshot = await request(api, "GET", `/parties/${host.party.party.id}`);
  assert.equal(snapshot.json().participants[0].mcpConnectionStatus, "error");
  assert.equal(api.sessions.get(host.party.party.id, "ana"), undefined);
});

test("rejects an expired OAuth state at the callback", async () => {
  let now = Date.parse("2026-10-17T12:00:00.000Z");
  const sessions = new McpSessionRegistry();
  const api: TestApi = {
    service: new PartyService(new PartyStore(), new ParticipantAccessStore()),
    sessions,
    oauth: new McpOAuthFlow(new TestOAuthProvider(), sessions, () => now, 1_000),
  };
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  const authorization = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection/authorize`,
    {},
    host.participantToken,
  );
  const state = new URL(authorization.json().authorizationUrl).searchParams.get("state");
  assert.ok(state);

  now += 1_001;
  const callback = await request(
    api,
    "GET",
    `/parties/${host.party.party.id}/mcp-connection/callback?code=late&state=${encodeURIComponent(state)}`,
  );
  assert.equal(callback.statusCode, 400);
  assert.equal(callback.json().error.code, "OAUTH_STATE_INVALID");
  assert.equal(sessions.get(host.party.party.id, "ana"), undefined);
});

test("rejects an OAuth state issued for another Party", async () => {
  const api = createApi();
  const hostA = (
    await request(api, "POST", "/parties", {
      name: "Party A",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  const hostB = (
    await request(api, "POST", "/parties", {
      name: "Party B",
      host: { id: "bia", name: "Bia" },
    })
  ).json();
  const authorization = await request(
    api,
    "POST",
    `/parties/${hostA.party.party.id}/mcp-connection/authorize`,
    {},
    hostA.participantToken,
  );
  const state = new URL(authorization.json().authorizationUrl).searchParams.get("state");
  assert.ok(state);

  const callback = await request(
    api,
    "GET",
    `/parties/${hostB.party.party.id}/mcp-connection/callback?code=approved&state=${encodeURIComponent(state)}`,
  );
  assert.equal(callback.statusCode, 400);
  assert.equal(callback.json().error.code, "OAUTH_STATE_INVALID");
  assert.equal(api.sessions.get(hostB.party.party.id, "bia"), undefined);
});

test("authorizes two participants of the same Party without mixing tokens", async () => {
  const api = createApi(new CodeEchoOAuthProvider());
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  const guest = (
    await request(api, "POST", `/parties/${host.party.party.id}/join`, {
      participant: { id: "bruno", name: "Bruno" },
    })
  ).json();
  const partyId = host.party.party.id;

  const anaAuthorization = await request(
    api,
    "POST",
    `/parties/${partyId}/mcp-connection/authorize`,
    {},
    host.participantToken,
  );
  const brunoAuthorization = await request(
    api,
    "POST",
    `/parties/${partyId}/mcp-connection/authorize`,
    {},
    guest.participantToken,
  );
  const anaState = new URL(anaAuthorization.json().authorizationUrl).searchParams.get("state");
  const brunoState = new URL(brunoAuthorization.json().authorizationUrl).searchParams.get("state");
  assert.ok(anaState);
  assert.ok(brunoState);
  assert.notEqual(anaState, brunoState);

  const anaCallback = await request(
    api,
    "GET",
    `/parties/${partyId}/mcp-connection/callback?code=ana-code&state=${encodeURIComponent(anaState)}`,
  );
  const brunoCallback = await request(
    api,
    "GET",
    `/parties/${partyId}/mcp-connection/callback?code=bruno-code&state=${encodeURIComponent(brunoState)}`,
  );
  assert.equal(anaCallback.statusCode, 302);
  assert.equal(brunoCallback.statusCode, 302);

  assert.equal(api.sessions.get(partyId, "ana")?.accessToken, "access-ana-code");
  assert.equal(api.sessions.get(partyId, "bruno")?.accessToken, "access-bruno-code");

  const snapshot = await request(api, "GET", `/parties/${partyId}`);
  assert.equal(
    snapshot.json().participants.find((participant: any) => participant.id === "ana")
      .mcpConnectionStatus,
    "connected",
  );
  assert.equal(
    snapshot.json().participants.find((participant: any) => participant.id === "bruno")
      .mcpConnectionStatus,
    "connected",
  );
  assert.equal(snapshot.text().includes("access-ana-code"), false);
  assert.equal(snapshot.text().includes("access-bruno-code"), false);
});
