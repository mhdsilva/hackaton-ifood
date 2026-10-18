import assert from "node:assert/strict";
import { test } from "node:test";

import { personalPreferences } from "./preferences.js";

test("turns the participant's own answers into readable preferences", () => {
  const preferences = personalPreferences(
    {
      cravings: ["crocante", "surpreenda"],
      exclusions: ["fritura", "outro"],
      exclusions__other: " sem cebola ",
      restrictions__other: "alergia a kiwi",
      budget: "ate-50",
      address: "casa",
    },
    "v2",
  );
  assert.deepEqual(preferences, {
    cravings: ["Crocante"],
    avoid: ["Fritura"],
    notes: ["alergia a kiwi", "sem cebola"],
  });
});

test("returns nothing when there are no personal preferences", () => {
  assert.equal(personalPreferences(undefined), undefined);
  assert.equal(personalPreferences({ address: "casa", budget: "ate-50" }, "v2"), undefined);
});
