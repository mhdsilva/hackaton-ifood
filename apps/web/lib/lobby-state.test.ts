import assert from "node:assert/strict";
import { test } from "node:test";
import { getMockParty } from "./mock-party";
import { getLobbyState } from "./lobby-state";

test("the guest always waits for the named host, even after authenticating", () => {
  const snapshot = getMockParty();
  snapshot.participants.forEach((participant) => { participant.mcpConnectionStatus = "connected"; });
  const guest = snapshot.participants.find((participant) => participant.id !== snapshot.party.hostParticipantId)!;
  const state = getLobbyState(snapshot, guest.id);
  assert.equal(state.buttonLabel, "Aguardando Júlio...");
  assert.equal(state.canContinue, false);
});

test("the host waits for every guest, including pending and failed authentication", () => {
  for (const status of ["not_connected", "validating", "error"] as const) {
    const snapshot = getMockParty();
    snapshot.participants[1].mcpConnectionStatus = status;
    const state = getLobbyState(snapshot, snapshot.party.hostParticipantId);
    assert.equal(state.buttonLabel, "Aguardando autenticação");
    assert.equal(state.canContinue, false);
  }
});

test("start becomes available only with the host and guests authenticated", () => {
  const snapshot = getMockParty();
  snapshot.participants.forEach((participant) => { participant.mcpConnectionStatus = "connected"; });
  const state = getLobbyState(snapshot, snapshot.party.hostParticipantId);
  assert.equal(state.buttonLabel, "Iniciar party");
  assert.equal(state.canContinue, true);
  snapshot.participants[0].mcpConnectionStatus = "not_connected";
  assert.equal(getLobbyState(snapshot, snapshot.party.hostParticipantId).canContinue, false);
});

test("a lone authenticated host waits for another participant", () => {
  const snapshot = getMockParty();
  snapshot.participants = snapshot.participants.slice(0, 1);
  const state = getLobbyState(snapshot, snapshot.party.hostParticipantId);
  assert.equal(state.buttonLabel, "Aguardando participantes");
  assert.equal(state.canContinue, false);
});
