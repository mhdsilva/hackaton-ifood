import assert from "node:assert/strict";
import { test } from "node:test";

import { LlmError, type ChatClient, type ChatMessage } from "../llm/client.js";
import { resolveOptionsPreferringPlanner } from "./fallback.js";
import { AgentError } from "./pick-address.js";
import type { IfoodAddress, IfoodItemDetail, IfoodSearchItem, ToolCaller } from "./types.js";

const input = { participantId: "p1", theme: "italiano", budget: 60, restrictions: [] };

const address: IfoodAddress = {
  addressId: "addr-1",
  alias: "Casa",
  location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
  coordinates: { latitude: -22.01, longitude: -47.89 },
};

function candidate(merchantId: string, itemId: string, unitPrice: number, fee = 0): IfoodSearchItem {
  return {
    itemId,
    itemName: `Item ${itemId}`,
    unitPrice,
    merchant: {
      merchantId,
      merchantName: `Loja ${merchantId}`,
      isOpen: true,
      straightLineDistanceKm: 1.2,
      reviewRating: 4.5,
      deliveryMethod: {
        deliveryMethodId: `d-${merchantId}`,
        estimatedMinutes: { min: 20, max: 30 },
        fee,
      },
    },
  };
}

/** `ToolCaller` de teste; `search` vazio simula um iFood sem resultado (cai na fixture). */
function callerFor(items: IfoodSearchItem[], options: { failSearch?: boolean } = {}): ToolCaller {
  return {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      if (name === "listAddresses") return { results: [address] } as T;
      if (name === "searchOffers") {
        if (options.failSearch) throw new Error("iFood fora do ar");
        return { results: items } as T;
      }
      if (name === "getItem") {
        const found = items.find((item) => item.itemId === args.itemId);
        if (!found) throw new Error("item fora do catálogo");
        const detail: IfoodItemDetail = {
          itemId: found.itemId,
          itemName: found.itemName,
          merchantId: found.merchant.merchantId,
          unitPrice: found.unitPrice,
        };
        return detail as T;
      }
      throw new Error(`tool inesperada: ${name}`);
    },
  };
}

function assistant(call: { name: string; args: string } | null, text = ""): ChatMessage {
  if (!call) return { role: "assistant", content: text };
  return {
    role: "assistant",
    content: text || null,
    tool_calls: [
      { id: "call_1", type: "function", function: { name: call.name, arguments: call.args } },
    ],
  };
}

function scripted(responses: ChatMessage[]): ChatClient {
  let index = 0;
  return {
    async complete() {
      const reply = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return reply;
    },
  };
}

const failingClient: ChatClient = {
  async complete() {
    throw new LlmError("UNAVAILABLE", "provedor fora do ar");
  },
};

test("prefers the planner when the model proposes options", async () => {
  const items = [candidate("m1", "i1", 30, 5)];
  const client = scripted([
    assistant({ name: "searchOffers", args: JSON.stringify({ query: "massa" }) }),
    assistant({
      name: "proposeOptions",
      args: JSON.stringify({ items: [{ merchantId: "m1", itemId: "i1" }] }),
    }),
    assistant(null, "pronto"),
  ]);

  const output = await resolveOptionsPreferringPlanner(input, callerFor(items), client);

  assert.equal(output.source, "live");
  assert.equal(output.options[0].items[0].itemId, "i1");
});

test("falls back to the deterministic path when the LLM is down", async () => {
  const output = await resolveOptionsPreferringPlanner(
    input,
    callerFor([candidate("m1", "i1", 30, 5)]),
    failingClient,
  );

  assert.equal(output.source, "live");
  assert.ok(output.options.length > 0);
});

test("falls back to the fixture when the LLM and iFood both fail", async () => {
  const output = await resolveOptionsPreferringPlanner(
    input,
    callerFor([], { failSearch: true }),
    failingClient,
  );

  assert.equal(output.source, "simulated");
  assert.ok(output.options.length > 0);
});

test("a planner that never converges degrades to the deterministic path", async () => {
  let clock = 0;
  const stuck: ChatClient = {
    async complete() {
      clock += 100;
      return assistant({ name: "searchOffers", args: JSON.stringify({ query: "massa" }) });
    },
  };

  const output = await resolveOptionsPreferringPlanner(
    input,
    callerFor([candidate("m1", "i1", 30, 5)]),
    stuck,
    { maxSteps: 10, timeoutMs: 50, now: () => clock },
  );

  assert.equal(output.source, "live");
  assert.ok(output.options.length > 0);
});

test("does not mask an address problem behind the planner", async () => {
  const caller: ToolCaller = {
    async callTool<T>(): Promise<T> {
      return { results: [] } as T;
    },
  };

  await assert.rejects(
    resolveOptionsPreferringPlanner(input, caller, scripted([assistant(null, "oi")])),
    (error: unknown) => error instanceof AgentError && error.code === "NO_ADDRESS",
  );
});
