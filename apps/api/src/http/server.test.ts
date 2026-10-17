import assert from "node:assert/strict";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";

import { ParticipantAccessStore } from "../party/access.js";
import { PartyService } from "../party/service.js";
import { PartyStore } from "../party/store.js";
import { handlePartyRequest } from "../server.js";

const allowedOrigin = "https://party.example.com";

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
  service: PartyService,
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
    service,
    { allowedOrigin },
  );
  await finished;
  return response;
}

function createService(): PartyService {
  return new PartyService(new PartyStore(), new ParticipantAccessStore());
}

test("exposes the onboarding flow and a token-free polling snapshot", async () => {
  const service = createService();
  const createResponse = await request(service, "POST", "/parties", {
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.responseHeaders.get("access-control-allow-origin"), allowedOrigin);
  const host = createResponse.json();

  const joinResponse = await request(service, "POST", `/parties/${host.party.party.code}/join`, {
    participant: { id: "bruno", name: "Bruno" },
  });
  assert.equal(joinResponse.statusCode, 200);
  const guest = joinResponse.json();

  const closeResponse = await request(
    service,
    "POST",
    `/parties/${host.party.party.id}/close`,
    {},
    host.participantToken,
  );
  assert.equal(closeResponse.statusCode, 200);

  await request(
    service,
    "POST",
    `/parties/${host.party.party.id}/answers`,
    { questionnaireVersion: "v1", answers: { preference: "massa" }, completed: true },
    host.participantToken,
  );
  const finalAnswer = await request(
    service,
    "POST",
    `/parties/${host.party.party.id}/answers`,
    { questionnaireVersion: "v1", answers: { preference: "pizza" }, completed: true },
    guest.participantToken,
  );
  assert.equal(finalAnswer.statusCode, 200);
  assert.equal(finalAnswer.json().party.status, "READY_FOR_THEME");

  const pollingResponse = await request(
    service,
    "GET",
    `/parties/${host.party.party.id}`,
  );
  assert.equal(pollingResponse.statusCode, 200);
  assert.equal(pollingResponse.text().includes(host.participantToken), false);
  assert.equal(pollingResponse.text().includes(guest.participantToken), false);
});

test("requires a Party-scoped Bearer token and keeps CORS on errors", async () => {
  const service = createService();
  const host = (
    await request(service, "POST", "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    })
  ).json();
  await request(service, "POST", `/parties/${host.party.party.id}/join`, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const foreign = (
    await request(service, "POST", "/parties", {
      name: "Outra Party",
      host: { id: "intruso", name: "Intruso" },
    })
  ).json();

  const missingToken = await request(
    service,
    "POST",
    `/parties/${host.party.party.id}/close`,
    {},
  );
  assert.equal(missingToken.statusCode, 401);
  assert.equal(missingToken.json().error.code, "ACCESS_TOKEN_REQUIRED");
  assert.equal(missingToken.responseHeaders.get("access-control-allow-origin"), allowedOrigin);

  const foreignToken = await request(
    service,
    "POST",
    `/parties/${host.party.party.id}/close`,
    {},
    foreign.participantToken,
  );
  assert.equal(foreignToken.statusCode, 403);
  assert.equal(foreignToken.json().error.code, "ACCESS_DENIED");
  assert.equal(foreignToken.responseHeaders.get("access-control-allow-origin"), allowedOrigin);
});
