import assert from "node:assert/strict";
import { test } from "node:test";

import { VIBE_QUERIES, knownThemes, themeQueries } from "./themes.js";

test("maps known themes to their queries", () => {
  assert.deepEqual(themeQueries("Italiano"), ["massa", "pizza", "lasanha"]);
  assert.ok(knownThemes().includes("italiano"));
});

test("maps the vibe to a broad set of queries", () => {
  for (const vibe of ["Sabadou à distância", "sextou a distancia", "a distancia"]) {
    assert.deepEqual(themeQueries(vibe), VIBE_QUERIES);
  }
});

test("an unknown free theme searches for itself", () => {
  assert.deepEqual(themeQueries("comida mineira"), ["comida mineira"]);
  assert.deepEqual(themeQueries(""), []);
});
