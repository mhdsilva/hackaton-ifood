import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { ParticipantAccessStore } from "../party/access.js";
import { PartyService } from "../party/service.js";
import { PartyStore } from "../party/store.js";
import { createPartyServer } from "../server.js";

const allowedOrigin = "https://party.example.com";

async function startApi(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const service = new PartyService(new PartyStore(), new ParticipantAccessStore());
  const server = createPartyServer(service, { allowedOrigin });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error?: Error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function post(
  baseUrl: string,
  path: string,
  body: unknown,
  token?: string,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: allowedOrigin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("exposes the onboarding flow and a token-free polling snapshot", async () => {
  const api = await startApi();
  try {
    const createResponse = await post(api.baseUrl, "/parties", {
      name: "Jantar de sexta",
      host: { id: "ana", name: "Ana" },
    });
    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.headers.get("access-control-allow-origin"), allowedOrigin);
    const host = await createResponse.json();

    const joinResponse = await post(api.baseUrl, `/parties/${host.party.party.code}/join`, {
      participant: { id: "bruno", name: "Bruno" },
    });
    assert.equal(joinResponse.status, 200);
    const guest = await joinResponse.json();

    const closeResponse = await post(
      api.baseUrl,
      `/parties/${host.party.party.id}/close`,
      {},
      host.participantToken,
    );
    assert.equal(closeResponse.status, 200);

    await post(
      api.baseUrl,
      `/parties/${host.party.party.id}/answers`,
      { questionnaireVersion: "v1", answers: { preference: "massa" }, completed: true },
      host.participantToken,
    );
    const finalAnswer = await post(
      api.baseUrl,
      `/parties/${host.party.party.id}/answers`,
      { questionnaireVersion: "v1", answers: { preference: "pizza" }, completed: true },
      guest.participantToken,
    );
    assert.equal(finalAnswer.status, 200);
    assert.equal((await finalAnswer.json()).party.status, "READY_FOR_THEME");

    const pollingResponse = await fetch(`${api.baseUrl}/parties/${host.party.party.id}`);
    const pollingBody = await pollingResponse.text();
    assert.equal(pollingResponse.status, 200);
    assert.equal(pollingBody.includes(host.participantToken), false);
    assert.equal(pollingBody.includes(guest.participantToken), false);
  } finally {
    await api.close();
  }
});

test("requires a Party-scoped Bearer token and keeps CORS on errors", async () => {
  const api = await startApi();
  try {
    const host = await (
      await post(api.baseUrl, "/parties", {
        name: "Jantar de sexta",
        host: { id: "ana", name: "Ana" },
      })
    ).json();
    await post(api.baseUrl, `/parties/${host.party.party.id}/join`, {
      participant: { id: "bruno", name: "Bruno" },
    });
    const foreign = await (
      await post(api.baseUrl, "/parties", {
        name: "Outra Party",
        host: { id: "intruso", name: "Intruso" },
      })
    ).json();

    const missingToken = await post(
      api.baseUrl,
      `/parties/${host.party.party.id}/close`,
      {},
    );
    assert.equal(missingToken.status, 401);
    assert.equal((await missingToken.json()).error.code, "ACCESS_TOKEN_REQUIRED");
    assert.equal(missingToken.headers.get("access-control-allow-origin"), allowedOrigin);

    const foreignToken = await post(
      api.baseUrl,
      `/parties/${host.party.party.id}/close`,
      {},
      foreign.participantToken,
    );
    assert.equal(foreignToken.status, 403);
    assert.equal((await foreignToken.json()).error.code, "ACCESS_DENIED");
    assert.equal(foreignToken.headers.get("access-control-allow-origin"), allowedOrigin);
  } finally {
    await api.close();
  }
});
