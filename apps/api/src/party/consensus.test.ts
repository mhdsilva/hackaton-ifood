import assert from "node:assert/strict";
import { test } from "node:test";

import { groupConsensus } from "./consensus.js";

test("keeps only what every participant shares", () => {
  const consensus = groupConsensus([
    { energy: "leve-refrescante", cravings: ["crocante", "picante"] },
    { energy: "leve-refrescante", cravings: ["picante", "fresco"] },
    { energy: "leve-refrescante", cravings: ["picante"] },
  ]);
  assert.deepEqual(consensus, { energy: "leve-refrescante", cravings: ["picante"] });
});

test("a value held by only one participant never becomes theme", () => {
  const consensus = groupConsensus([
    { restrictions: ["veganismo"], energy: "leve-refrescante", cravings: ["crocante"] },
    { restrictions: [], energy: "intensa-marcante", cravings: ["cremoso"] },
  ]);
  assert.deepEqual(consensus, {});
});

test("restrictions, exclusions, budget and free text are always personal", () => {
  const shared = {
    restrictions: ["veganismo"],
    restrictions__other: "sem coentro",
    exclusions: ["fritura"],
    exclusions__other: "sem cebola",
    budget: "ate-50",
    address: "casa",
  };
  assert.deepEqual(groupConsensus([shared, shared]), {});
});

test("'surpreenda' and missing answers decide nothing", () => {
  assert.deepEqual(
    groupConsensus([
      { energy: "surpreenda", cravings: ["surpreenda"] },
      { energy: "surpreenda", cravings: ["surpreenda"] },
    ]),
    {},
  );
  assert.deepEqual(groupConsensus([{ energy: "leve-refrescante" }, {}]), {});
  assert.deepEqual(groupConsensus([]), {});
});
