import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChatClient, ChatMessage } from "../llm/client.js";
import { AgentError } from "./pick-address.js";
import { buildProposedOptions, resolveOptionsWithPlanner } from "./planner-options.js";
import type { IfoodAddress, IfoodItemDetail, IfoodSearchItem, ToolCaller } from "./types.js";

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

/** `ToolCaller` de teste: responde listAddresses, searchOffers e getItem a partir dos itens dados. */
function callerFor(items: IfoodSearchItem[]): ToolCaller {
  return {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      if (name === "listAddresses") return { results: [address] } as T;
      if (name === "searchOffers") return { results: items } as T;
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

function isNoOptions(error: unknown): boolean {
  return error instanceof AgentError && error.code === "NO_OPTIONS";
}

test("buildProposedOptions turns proposed items into ranked options", async () => {
  const items = [candidate("m1", "i1", 30, 5), candidate("m2", "i2", 25)];
  const options = await buildProposedOptions(items, callerFor(items), { budget: 60, address });

  assert.deepEqual(
    options.map((option) => option.merchant.id).sort(),
    ["m1", "m2"],
  );
});

test("buildProposedOptions keeps over-budget items, ordered after the ones within it", async () => {
  const items = [candidate("m1", "i1", 30, 5), candidate("m2", "i2", 8)];
  const options = await buildProposedOptions(items, callerFor(items), { budget: 30, address });
  assert.deepEqual(
    options.map((option) => [option.merchant.id, option.total]),
    [
      ["m2", 8],
      ["m1", 35],
    ],
  );
});

test("buildProposedOptions never returns more than maxOptions", async () => {
  const items = ["m1", "m2", "m3", "m4"].map((merchant) => candidate(merchant, `i-${merchant}`, 20));
  const options = await buildProposedOptions(items, callerFor(items), {
    budget: 100,
    address,
    maxOptions: 3,
  });
  assert.equal(options.length, 3);
});

test("resolveOptionsWithPlanner returns live options from the model proposal", async () => {
  const items = [candidate("m1", "i1", 30, 5)];
  const client = scripted([
    assistant({ name: "searchOffers", args: JSON.stringify({ query: "massa" }) }),
    assistant({
      name: "proposeOptions",
      args: JSON.stringify({ items: [{ merchantId: "m1", itemId: "i1" }] }),
    }),
    assistant(null, "pronto"),
  ]);

  const output = await resolveOptionsWithPlanner(
    { participantId: "p1", theme: "italiano", budget: 60, restrictions: [] },
    callerFor(items),
    client,
  );

  assert.equal(output.source, "live");
  assert.equal(output.participantId, "p1");
  assert.equal(output.theme, "italiano");
  assert.equal(output.options.length, 1);
  assert.equal(output.options[0].items[0].itemId, "i1");
});

test("resolveOptionsWithPlanner fails when the model never proposes", async () => {
  const client = scripted([assistant(null, "não achei nada")]);
  await assert.rejects(
    resolveOptionsWithPlanner(
      { participantId: "p1", theme: "italiano", budget: 60, restrictions: [] },
      callerFor([]),
      client,
    ),
    isNoOptions,
  );
});

test("an invented item id never becomes an option", async () => {
  const items = [candidate("m1", "i1", 30, 5)];
  const client = scripted([
    assistant({ name: "searchOffers", args: JSON.stringify({ query: "massa" }) }),
    assistant({
      name: "proposeOptions",
      args: JSON.stringify({ items: [{ merchantId: "m9", itemId: "i9" }] }),
    }),
    assistant(null, "pronto"),
  ]);

  await assert.rejects(
    resolveOptionsWithPlanner(
      { participantId: "p1", theme: "italiano", budget: 60, restrictions: [] },
      callerFor(items),
      client,
    ),
    isNoOptions,
  );
});
