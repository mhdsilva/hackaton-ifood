import assert from "node:assert/strict";
import { test } from "node:test";

import type { SubmitAnswersRequest } from "@sidequest/contracts";

import { ParticipantAccessStore } from "./access.js";
import { PartyError, PartyService } from "./service.js";
import { PartyStore } from "./store.js";
import type { ThemePlanner } from "./theme-plan.js";

function createService(now?: () => Date, themePlanner?: ThemePlanner): PartyService {
  return new PartyService(new PartyStore(), new ParticipantAccessStore(), now, themePlanner);
}

function answers(value: string): SubmitAnswersRequest {
  return {
    questionnaireVersion: "v1",
    answers: { address: value },
    completed: true,
  };
}

/** Conecta todos os convidados: a Party só fecha depois que eles entram com o iFood. */
function connectGuests(service: PartyService, partyId: string): void {
  const snapshot = service.get(partyId);
  for (const participant of snapshot.participants) {
    if (participant.id !== snapshot.party.hostParticipantId) {
      service.setMcpConnectionStatusForParticipant(partyId, participant.id, "connected");
    }
  }
}

test("v2 cannot mark a participant ready without one or two cravings", () => {
  const service = createService();
  const host = service.create({ name: "Party", host: { id: "ana", name: "Ana" } });
  const partyId = host.party.party.id;
  service.join(partyId, { participant: { id: "bruno", name: "Bruno" } });
  connectGuests(service, partyId);
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

test("only the host closes membership and late joiners still enter during answers", () => {
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

  connectGuests(service, host.party.party.id);
  const closed = service.closeMembership(host.party.party.id, host.participantToken);
  assert.equal(closed.party.status, "COLLECTING_ANSWERS");
  assert.equal(closed.party.membershipLocked, true);

  // Quem chega atrasado ainda entra enquanto as respostas são coletadas.
  const late = service.join(host.party.party.id, {
    participant: { id: "caio", name: "Caio" },
  });
  assert.equal(late.party.party.status, "COLLECTING_ANSWERS");
  assert.equal(late.party.participants.length, 3);
});

test("the host cannot start until every guest connected the iFood", () => {
  const service = createService();
  const host = service.create({ name: "Party", host: { id: "ana", name: "Ana" } });
  const partyId = host.party.party.id;
  service.join(partyId, { participant: { id: "bruno", name: "Bruno" } });
  service.join(partyId, { participant: { id: "caio", name: "Caio" } });

  // Ninguém conectou: o host não inicia e a Party continua OPEN.
  assert.throws(
    () => service.closeMembership(partyId, host.participantToken),
    (error: unknown) => {
      if (!(error instanceof PartyError) || error.code !== "GUESTS_NOT_CONNECTED") return false;
      const pending = error.details?.pendingParticipantIds;
      return Array.isArray(pending) && pending.length === 2;
    },
  );
  assert.equal(service.get(partyId).party.status, "OPEN");

  // Só um convidado conectado ainda não libera.
  service.setMcpConnectionStatusForParticipant(partyId, "bruno", "connected");
  assert.throws(
    () => service.closeMembership(partyId, host.participantToken),
    (error: unknown) => error instanceof PartyError && error.code === "GUESTS_NOT_CONNECTED",
  );

  // Com todos conectados, o host inicia normalmente.
  service.setMcpConnectionStatusForParticipant(partyId, "caio", "connected");
  const closed = service.closeMembership(partyId, host.participantToken);
  assert.equal(closed.party.status, "COLLECTING_ANSWERS");
  assert.equal(closed.party.membershipLocked, true);
});

test("nobody joins after the result is ready or revealed", async () => {
  const service = createService();
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const partyId = host.party.party.id;
  connectGuests(service, partyId);
  service.closeMembership(partyId, host.participantToken);
  service.submitAnswers(partyId, host.participantToken, answers("massa"));
  service.submitAnswers(partyId, guest.participantToken, answers("pizza"));

  assert.throws(
    () => service.join(partyId, { participant: { id: "caio", name: "Caio" } }),
    (error: unknown) => error instanceof PartyError && error.code === "PARTY_CLOSED",
  );

  await service.revealTheme(partyId, host.participantToken);
  assert.throws(
    () => service.join(partyId, { participant: { id: "caio", name: "Caio" } }),
    (error: unknown) => error instanceof PartyError && error.code === "PARTY_CLOSED",
  );
});

test("uses provisional names until the iFood profile fills them", () => {
  const service = createService();
  const host = service.create({ name: "Party", host: { id: "ana" } });
  const partyId = host.party.party.id;
  const first = service.join(partyId, { participant: { id: "bruno" } });
  const second = service.join(partyId, { participant: { id: "caio" } });

  assert.equal(host.party.participants[0].name, "Anfitrião");
  assert.equal(first.party.participants.find((p) => p.id === "bruno")?.name, "Convidado 1");
  assert.equal(second.party.participants.find((p) => p.id === "caio")?.name, "Convidado 2");

  const blank = service.setMcpConnectionStatusForParticipant(
    partyId,
    "bruno",
    "connected",
    "   ",
  );
  assert.equal(blank.participants.find((p) => p.id === "bruno")?.name, "Convidado 1");

  const connected = service.setMcpConnectionStatusForParticipant(
    partyId,
    "bruno",
    "connected",
    "  Bruno Lima ",
  );
  const bruno = connected.participants.find((p) => p.id === "bruno");
  assert.equal(bruno?.name, "Bruno Lima");
  assert.equal(bruno?.mcpConnectionStatus, "connected");
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
  connectGuests(service, host.party.party.id);
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
  connectGuests(service, host.party.party.id);
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
  connectGuests(service, host.party.party.id);
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

test("the host reveals the result only from READY_FOR_THEME", async () => {
  const service = createService(() => new Date(2026, 9, 17, 12));
  const host = service.create({
    name: "Jantar de sexta",
    host: { id: "ana", name: "Ana" },
  });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const partyId = host.party.party.id;
  connectGuests(service, partyId);
  service.closeMembership(partyId, host.participantToken);

  await assert.rejects(
    async () => service.revealTheme(partyId, host.participantToken),
    (error: unknown) =>
      error instanceof PartyError && error.code === "NOT_READY_FOR_REVEAL",
  );

  service.submitAnswers(partyId, host.participantToken, answers("massa"));
  const ready = service.submitAnswers(partyId, guest.participantToken, answers("pizza"));
  assert.equal(ready.party.status, "READY_FOR_THEME");

  await assert.rejects(
    async () => service.revealTheme(partyId, guest.participantToken),
    (error: unknown) => error instanceof PartyError && error.code === "HOST_ONLY",
  );

  const revealed = await service.revealTheme(partyId, host.participantToken);
  assert.equal(revealed.party.status, "THEME_REVEALED");
  assert.equal(revealed.party.theme, "sabadou a distancia");

  await assert.rejects(
    async () => service.revealTheme(partyId, host.participantToken),
    (error: unknown) =>
      error instanceof PartyError && error.code === "NOT_READY_FOR_REVEAL",
  );
});

test("the agent chooses the theme from every participant's answers", async () => {
  const received: Record<string, unknown>[][] = [];
  const service = createService(undefined, async (answersByParticipant) => {
    received.push(answersByParticipant);
    return {
      theme: "Domingo de Massa",
      queries: ["massa", "pizza"],
      reason: "A maioria pediu algo quente.",
    };
  });
  const host = service.create({ name: "Party", host: { id: "ana", name: "Ana" } });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const partyId = host.party.party.id;
  connectGuests(service, partyId);
  service.closeMembership(partyId, host.participantToken);
  service.submitAnswers(partyId, host.participantToken, answers("massa"));
  service.submitAnswers(partyId, guest.participantToken, answers("pizza"));

  const revealed = await service.revealTheme(partyId, host.participantToken);

  assert.equal(revealed.party.theme, "Domingo de Massa");
  assert.deepEqual(revealed.party.themeQueries, ["massa", "pizza"]);
  assert.equal(revealed.party.themeReason, "A maioria pediu algo quente.");
  assert.equal(received.length, 1);
  assert.equal(received[0].length, 2, "uma entrada por participante, não o objeto mesclado");
});

test("a failing agent falls back to the deterministic theme", async () => {
  const service = createService(() => new Date(2026, 9, 17, 12), async () => {
    throw new Error("LLM indisponível");
  });
  const host = service.create({ name: "Party", host: { id: "ana", name: "Ana" } });
  const guest = service.join(host.party.party.id, {
    participant: { id: "bruno", name: "Bruno" },
  });
  const partyId = host.party.party.id;
  connectGuests(service, partyId);
  service.closeMembership(partyId, host.participantToken);
  service.submitAnswers(partyId, host.participantToken, answers("massa"));
  service.submitAnswers(partyId, guest.participantToken, answers("pizza"));

  const revealed = await service.revealTheme(partyId, host.participantToken);

  assert.equal(revealed.party.status, "THEME_REVEALED");
  assert.equal(revealed.party.theme, "sabadou a distancia");
  assert.equal(revealed.party.themeQueries, undefined);
  assert.equal(revealed.party.themeReason, undefined);
});

test("the retrospective is ready once every participant has a cart, no delivery required", async () => {
  const service = createService(() => new Date(2026, 9, 17, 12));
  const host = service.create({ name: "Jantar de sexta", host: { id: "ana", name: "Ana" } });
  const guest = service.join(host.party.party.id, { participant: { id: "bruno", name: "Bruno" } });
  const partyId = host.party.party.id;
  connectGuests(service, partyId);
  service.closeMembership(partyId, host.participantToken);
  service.submitAnswers(partyId, host.participantToken, answers("massa"));
  service.submitAnswers(partyId, guest.participantToken, answers("pizza"));
  await service.revealTheme(partyId, host.participantToken);

  const waiting = service.getRetrospective(partyId, host.participantToken);
  assert.equal(waiting.state, "waiting_for_deliveries");
  assert.equal(waiting.pendingDeliveryCount, 2);

  service.recordCartSummaryForParticipant(partyId, "ana", { merchantId: "m1", itemCount: 2 });
  const halfway = service.getRetrospective(partyId, host.participantToken);
  assert.equal(halfway.state, "waiting_for_deliveries");
  assert.equal(halfway.pendingDeliveryCount, 1);

  // Nenhum participante tem orderStatus/orderId: ninguém submeteu ou rastreou o pedido.
  service.recordCartSummaryForParticipant(partyId, "bruno", { merchantId: "m2", itemCount: 1 });
  const ready = service.getRetrospective(partyId, host.participantToken);
  assert.equal(ready.state, "ready");
  assert.equal(ready.pendingDeliveryCount, 0);
  assert.equal(ready.summary?.completedOrderCount, 2);
  assert.equal(ready.summary?.itemCount, 3);
  assert.equal(ready.summary?.merchantCount, 2);
  assert.equal(ready.summary?.participantCount, 2);
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
