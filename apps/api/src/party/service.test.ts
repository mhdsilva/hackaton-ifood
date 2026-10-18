import assert from "node:assert/strict";
import { test } from "node:test";

import type { SubmitAnswersRequest } from "@sidequest/contracts";

import { ParticipantAccessStore } from "./access.js";
import { PartyError, PartyService } from "./service.js";
import { PartyStore } from "./store.js";

function createService(now?: () => Date): PartyService {
  return new PartyService(new PartyStore(), new ParticipantAccessStore(), now);
}

function answers(value: string): SubmitAnswersRequest {
  return {
    questionnaireVersion: "v1",
    answers: { address: value },
    completed: true,
  };
}

test("v2 cannot mark a participant ready without one or two cravings", () => {
  const service = createService();
  const host = service.create({ name: "Party", host: { id: "ana", name: "Ana" } });
  const partyId = host.party.party.id;
  service.join(partyId, { participant: { id: "bruno", name: "Bruno" } });
  service.closeMembership(partyId, host.participantToken);
  const base = { address: "casa", budget: "ate-50", energy: "leve-refrescante", "order-style": "refeicao-completa" };
  service.submitAnswers(partyId, host.participantToken, { questionnaireVersion: "v2", answers: base, completed: false });

  for (const cravings of [undefined, [], ["crocante", "cremoso", "fresco"]]) {
    assert.throws(() => service.submitAnswers(partyId, host.participantToken, {
      questionnaireVersion: "v2",
      answers: cravings === undefined ? base : { ...base, cravings },
      completed: true,
    }), (error: unknown) => error instanceof PartyError && error.code === "INVALID_ANSWERS");
    const unchanged = service.get(partyId);
    assert.equal(unchanged.party.status, "COLLECTING_ANSWERS");
    assert.equal(unchanged.participants.find((participant) => participant.id === "ana")?.questionnaireResponse?.completed, false);
  }

  for (const cravings of [["crocante"], ["crocante", "cremoso"]]) {
    const saved = service.submitAnswers(partyId, host.participantToken, {
      questionnaireVersion: "v2", answers: { ...base, cravings }, completed: true,
    });
    assert.equal(saved.participants.find((participant) => participant.id === "ana")?.questionnaireResponse?.completed, true);
    assert.equal(saved.party.status, "COLLECTING_ANSWERS");
  }
});

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

  const replacement = { address: "risoto" };
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

test("rejects unknown versions and invalid answers", () => {
  const service = createService();
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  service.join(host.party.party.id, { participant: { id: "bruno", name: "Bruno" } });
  service.closeMembership(host.party.party.id, host.participantToken);
  const partyId = host.party.party.id;

  assert.throws(
    () =>
      service.submitAnswers(partyId, host.participantToken, {
        questionnaireVersion: "v9",
        answers: { address: "casa" },
        completed: true,
      }),
    (error: unknown) =>
      error instanceof PartyError && error.code === "QUESTIONNAIRE_VERSION_UNKNOWN",
  );

  assert.throws(
    () =>
      service.submitAnswers(partyId, host.participantToken, {
        questionnaireVersion: "v1",
        answers: {},
        completed: true,
      }),
    (error: unknown) => error instanceof PartyError && error.code === "INVALID_ANSWERS",
  );

  assert.throws(
    () =>
      service.submitAnswers(partyId, host.participantToken, {
        questionnaireVersion: "v1",
        answers: { address: "casa", restrictions: ["inexistente"] },
        completed: true,
      }),
    (error: unknown) => error instanceof PartyError && error.code === "INVALID_ANSWERS",
  );

  const accepted = service.submitAnswers(partyId, host.participantToken, {
    questionnaireVersion: "v1",
    answers: { address: "casa", restrictions: ["vegetariano"] },
    completed: true,
  });
  assert.deepEqual(
    accepted.participants.find((participant) => participant.id === "ana")
      ?.questionnaireResponse?.answers,
    { address: "casa", restrictions: ["vegetariano"] },
  );
});

test("accepts a draft without advancing and tracks progress", () => {
  const service = createService();
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  service.closeMembership(host.party.party.id, host.participantToken);
  const partyId = host.party.party.id;

  const emptyDraft = service.submitAnswers(partyId, host.participantToken, {
    questionnaireVersion: "v1",
    answers: {},
    completed: false,
  });
  assert.equal(emptyDraft.party.status, "COLLECTING_ANSWERS");
  assert.equal(
    emptyDraft.participants.find((participant) => participant.id === "ana")
      ?.questionnaireResponse?.completed,
    false,
  );
  assert.equal(
    emptyDraft.participants.find((participant) => participant.id === "ana")
      ?.answeredCount,
    0,
  );

  const partial = service.submitAnswers(partyId, host.participantToken, {
    questionnaireVersion: "v1",
    answers: { address: "casa" },
    completed: false,
  });
  assert.equal(
    partial.participants.find((participant) => participant.id === "ana")
      ?.answeredCount,
    1,
  );
  assert.equal(partial.party.status, "COLLECTING_ANSWERS");

  const guestDone = service.submitAnswers(
    partyId,
    guest.participantToken,
    answers("pizza"),
  );
  assert.equal(guestDone.party.status, "COLLECTING_ANSWERS");

  const hostDone = service.submitAnswers(
    partyId,
    host.participantToken,
    answers("massa"),
  );
  assert.equal(hostDone.party.status, "READY_FOR_THEME");
});

test("the host reveals the result only from READY_FOR_THEME", () => {
  const service = createService(() => new Date(2026, 9, 17, 12));
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const partyId = host.party.party.id;
  service.closeMembership(partyId, host.participantToken);

  assert.throws(
    () => service.revealTheme(partyId, host.participantToken),
    (error: unknown) =>
      error instanceof PartyError && error.code === "NOT_READY_FOR_REVEAL",
  );

  service.submitAnswers(partyId, host.participantToken, answers("massa"));
  const ready = service.submitAnswers(partyId, guest.participantToken, answers("pizza"));
  assert.equal(ready.party.status, "READY_FOR_THEME");

  assert.throws(
    () => service.revealTheme(partyId, guest.participantToken),
    (error: unknown) => error instanceof PartyError && error.code === "HOST_ONLY",
  );

  const revealed = service.revealTheme(partyId, host.participantToken);
  assert.equal(revealed.party.status, "THEME_REVEALED");
  assert.equal(revealed.party.theme, "sabadou a distancia");

  assert.throws(
    () => service.revealTheme(partyId, host.participantToken),
    (error: unknown) =>
      error instanceof PartyError && error.code === "NOT_READY_FOR_REVEAL",
  );
});

test("tracks each participant's order progress", () => {
  const service = createService();
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const partyId = host.party.party.id;

  const afterOptions = service.setOrderProgressForParticipant(partyId, "ana", {
    orderStage: "options_ready",
  });
  assert.equal(afterOptions.participants[0]?.orderStage, "options_ready");

  const afterOrder = service.setOrderProgressForParticipant(partyId, "ana", {
    orderStage: "order_submitted",
    orderId: "order-1",
  });
  assert.equal(afterOrder.participants[0]?.orderStage, "order_submitted");
  assert.equal(afterOrder.participants[0]?.orderId, "order-1");

  const afterTrack = service.setOrderProgressForParticipant(partyId, "ana", {
    orderStage: "delivered",
    orderStatus: "CONCLUDED",
  });
  assert.equal(afterTrack.participants[0]?.orderStage, "delivered");
  assert.equal(afterTrack.participants[0]?.orderStatus, "CONCLUDED");

  assert.throws(
    () =>
      service.setOrderProgressForParticipant(partyId, "ghost", {
        orderStage: "none",
      }),
    (error: unknown) =>
      error instanceof PartyError && error.code === "PARTICIPANT_NOT_FOUND",
  );
});
