import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_VIBE, deriveTheme, vibeTheme } from "./theme.js";

const SATURDAY = new Date(2026, 9, 17, 12);
const FRIDAY = new Date(2026, 9, 16, 12);
const TUESDAY = new Date(2026, 9, 13, 12);

test("falls back to the day's vibe when there is no context", () => {
  assert.equal(deriveTheme({}, SATURDAY), "sabadou a distancia");
  assert.equal(deriveTheme({}, FRIDAY), "sextou a distancia");
  assert.equal(deriveTheme({}, TUESDAY), DEFAULT_VIBE);
  assert.equal(vibeTheme(SATURDAY), "sabadou a distancia");
});

test("infers the theme from the answers' signals", () => {
  assert.equal(deriveTheme({ energy: "leve-refrescante" }), "saudavel");
  assert.equal(deriveTheme({ cravings: ["fresco"] }), "saudavel");
  assert.equal(deriveTheme({ energy: "intensa-marcante" }), "mexicano");
  assert.equal(deriveTheme({ cravings: ["picante"] }), "mexicano");
  assert.equal(deriveTheme({ "order-style": "sobremesa-bebida" }), "doce");
  assert.equal(deriveTheme({ "order-style": "lanche-simples" }), "hamburguer");
  assert.equal(deriveTheme({ energy: "quente-confortavel" }), "italiano");
  assert.equal(deriveTheme({ "order-style": "refeicao-completa" }), "brasileiro");
  assert.equal(deriveTheme({ energy: "surpreenda" }, SATURDAY), "sabadou a distancia");
});

test("honors an explicit theme over the signals", () => {
  assert.equal(deriveTheme({ theme: "  Italiano " }), "italiano");
  assert.equal(deriveTheme({ theme: "Japones" }), "japones");
  assert.equal(deriveTheme({ theme: "doce", energy: "intensa-marcante" }), "doce");
});
