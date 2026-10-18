import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPlannerMessages } from "./planner-context.js";
import type { IfoodAddress } from "./types.js";

/** Endereço cru com campos que o modelo NUNCA pode ver (rua, CEP, pessoais). */
const rawAddress = {
  addressId: "addr-1",
  alias: "Casa",
  location: {
    neighborhood: "Centro",
    city: "São Carlos",
    state: "SP",
    street: "Rua das Flores, 123",
    zipCode: "13560-000",
  },
  coordinates: { latitude: -22.01, longitude: -47.89 },
  email: "ana@example.com",
  phone: "+55 16 99999-9999",
} as unknown as IfoodAddress;

test("messages carry the theme, budget, restrictions and safe address labels", () => {
  const messages = buildPlannerMessages({
    theme: "comida de vó",
    budget: 60,
    restrictions: ["vegetariano", "sem pimenta"],
    addresses: [rawAddress],
    maxOptions: 3,
  });

  const text = messages.map((message) => message.content ?? "").join("\n");
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.match(text, /comida de vó/);
  assert.match(text, /R\$ 60\.00/);
  assert.match(text, /VEGETARIAN/);
  assert.match(text, /sem pimenta/);
});

test("messages never leak street, zip, coordinates or personal data", () => {
  const messages = buildPlannerMessages({ theme: "italiano", budget: 50, addresses: [rawAddress] });
  const text = messages.map((message) => message.content ?? "").join("\n");

  assert.doesNotMatch(text, /Rua das Flores/);
  assert.doesNotMatch(text, /13560/);
  assert.doesNotMatch(text, /-22\.01|-47\.89/);
  assert.doesNotMatch(text, /ana@example\.com/);
  assert.doesNotMatch(text, /99999/);
  assert.match(text, /"label":"Casa"/);
});

test("works with no saved address", () => {
  const messages = buildPlannerMessages({ theme: "doce", budget: 30, addresses: [] });
  const text = messages.map((message) => message.content ?? "").join("\n");
  assert.match(text, /Endereços salvos: nenhum/);
});
