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
