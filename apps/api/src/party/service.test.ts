import assert from "node:assert/strict";
import { test } from "node:test";

import type { SubmitAnswersRequest } from "@sidequest/contracts";

import { ParticipantAccessStore } from "./access.js";
import { PartyError, PartyService } from "./service.js";
import { PartyStore } from "./store.js";

function createService(): PartyService {
  return new PartyService(new PartyStore(), new ParticipantAccessStore());
}

function answers(value: string): SubmitAnswersRequest {
  return {
    questionnaireVersion: "v1",
    answers: { preference: value },
    completed: true,
  };
}

test("creates an open Party and limits membership to four people", () => {
  const service = createService();
  const created = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });

  assert.equal(created.party.party.status, "OPEN");
  assert.notEqual(created.participantToken, "");

  service.join(created.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  service.join(created.party.party.id, {
    participant: { id: "caio", name: "Caio" },
  });
  const joined = service.join(created.party.party.id, {
    participant: { id: "duda", name: "Duda" },
  });

  assert.equal(joined.party.participants.length, 4);
  assert.throws(
    () =>
      service.join(created.party.party.id, {
        participant: { id: "eva", name: "Eva" },
      }),
    (error: unknown) => error instanceof PartyError && error.code === "PARTY_FULL",
  );
});

test("only the host closes membership and nobody joins afterwards", () => {
  const service = createService();
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const guest = service.join(host.party.party.code, {
    participant: { id: "bruno", name: "Bruno" },
  });

  assert.throws(
    () => service.closeMembership(host.party.party.id, guest.participantToken),
    (error: unknown) => error instanceof PartyError && error.code === "HOST_ONLY",
  );

  const closed = service.closeMembership(host.party.party.id, host.participantToken);
  assert.equal(closed.party.status, "COLLECTING_ANSWERS");
  assert.equal(closed.party.membershipLocked, true);
  assert.throws(
    () =>
      service.join(host.party.party.id, {
        participant: { id: "caio", name: "Caio" },
      }),
    (error: unknown) => error instanceof PartyError && error.code === "PARTY_CLOSED",
  );
});

test("answers are isolated by token and the final answer advances the Party", () => {
  const service = createService();
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const foreign = service.create({
    name: "Outra Party",
    host: { id: "intruso", name: "Intruso" },
  });
  service.closeMembership(host.party.party.id, host.participantToken);

  assert.throws(
    () => service.submitAnswers(host.party.party.id, foreign.participantToken, answers("pizza")),
    (error: unknown) => error instanceof PartyError && error.code === "ACCESS_DENIED",
  );

  const afterFirst = service.submitAnswers(
    host.party.party.id,
    host.participantToken,
    answers("massa"),
  );
  assert.equal(afterFirst.party.status, "COLLECTING_ANSWERS");

  const afterLast = service.submitAnswers(
    host.party.party.id,
    guest.participantToken,
    answers("pizza"),
  );
  assert.equal(afterLast.party.status, "READY_FOR_THEME");

  const replacement = { preference: "risoto" };
  const afterReplacement = service.submitAnswers(host.party.party.id, host.participantToken, {
    questionnaireVersion: "v1",
    answers: replacement,
    completed: true,
  });
  assert.equal(afterReplacement.party.status, "READY_FOR_THEME");
  assert.deepEqual(
    afterReplacement.participants.find((participant) => participant.id === "ana")
      ?.questionnaireResponse?.answers,
    replacement,
  );
});
