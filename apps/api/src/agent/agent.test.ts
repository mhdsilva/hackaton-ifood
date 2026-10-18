import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AgentError,
  cheapestRequiredOptions,
  fixtureCaller,
  loadDiscoveryFixture,
  mapRestrictions,
  pickAddress,
  resolveOptions,
  resolveOptionsForParty,
  resolveOptionsWithFallback,
  themeQueries,
  type IfoodAddress,
  type ToolCaller,
} from "./index.js";

const fixture = await loadDiscoveryFixture();
const RAGU = "de94e756-7501-45a6-a0cd-22b33f11066d";

const input = {
  participantId: "ana",
  theme: "Italiano",
  budget: 60,
  restrictions: [],
};

function address(id: string, alias?: string): IfoodAddress {
  return {
    addressId: id,
    alias: alias ?? null,
    location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
    coordinates: { latitude: -22, longitude: -47.9 },
  };
}

const failingCaller: ToolCaller = {
  async callTool() {
    throw new Error("network down");
  },
};

test("theme maps to search terms and unknown themes search themselves", () => {
  assert.deepEqual(themeQueries("Italiano"), ["massa", "pizza", "lasanha"]);
  assert.deepEqual(themeQueries("  Coreano "), ["Coreano"]);
});

test("restrictions map to iFood enums and report unknown ones", () => {
  assert.deepEqual(mapRestrictions(["vegetariano", "Sem Glúten", "kosher"]), {
    itemRestrictions: ["VEGETARIAN", "GLUTEN_FREE"],
    ignored: ["kosher"],
  });
});

test("address: one is used, many require a choice without exposing the street", () => {
  assert.equal(pickAddress([address("a")]).addressId, "a");
  assert.equal(pickAddress([address("a"), address("b")], "b").addressId, "b");
  assert.throws(
    () => pickAddress([address("a", "Casa"), address("b")]),
    (error: unknown) => {
      assert.ok(error instanceof AgentError);
      assert.equal(error.code, "ADDRESS_SELECTION_REQUIRED");
      assert.deepEqual(
        (error.details?.candidates as Array<{ label: string }>).map((candidate) => candidate.label),
        ["Casa", "Centro, São Carlos"],
      );
      return true;
    },
  );
  assert.throws(() => pickAddress([]), (error: unknown) => (error as AgentError).code === "NO_ADDRESS");
});

test("required option groups use the cheapest choices", () => {
  const selected = cheapestRequiredOptions(fixture.getItem[RAGU]);
  assert.deepEqual(
    selected.map((option) => option.name),
    ["Ragu de Costela Box P (aprox. 450g)", "Talharim"],
  );
});

test("resolves real captured options within budget, minimum order included", async () => {
  const output = await resolveOptions(input, fixtureCaller(fixture));

  assert.equal(output.source, "live");
  assert.deepEqual(
    output.options.map((option) => [option.merchant.name, option.items[0].quantity, option.total]),
    [
      ["Tomate Cru Pizzaria", 2, 39.8],
      ["Italin House Macarrão Gourmet - São Carlos", 1, 38.17],
    ],
  );
  const [pizza] = output.options;
  assert.equal(pizza.minimumOrderAmount, 29.9);
  assert.ok(pizza.subtotal >= pizza.minimumOrderAmount);
  assert.equal(pizza.items[0].selectedOptions.length, 2);
});

test("keeps options over the budget instead of returning nothing", async () => {
  const { options } = await resolveOptions({ ...input, budget: 30 }, fixtureCaller(fixture));
  assert.deepEqual(options.map((option) => option.merchant.name), [
    "Tomate Cru Pizzaria",
    "Italin House Macarrão Gourmet - São Carlos",
  ]);
});

test("orders options within the budget reference before the ones over it", async () => {
  const { options } = await resolveOptions({ ...input, budget: 36 }, fixtureCaller(fixture));
  assert.deepEqual(
    options.map((option) => [option.merchant.name, option.total]),
    [
      ["Italin House Macarrão Gourmet - São Carlos", 38.17],
      ["Tomate Cru Pizzaria", 39.8],
    ],
  );
});

test("fails clearly when the theme has no results", async () => {
  await assert.rejects(
    resolveOptions({ ...input, theme: "inexistente", budget: 60 }, fixtureCaller(fixture)),
    (error: unknown) => error instanceof AgentError && error.code === "NO_OPTIONS",
  );
});

test("one participant failing does not affect the others", async () => {
  const results = await resolveOptionsForParty([
    { input, caller: fixtureCaller(fixture) },
    { input: { ...input, participantId: "bruno" }, caller: failingCaller },
  ]);

  assert.equal(results[0].status, "ok");
  assert.deepEqual(
    { participantId: results[1].participantId, status: results[1].status },
    { participantId: "bruno", status: "error" },
  );
});

test("fallback returns simulated options when iFood is down", async () => {
  const output = await resolveOptionsWithFallback(input, failingCaller, fixture);

  assert.equal(output.source, "simulated");
  assert.ok(output.options.length > 0);
  assert.match(output.warnings.at(-1) ?? "", /demonstração/);
});

test("fallback does not hide an address choice the participant must make", async () => {
  const twoAddresses: ToolCaller = {
    async callTool<T>() {
      return { results: [address("a"), address("b")] } as T;
    },
  };

  await assert.rejects(
    resolveOptionsWithFallback(input, twoAddresses, fixture),
    (error: unknown) => error instanceof AgentError && error.code === "ADDRESS_SELECTION_REQUIRED",
  );
});

test("times out a slow iFood instead of hanging the Party", async () => {
  const slow: ToolCaller = {
    callTool: () => new Promise((resolve) => setTimeout(resolve, 200)),
  };

  await assert.rejects(
    resolveOptions(input, slow, { timeoutMs: 20 }),
    (error: unknown) => error instanceof AgentError && error.code === "TIMEOUT",
  );
});
