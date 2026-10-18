import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveOptionsForPartyWithNegotiation } from "./negotiate.js";
import type { IfoodAddress, IfoodItemDetail, IfoodSearchItem, ToolCaller } from "./types.js";

const address: IfoodAddress = {
  addressId: "addr-1",
  alias: "Casa",
  location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
  coordinates: { latitude: -22.01, longitude: -47.89 },
};

function candidate(merchantId: string, itemId: string, unitPrice: number): IfoodSearchItem {
  return {
    itemId,
    itemName: `Item ${itemId}`,
    unitPrice,
    merchant: {
      merchantId,
      merchantName: `Loja ${merchantId}`,
      isOpen: true,
      straightLineDistanceKm: 1,
      reviewRating: 4.5,
      deliveryMethod: {
        deliveryMethodId: `d-${merchantId}`,
        estimatedMinutes: { min: 20, max: 30 },
        fee: 0,
      },
    },
  };
}

/** Endereço que só responde a um conjunto de termos; os demais voltam vazios. */
function callerFor(items: IfoodSearchItem[], queries: string[]): ToolCaller {
  return {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      if (name === "listAddresses") return { results: [address] } as T;
      if (name === "searchOffers") {
        const query = String(args.query ?? "").toLowerCase();
        return { results: queries.includes(query) ? items : [] } as T;
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

function request(participantId: string, caller: ToolCaller) {
  return { input: { participantId, theme: "italiano", budget: 60, restrictions: [] }, caller };
}

test("migrates the whole group to a theme that exists in every address", async () => {
  const ana = callerFor([candidate("ma", "ia", 30)], ["massa", "feijoada"]);
  const bruno = callerFor([candidate("mb", "ib", 25)], ["feijoada"]);

  const outcome = await resolveOptionsForPartyWithNegotiation([
    request("ana", ana),
    request("bruno", bruno),
  ]);

  assert.equal(outcome.negotiated, true);
  assert.equal(outcome.theme, "brasileiro");
  assert.ok(outcome.results.every((result) => result.status === "ok"));
});

test("keeps the original theme and result when no alternative closes", async () => {
  const ana = callerFor([candidate("ma", "ia", 30)], ["massa"]);
  const bruno = callerFor([candidate("mb", "ib", 25)], []);

  const outcome = await resolveOptionsForPartyWithNegotiation([
    request("ana", ana),
    request("bruno", bruno),
  ]);

  assert.equal(outcome.negotiated, false);
  assert.equal(outcome.theme, "italiano");
  const brunoResult = outcome.results.find((result) => result.participantId === "bruno");
  assert.equal(brunoResult?.status, "error");
});

test("does nothing when every participant already found the theme", async () => {
  const ana = callerFor([candidate("ma", "ia", 30)], ["massa"]);
  const bruno = callerFor([candidate("mb", "ib", 25)], ["pizza"]);

  const outcome = await resolveOptionsForPartyWithNegotiation([
    request("ana", ana),
    request("bruno", bruno),
  ]);

  assert.equal(outcome.negotiated, false);
  assert.equal(outcome.theme, "italiano");
  assert.ok(outcome.results.every((result) => result.status === "ok"));
});

test("honors an explicit empty alternatives list (nobody to negotiate)", async () => {
  const ana = callerFor([candidate("ma", "ia", 30)], ["massa"]);
  const bruno = callerFor([candidate("mb", "ib", 25)], []);

  const outcome = await resolveOptionsForPartyWithNegotiation(
    [request("ana", ana), request("bruno", bruno)],
    { alternatives: [] },
  );

  assert.equal(outcome.negotiated, false);
  assert.equal(outcome.theme, "italiano");
});
