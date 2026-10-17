import assert from "node:assert/strict";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";

import { createDemoIntegration, type PartyAgentIntegration } from "../agent/integration.js";
import { AgentError } from "../agent/pick-address.js";
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
  agent?: PartyAgentIntegration;
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
    { allowedOrigins, frontendUrl, oauth: api.oauth, agent: api.agent } as any,
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
    { questionnaireVersion: "v1", answers: { address: "massa" }, completed: true },
    host.participantToken,
  );
  const finalAnswer = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/answers`,
    { questionnaireVersion: "v1", answers: { address: "pizza" }, completed: true },
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

test("accepts the iFood OAuth mode only with the agent configuration", () => {
  assert.equal(resolveMcpOAuthMode(undefined), "demo");
  assert.equal(resolveMcpOAuthMode("demo"), "demo");
  assert.equal(resolveMcpOAuthMode(" DEMO "), "demo");
  assert.throws(() => resolveMcpOAuthMode("ifood", {}), /IFOOD_CLIENT_ID/);
  assert.equal(
    resolveMcpOAuthMode("ifood", {
      IFOOD_CLIENT_ID: "client",
      IFOOD_CLIENT_SECRET: "secret",
      PUBLIC_API_URL: "https://api.example",
    }),
    "ifood",
  );
  assert.throws(() => resolveMcpOAuthMode("bogus"), /inválido/);
});

async function createHostAndAuthorize(api: TestApi) {
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
  return { host, state };
}

test("completes OAuth on the single callback, finding the Party from state", async () => {
  const api = createApi();
  const { host, state } = await createHostAndAuthorize(api);

  const callback = await request(
    api,
    "GET",
    `/mcp-connection/callback?code=approved&state=${encodeURIComponent(state)}`,
  );

  assert.equal(callback.statusCode, 302);
  assert.equal(
    callback.responseHeaders.get("location"),
    `${frontendUrl}?partyId=${host.party.party.id}&mcp=connected`,
  );
  assert.equal(api.sessions.get(host.party.party.id, "ana")?.accessToken, "private-access-token");
});

test("serves the callback on the path registered in the iFood agent", async () => {
  const api = createApi();
  const { state } = await createHostAndAuthorize(api);
  const options = { allowedOrigins: [allowedOrigin], frontendUrl, oauth: api.oauth, callbackPath: "/callback" };
  const run = async (path: string) => {
    const incoming = Object.assign(Readable.from([]), {
      method: "GET",
      url: path,
      headers: { origin: allowedOrigin },
    }) as unknown as IncomingMessage;
    const response = new MemoryResponse();
    const finished = once(response, "finish");
    await handlePartyRequest(incoming, response as unknown as ServerResponse, api.service, options);
    await finished;
    return response;
  };

  assert.equal((await run(`/mcp-connection/callback?code=x&state=${state}`)).statusCode, 404);
  assert.equal((await run(`/callback?code=approved&state=${encodeURIComponent(state)}`)).statusCode, 302);
});

test("marks the connection as error when the iFood read check fails", async () => {
  const api: TestApi = {
    ...createApi(),
    agent: {
      validateConnection: async () => "error",
      resolveOptions: async () => {
        throw new Error("unused");
      },
    },
  };
  const { host, state } = await createHostAndAuthorize(api);

  const callback = await request(
    api,
    "GET",
    `/mcp-connection/callback?code=approved&state=${encodeURIComponent(state)}`,
  );

  assert.equal(
    callback.responseHeaders.get("location"),
    `${frontendUrl}?partyId=${host.party.party.id}&mcp=error`,
  );
  const snapshot = await request(api, "GET", `/parties/${host.party.party.id}`);
  assert.equal(snapshot.json().participants[0].mcpConnectionStatus, "error");
});

test("returns simulated local options in demo mode for the token owner", async () => {
  const api: TestApi = { ...createApi(), agent: createDemoIntegration() };
  const { host } = await createHostAndAuthorize(api);
  const path = `/parties/${host.party.party.id}/options`;

  const unauthenticated = await request(api, "POST", path, { theme: "italiano", budget: 60 });
  assert.equal(unauthenticated.statusCode, 401);

  const invalid = await request(api, "POST", path, { theme: "", budget: 60 }, host.participantToken);
  assert.equal(invalid.statusCode, 400);

  const options = await request(
    api,
    "POST",
    path,
    { theme: "italiano", budget: 60, restrictions: [] },
    host.participantToken,
  );
  assert.equal(options.statusCode, 200);
  assert.equal(options.json().participantId, "ana");
  assert.equal(options.json().source, "simulated");
  assert.ok(options.json().options.length > 0);
});

test("demo checkout: cart, consent-gated order and tracking per participant", async () => {
  let now = Date.parse("2026-10-17T20:00:00Z");
  const api: TestApi = { ...createApi(), agent: createDemoIntegration(() => now) };
  const { host } = await createHostAndAuthorize(api);
  const partyId = host.party.party.id;
  const token = host.participantToken;

  const options = (
    await request(api, "POST", `/parties/${partyId}/options`, { theme: "italiano", budget: 60 }, token)
  ).json();
  const cart = await request(api, "POST", `/parties/${partyId}/cart`, { option: options.options[0] }, token);
  assert.equal(cart.statusCode, 200);
  assert.equal(cart.json().paymentMethod, "PIX");
  assert.equal(cart.json().simulated, true);

  const invalidCart = await request(api, "POST", `/parties/${partyId}/cart`, { option: {} }, token);
  assert.equal(invalidCart.statusCode, 400);

  const noConsent = await request(
    api,
    "POST",
    `/parties/${partyId}/order`,
    { cartId: cart.json().cartId },
    token,
  );
  assert.equal(noConsent.statusCode, 400);
  assert.equal(noConsent.json().error.code, "CONSENT_REQUIRED");

  const order = await request(
    api,
    "POST",
    `/parties/${partyId}/order`,
    { cartId: cart.json().cartId, userConsent: true },
    token,
  );
  assert.equal(order.statusCode, 201);
  const orderId = order.json().orderId;

  const first = await request(api, "GET", `/parties/${partyId}/order/${orderId}`, undefined, token);
  assert.deepEqual(
    [first.json().statusCode, first.json().terminal, first.json().retryAfterSeconds],
    ["CONFIRMED", false, 5],
  );
  now += 61_000;
  const last = await request(api, "GET", `/parties/${partyId}/order/${orderId}`, undefined, token);
  assert.deepEqual([last.json().statusCode, last.json().terminal], ["CONCLUDED", true]);

  const unauthenticated = await request(api, "GET", `/parties/${partyId}/order/${orderId}`);
  assert.equal(unauthenticated.statusCode, 401);
});

test("asks the participant to choose an address without exposing it", async () => {
  const api: TestApi = {
    ...createApi(),
    agent: {
      resolveOptions: async () => {
        throw new AgentError("ADDRESS_SELECTION_REQUIRED", "Escolha em qual endereço quer receber", {
          candidates: [{ addressId: "a", label: "Casa", isLastUsed: true }],
        });
      },
    },
  };
  const { host } = await createHostAndAuthorize(api);

  const response = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/options`,
    { theme: "italiano", budget: 60 },
    host.participantToken,
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "ADDRESS_SELECTION_REQUIRED");
  assert.equal(response.json().error.details.candidates[0].label, "Casa");
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

test("rejects invalid questionnaire answers over HTTP", async () => {
  const api = createApi();
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  const partyId = host.party.party.id;
  await request(api, "POST", `/parties/${partyId}/join`, {
    participant: { id: "bruno", name: "Bruno" },
  });
  await request(api, "POST", `/parties/${partyId}/close`, {}, host.participantToken);

  const invalid = await request(
    api,
    "POST",
    `/parties/${partyId}/answers`,
    { questionnaireVersion: "v1", answers: {}, completed: true },
    host.participantToken,
  );
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, "INVALID_ANSWERS");

  const unknown = await request(
    api,
    "POST",
    `/parties/${partyId}/answers`,
    { questionnaireVersion: "v9", answers: { address: "casa" }, completed: true },
    host.participantToken,
  );
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.json().error.code, "QUESTIONNAIRE_VERSION_UNKNOWN");
});
