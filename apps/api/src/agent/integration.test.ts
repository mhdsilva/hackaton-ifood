import assert from "node:assert/strict";
import { test } from "node:test";

import { McpSessionRegistry } from "../mcp/session-registry.js";
import type { McpOAuthProvider } from "../ifood/provider.js";
import { createIfoodIntegration } from "./integration.js";

interface SeenRequest {
  authorization: string;
  body: {
    method: string;
    id?: number;
    params?: { name?: string; arguments?: Record<string, unknown> };
  };
}

function fakeMcp(
  respond: (tool: string, args: Record<string, unknown>) => unknown,
): { fetchImpl: typeof globalThis.fetch; seen: SeenRequest[] } {
  const seen: SeenRequest[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body)) as SeenRequest["body"];
    seen.push({ authorization: headers.Authorization, body });

    if (body.method === "initialize") {
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: { protocolVersion: "2025-06-18" },
      });
      return new Response(`event: message\ndata: ${message}\n\n`, {
        headers: { "Content-Type": "text/event-stream", "Mcp-Session-Id": "fake-session" },
      });
    }
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    const tool = body.params?.name ?? "";
    const args = body.params?.arguments ?? {};
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: { content: [{ type: "text", text: JSON.stringify(respond(tool, args)) }] },
    });
  }) as typeof globalThis.fetch;
  return { fetchImpl, seen };
}

const provider: McpOAuthProvider = {
  mode: "ifood",
  createAuthorizationUrl: () => "https://ifood.example/authorize",
  async exchangeCode() {
    return { accessToken: "unused", refreshToken: "unused", expiresInSeconds: 3600 };
  },
};

test("checkoutMode simulated still resolves the real chosen address for the retrospective distance", async () => {
  const { fetchImpl, seen } = fakeMcp((tool) => {
    if (tool === "listAddresses") {
      return {
        results: [
          {
            addressId: "home",
            alias: "Casa",
            location: { neighborhood: "Centro", city: "São Carlos" },
            coordinates: { latitude: -22.01, longitude: -47.89 },
          },
        ],
      };
    }
    throw new Error(`Unexpected MCP tool: ${tool}`);
  });
  const sessions = new McpSessionRegistry();
  sessions.set("party-1", "participant-1", {
    accessToken: "participant-access-token",
    refreshToken: "participant-refresh-token",
    accessTokenExpiresAt: "2999-01-01T00:00:00.000Z",
  });
  const integration = createIfoodIntegration({
    sessions,
    provider,
    mcpUrl: "https://mcp.example/marketplace",
    fetchImpl,
    checkoutMode: "simulated",
  });
  const actor = { partyId: "party-1", participantId: "participant-1" };
  const option = {
    merchant: { id: "merchant-1", name: "Cantina", distanceKm: 1.2 },
    items: [{ itemId: "item-1", name: "Massa", quantity: 1, unitPrice: 42, selectedOptions: [] }],
    subtotal: 42,
    deliveryFee: 5,
    total: 47,
    minimumOrderAmount: 20,
    deliveryMethodId: "delivery-1",
    estimatedDeliveryMinutes: { min: 30, max: 45 },
  };

  const cart = await integration.prepareCart!(actor, { option, addressId: "home" });
  const again = await integration.prepareCart!(actor, { option, addressId: "home" });

  assert.equal(cart.simulated, true);
  assert.deepEqual(cart.participantCoordinates, { latitude: -22.01, longitude: -47.89 });
  assert.deepEqual(again.participantCoordinates, cart.participantCoordinates);
  const toolCalls = seen.filter((entry) => entry.body.method === "tools/call");
  // Lê o endereço real uma única vez (cache) e nunca cria carrinho/pedido de verdade no iFood.
  assert.deepEqual(toolCalls.map((entry) => entry.body.params?.name), ["listAddresses"]);
});

test("uses the participant MCP session for geocoding and confirmed address creation", async () => {
  const { fetchImpl, seen } = fakeMcp((tool, args) => {
    if (tool === "listAddresses") {
      return {
        results: [
          {
            addressId: "existing-address",
            alias: "Casa",
            location: { neighborhood: "Centro", city: "São Carlos" },
            coordinates: { latitude: -22.01, longitude: -47.89 },
          },
        ],
      };
    }
    if (tool !== "createAddress") throw new Error(`Unexpected MCP tool: ${tool}`);
    if (!args.candidateId) {
      return {
        matchConfidence: "MULTIPLE",
        candidates: [
          {
            candidateId: "candidate-1",
            formattedAddress: "Rua X, 44, Centro, São Carlos, SP, CEP 13560-000",
            location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
            coordinates: { latitude: -22.01, longitude: -47.89 },
          },
        ],
      };
    }
    return {
      addressId: "created-address",
      alias: null,
      location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
      postalCode: "13560-000",
      coordinates: { latitude: -22.01, longitude: -47.89 },
      agentHints: { alreadyExists: false },
    };
  });
  const sessions = new McpSessionRegistry();
  sessions.set("party-1", "participant-1", {
    accessToken: "participant-access-token",
    refreshToken: "participant-refresh-token",
    accessTokenExpiresAt: "2999-01-01T00:00:00.000Z",
  });
  const integration = createIfoodIntegration({
    sessions,
    provider,
    mcpUrl: "https://mcp.example/marketplace",
    fetchImpl,
  });
  const actor = { partyId: "party-1", participantId: "participant-1" };
  const address = "Rua X, 44, São Carlos, SP";

  const resolution = await integration.resolveNewAddress!(actor, { address });
  assert.deepEqual(resolution, {
    matchConfidence: "MULTIPLE",
    candidates: [
      {
        candidateId: "candidate-1",
        formattedAddress: "Rua X, 44, Centro, São Carlos, SP, CEP 13560-000",
        neighborhood: "Centro",
        city: "São Carlos",
        state: "SP",
      },
    ],
    simulated: false,
  });

  const created = await integration.createParticipantAddress!(actor, {
    address,
    candidateId: "candidate-1",
    neighborhood: "Centro",
    alias: "Casa",
    complement: "Apto 12",
    reference: "Portão azul",
  });
  assert.deepEqual(created, {
    address: {
      addressId: "created-address",
      label: "Centro, São Carlos",
      isLastUsedAddress: false,
      details: { neighborhood: "Centro", city: "São Carlos", state: "SP", postalCode: "13560-000" },
    },
    alreadyExists: false,
    simulated: false,
  });

  const toolCalls = seen.filter((entry) => entry.body.method === "tools/call");
  assert.deepEqual(
    toolCalls.map((entry) => entry.body.params?.name),
    ["listAddresses", "createAddress", "listAddresses", "createAddress"],
  );
  assert.deepEqual(toolCalls[1].body.params?.arguments, { address });
  assert.deepEqual(toolCalls[3].body.params?.arguments, {
    address,
    candidateId: "candidate-1",
    neighborhood: "Centro",
    alias: "Casa",
    complement: "Apto 12",
    reference: "Portão azul",
  });
  assert.ok(seen.every((entry) => entry.authorization === "Bearer participant-access-token"));
  assert.equal(JSON.stringify(resolution).includes("coordinates"), false);
  assert.equal(JSON.stringify(created).includes("coordinates"), false);
});

test("returns complete delivery details to the authenticated owner without MCP metadata", async () => {
  const { fetchImpl, seen } = fakeMcp(() => ({ results: [{
    addressId: "home", alias: "Casa", isLastUsedAddress: true,
    formattedAddress: "Rua X, 44, Apto 12, Centro, São Carlos, SP",
    location: { street: "Rua X", number: "44", neighborhood: "Centro", city: "São Carlos", state: "SP" },
    postalCode: "13560000", complement: "Apto 12", reference: "Portão azul",
    coordinates: { latitude: -22.01, longitude: -47.89 },
    topMerchantTypes: { RESTAURANT: "10" },
    agentHints: { ignored: true },
  }] }));
  const sessions = new McpSessionRegistry();
  sessions.set("party-1", "owner", {
    accessToken: "owner-token", refreshToken: "owner-refresh", accessTokenExpiresAt: "2999-01-01T00:00:00.000Z",
  });
  const integration = createIfoodIntegration({ sessions, provider, mcpUrl: "https://mcp.example/marketplace", fetchImpl });
  assert.deepEqual(await integration.listAddresses!({ partyId: "party-1", participantId: "owner" }), [{
    addressId: "home", label: "Casa", isLastUsedAddress: true,
    details: {
      formattedAddress: "Rua X, 44, Apto 12, Centro, São Carlos, SP",
      street: "Rua X", number: "44", neighborhood: "Centro", city: "São Carlos", state: "SP",
      postalCode: "13560000", complement: "Apto 12", reference: "Portão azul",
    },
  }]);
  assert.ok(seen.every((request) => request.authorization === "Bearer owner-token"));
  await assert.rejects(integration.listAddresses!({ partyId: "party-1", participantId: "other" }), { code: "MCP_NOT_CONNECTED" });
});
