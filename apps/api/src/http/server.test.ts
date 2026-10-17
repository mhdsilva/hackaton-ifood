import assert from "node:assert/strict";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";

import { McpSessionRegistry } from "../mcp/session-registry.js";
import { ParticipantAccessStore } from "../party/access.js";
import { PartyService } from "../party/service.js";
import { PartyStore } from "../party/store.js";
import { handlePartyRequest } from "../server.js";

const allowedOrigin = "https://party.example.com";

interface TestApi {
  service: PartyService;
  sessions: McpSessionRegistry;
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
    { allowedOrigin, mcpSessions: api.sessions } as any,
  );
  await finished;
  return response;
}

function createApi(): TestApi {
  return {
    service: new PartyService(new PartyStore(), new ParticipantAccessStore()),
    sessions: new McpSessionRegistry(),
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

test("stores an MCP key privately and rejects a token from another Party", async () => {
  const api = createApi();
  const secret = "super-secret-key-ana-987";
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

  const connection = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection`,
    { apiKey: secret },
    host.participantToken,
  );
  assert.equal(connection.statusCode, 200);
  assert.deepEqual(connection.json(), { status: "validating" });
  assert.equal(connection.text().includes(secret), false);
  assert.equal(api.sessions.get(host.party.party.id, "ana"), secret);

  const polling = await request(api, "GET", `/parties/${host.party.party.id}`);
  assert.equal(polling.text().includes(secret), false);
  assert.equal(
    polling.json().participants.find((participant: any) => participant.id === "ana")
      .mcpConnectionStatus,
    "validating",
  );

  const rejected = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection`,
    { apiKey: "foreign-secret-key" },
    foreign.participantToken,
  );
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.text().includes("foreign-secret-key"), false);
  assert.equal(api.sessions.get(host.party.party.id, "intruso"), undefined);
  assert.equal(api.sessions.get(host.party.party.id, "ana"), secret);
});

test("rejects a null MCP connection body as invalid input", async () => {
  const api = createApi();
  const host = (
    await request(api, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();

  const response = await request(
    api,
    "POST",
    `/parties/${host.party.party.id}/mcp-connection`,
    null,
    host.participantToken,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "INVALID_INPUT");
});
