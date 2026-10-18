import assert from "node:assert/strict";
import { test } from "node:test";

import { itemKey, rankSeenItems, systemTools, themeFromAnswers } from "./planner-tools.js";
import type { IfoodSearchItem, ToolCaller } from "./types.js";

function candidate(
  merchantId: string,
  itemId: string,
  unitPrice: number,
  options: { rating?: number; distance?: number } = {},
): IfoodSearchItem {
  return {
    itemId,
    itemName: `Item ${itemId}`,
    unitPrice,
    merchant: {
      merchantId,
      merchantName: `Loja ${merchantId}`,
      isOpen: true,
      straightLineDistanceKm: options.distance ?? 1,
      ...(options.rating !== undefined ? { reviewRating: options.rating } : {}),
      deliveryMethod: {
        deliveryMethodId: `d-${merchantId}`,
        estimatedMinutes: { min: 20, max: 30 },
        fee: 0,
      },
    },
  };
}

/** Contexto de teste: `search` simula o catálogo por termo. */
function makeContext(search: Record<string, IfoodSearchItem[]> = {}) {
  const seen = new Map<string, IfoodSearchItem>();
  const record = (items: IfoodSearchItem[]) => {
    for (const item of items) {
      const key = itemKey(item.merchant.merchantId, item.itemId);
      if (key && !seen.has(key)) seen.set(key, item);
    }
  };
  const caller: ToolCaller = {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      if (name === "searchOffers") return { results: search[String(args.query)] ?? [] } as T;
      throw new Error(`tool inesperada: ${name}`);
    },
  };
  const tools = systemTools({
    caller,
    seen,
    record,
    resolveLocation: async () => ({ latitude: 0, longitude: 0 }),
  });
  return { tools, seen, record };
}

test("themeFromAnswers reuses the party rule and lists queries", () => {
  assert.deepEqual(themeFromAnswers({ theme: "Japones" }), {
    theme: "japones",
    queries: ["sushi", "temaki", "yakisoba"],
  });
  assert.equal(themeFromAnswers({}).theme, "italiano");
});

test("proposeSubstitutes keeps only the terms that exist in the catalog", async () => {
  const context = makeContext({ kibe: [candidate("m1", "i1", 20)], esfiha: [] });

  const result = (await context.tools.proposeSubstitutes.run({
    queries: ["esfiha", "kibe"],
  })) as { substitutes: Array<{ query: string }> };

  assert.deepEqual(
    result.substitutes.map((entry) => entry.query),
    ["kibe"],
  );
  assert.ok(context.seen.has(itemKey("m1", "i1")!));
});

test("proposeSubstitutes requires at least one query", async () => {
  const context = makeContext();
  await assert.rejects(context.tools.proposeSubstitutes.run({ queries: [] }), /queries é obrigatório/);
});

test("describeOption only describes items the executor saw", async () => {
  const context = makeContext();
  context.record([candidate("m1", "i1", 30, { rating: 4.7 })]);

  const description = (await context.tools.describeOption.run({
    merchantId: "m1",
    itemId: "i1",
  })) as { itemName: string; price: number; rating?: number };

  assert.equal(description.itemName, "Item i1");
  assert.equal(description.price, 30);
  assert.equal(description.rating, 4.7);

  await assert.rejects(
    context.tools.describeOption.run({ merchantId: "m9", itemId: "i9" }),
    /não apareceu/,
  );
});

test("rankOptions orders known items and ignores unknown ids", async () => {
  const context = makeContext();
  context.record([
    candidate("low", "i1", 30, { rating: 4 }),
    candidate("high", "i2", 50, { rating: 4.9 }),
    candidate("mid", "i3", 20, { rating: 4.9, distance: 5 }),
  ]);

  const result = (await context.tools.rankOptions.run({
    items: [
      { merchantId: "low", itemId: "i1" },
      { merchantId: "mid", itemId: "i3" },
      { merchantId: "high", itemId: "i2" },
      { merchantId: "unknown", itemId: "nope" },
    ],
  })) as { items: Array<{ merchantId: string }> };

  assert.deepEqual(
    result.items.map((entry) => entry.merchantId),
    ["high", "mid", "low"],
  );
});

test("rankSeenItems breaks ties by distance and then price", () => {
  const ranked = rankSeenItems([
    candidate("far", "a", 10, { rating: 5, distance: 9 }),
    candidate("near", "b", 40, { rating: 5, distance: 1 }),
    candidate("cheap", "c", 5, { rating: 5, distance: 1 }),
  ]);
  assert.deepEqual(
    ranked.map((item) => item.merchant.merchantId),
    ["cheap", "near", "far"],
  );
});
