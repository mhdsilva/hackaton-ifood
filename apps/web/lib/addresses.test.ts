import assert from "node:assert/strict";
import { test } from "node:test";
import { addressDetailLines, fromParticipantAddress, selectedPartyAddress } from "./addresses";

test("preserves street, number, complement, region, postal code and reference for both screens", () => {
  const address = fromParticipantAddress({ addressId: "home", label: "Casa", isLastUsedAddress: true, details: {
    street: "Rua X", number: "44", neighborhood: "Centro", city: "São Carlos", state: "SP",
    postalCode: "13560000", complement: "Apto 12", reference: "Portão azul",
  } });
  assert.deepEqual(addressDetailLines(address), ["Rua X, 44", "Apto 12", "Centro · São Carlos, SP · CEP 13560-000", "Referência: Portão azul"]);
});

test("accepts legacy responses and uses the complete formatted address when components are absent", () => {
  assert.deepEqual(addressDetailLines(fromParticipantAddress({ addressId: "old", label: "Casa", isLastUsedAddress: false })), []);
  assert.deepEqual(addressDetailLines(fromParticipantAddress({ addressId: "new", label: "Casa", isLastUsedAddress: false, details: {
    formattedAddress: "Rua X, 44, Apto 12, São Carlos, SP", complement: "Apto 12", postalCode: "13560000",
  } })), ["Rua X, 44, Apto 12, São Carlos, SP", "CEP 13560-000"]);
});

test("keeps the selected address id when multiple saved addresses have the same label", () => {
  const addresses = [{ id: "old", label: "Casa" }, { id: "chosen", label: "Casa" }];
  assert.equal(selectedPartyAddress(addresses, "chosen", "Casa")?.id, "chosen");
});
