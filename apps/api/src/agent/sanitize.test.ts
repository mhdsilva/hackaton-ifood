import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeAddress, stripPersonalData } from "./sanitize.js";

test("strips personal data at any depth, keeping the rest", () => {
  const profile = {
    success: true,
    data: {
      name: "Ana Silva",
      email: "ana@example.com",
      phoneNumber: "+55 16 99999-0000",
      cpf: "000.000.000-00",
      preferences: { vegetariano: true, apimentado: "medio" },
      orders: [{ id: "o1", customerName: "Ana" }],
    },
  };

  assert.deepEqual(stripPersonalData(profile), {
    success: true,
    data: {
      preferences: { vegetariano: true, apimentado: "medio" },
      orders: [{ id: "o1" }],
    },
  });
});

test("keeps catalog names while stripping person names", () => {
  assert.deepEqual(
    stripPersonalData({ itemName: "Pizza", merchantName: "Pizzaria X", customerName: "Ana" }),
    { itemName: "Pizza", merchantName: "Pizzaria X" },
  );
});

test("sanitizes an address to a safe label without coordinates", () => {
  assert.deepEqual(
    sanitizeAddress({
      addressId: "a1",
      location: { street: "Rua Privada", number: "44", neighborhood: "Centro", city: "São Carlos", state: "SP" },
      formattedAddress: "Rua Privada, 44, Centro, São Carlos, SP",
      postalCode: "13560000",
      complement: "Apto 12",
      reference: "Portão azul",
      coordinates: { latitude: -22, longitude: -47.9 },
    }),
    { addressId: "a1", label: "Centro, São Carlos", isLastUsedAddress: false },
  );
});
