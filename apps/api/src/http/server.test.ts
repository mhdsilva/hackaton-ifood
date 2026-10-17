import assert from "node:assert/strict";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";

import { McpOAuthFlow } from "../mcp/oauth-flow.js";
import type {
  McpOAuthProvider,
  OAuthAuthorizationInput,
  OAuthExchangeInput,
  OAuthTokenResponse,
} from "../ifood/provider.js";
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
  origin: string = allowedOrigin,
  allowedOrigins: string[] = [allowedOrigin],
): Promise<MemoryResponse> {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const source = Readable.from(payload ? [Buffer.from(payload)] : []);
  const incoming = Object.assign(source, {
    method,
    url: path,
    headers: {
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }) as unknown as IncomingMessage;
  const response = new MemoryResponse();
  const finished = once(response, "finish");

  await handlePartyRequest(
    incoming,
    response as unknown as ServerResponse,
    api.service,
    { allowedOrigins, frontendUrl, oauth: api.oauth } as any,
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

test("serves the current questionnaire definition for the frontend", async () => {
  const api = createApi();
  const response = await request(api, "GET", "/questionnaire");
  assert.equal(response.statusCode, 200);
  const definition = response.json();
  assert.equal(definition.version, "v1");
  assert.equal(typeof definition.title, "string");
  assert.ok(Array.isArray(definition.questions));
  assert.ok(definition.questions.length >= 1);
  for (const question of definition.questions) {
    assert.equal(typeof question.id, "string");
    assert.equal(typeof question.label, "string");
    assert.equal(typeof question.type, "string");
  }

  const explicit = await request(api, "GET", "/questionnaire?version=v1");
  assert.equal(explicit.statusCode, 200);

  const unknown = await request(api, "GET", "/questionnaire?version=v9");
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.json().error.code, "QUESTIONNAIRE_NOT_FOUND");
});

test("validates a participant session and rejects foreign tokens", async () => {
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
      host: { id: "bia", name: "Bia" },
    })
  ).json();
  const partyId = host.party.party.id;

  const ok = await request(
    api,
    "GET",
    `/parties/${partyId}/session`,
    undefined,
    host.participantToken,
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().participant.id, "ana");
  assert.equal(ok.json().participant.mcpConnectionStatus, "not_connected");

  const missing = await request(api, "GET", `/parties/${partyId}/session`);
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, "ACCESS_TOKEN_REQUIRED");

  const denied = await request(
    api,
    "GET",
    `/parties/${partyId}/session`,
    undefined,
    foreign.participantToken,
  );
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error.code, "ACCESS_DENIED");
  assert.equal(denied.text().includes(host.participantToken), false);
});

test("reflects any configured origin and falls back for the rest", async () => {
  const api = createApi();
  const allowed = [allowedOrigin, "https://second.example.com"];

  const reflected = await request(
    api,
    "GET",
    "/health",
    undefined,
    undefined,
    "https://second.example.com",
    allowed,
  );
  assert.equal(
    reflected.responseHeaders.get("access-control-allow-origin"),
    "https://second.example.com",
  );
  assert.equal(reflected.responseHeaders.get("vary"), "Origin");

  const fallback = await request(
    api,
    "GET",
    "/health",
    undefined,
    undefined,
    "https://evil.example.com",
    allowed,
  );
  assert.equal(
    fallback.responseHeaders.get("access-control-allow-origin"),
    allowedOrigin,
  );
});
