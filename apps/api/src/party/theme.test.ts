import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveTheme } from "./theme.js";

test("falls back to the demo theme (italiano)", () => {
  assert.equal(deriveTheme({}), "italiano");
  assert.equal(deriveTheme({ energy: "leve-refrescante", cravings: ["fresco"] }), "italiano");
});

test("honors an explicit theme when present", () => {
  assert.equal(deriveTheme({ theme: "  Italiano " }), "italiano");
  assert.equal(deriveTheme({ theme: "Japones" }), "japones");
});
