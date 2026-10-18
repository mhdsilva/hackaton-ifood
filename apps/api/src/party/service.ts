import { randomUUID } from "node:crypto";

import type {
  CreatePartyRequest,
  JoinPartyRequest,
  McpConnectionStatus,
  Participant,
  PartyRetrospectiveResponse,
  PartyRetrospectiveSummary,
  PartyOrderStage,
  PartySessionResponse,
  PartySnapshot,
  SubmitAnswersRequest,
} from "@sidequest/contracts";

import { ParticipantAccessStore, type ParticipantActor } from "./access.js";
import { countAnswered, getQuestionnaire, validateAnswers } from "./questionnaire.js";
import { PartyStore } from "./store.js";
import { deriveTheme } from "./theme.js";
import type { ThemePlan, ThemePlanner } from "./theme-plan.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 4;

interface ParticipantRetrospectiveRecord {
  merchantId: string;
  itemCount: number;
  coordinates?: { latitude: number; longitude: number };
}

function distanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const boundedA = Math.min(1, Math.max(0, a));
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
}

function validCoordinates(
  coordinates: { latitude: number; longitude: number } | undefined,
): coordinates is { latitude: number; longitude: number } {
  return Boolean(
    coordinates &&
      Number.isFinite(coordinates.latitude) &&
      coordinates.latitude >= -90 &&
      coordinates.latitude <= 90 &&
      Number.isFinite(coordinates.longitude) &&
      coordinates.longitude >= -180 &&
      coordinates.longitude <= 180,
  );
}

/** Respostas de cada participante, na ordem em que entraram na Party. */
function answersByParticipant(snapshot: PartySnapshot): Record<string, unknown>[] {
  return snapshot.participants
    .map((participant) => participant.questionnaireResponse?.answers)
    .filter((answers): answers is Record<string, unknown> => Boolean(answers));
}

/** Fallback determinístico: respostas mescladas, a última vence por chave. */
function mergedAnswers(snapshot: PartySnapshot): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const participantAnswers of answersByParticipant(snapshot)) {
    Object.assign(answers, participantAnswers);
  }
  return answers;
}

export class PartyError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PartyError";
  }
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PartyError(400, "INVALID_INPUT", `${field} is required`);
  }
  return value.trim();
}

/** Nome opcional (o front não pergunta): o `getUser` do iFood preenche depois do OAuth. */
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function newParticipant(id: string, name: string): Participant {
  return {
    id,
    name,
    questionnaireResponse: null,
    mcpConnectionStatus: "not_connected",
    answeredCount: 0,
  };
}

export class PartyService {
  private readonly retrospectiveRecords = new Map<
    string,
    Map<string, ParticipantRetrospectiveRecord>
  >();

  constructor(
    private readonly store: PartyStore,
    private readonly access: ParticipantAccessStore,
    /** Relógio injetável: a vibe do tema depende do dia da revelação. */
    private readonly now: () => Date = () => new Date(),
    /** Agente que escolhe o tema; ausente = regra determinística de `theme.ts`. */
    private readonly themePlanner?: ThemePlanner,
  ) {}

  create(input: CreatePartyRequest): PartySessionResponse {
    const hostId = requiredText(input?.host?.id, "host.id");
    const hostName = optionalText(input?.host?.name) ?? "Anfitrião";
    const partyName = requiredText(input?.name, "name");
    const partyId = randomUUID();

    const snapshot: PartySnapshot = {
      party: {
        id: partyId,
        code: this.createCode(),
        name: partyName,
        status: "OPEN",
        hostParticipantId: hostId,
        membershipLocked: false,
        createdAt: new Date().toISOString(),
      },
      participants: [newParticipant(hostId, hostName)],
    };

    return {
      party: this.store.save(snapshot),
      participantToken: this.access.issue(partyId, hostId),
    };
  }

  get(idOrCode: string): PartySnapshot {
    const snapshot = this.store.findByIdOrCode(idOrCode);
    if (!snapshot) {
      throw new PartyError(404, "PARTY_NOT_FOUND", "Party not found");
    }
    return snapshot;
  }

  join(idOrCode: string, input: JoinPartyRequest): PartySessionResponse {
    const snapshot = this.get(idOrCode);
    // A entrada fecha quando o resultado está pronto. Durante `COLLECTING_ANSWERS` quem
    // chega atrasado ainda entra e responde — o anfitrião pode ter iniciado com 2 de 4.
    if (
      snapshot.party.status === "READY_FOR_THEME" ||
      snapshot.party.status === "THEME_REVEALED"
    ) {
      throw new PartyError(409, "PARTY_CLOSED", "Party membership is closed");
    }
    if (snapshot.participants.length >= MAX_PARTICIPANTS) {
      throw new PartyError(409, "PARTY_FULL", "Party already has four participants");
    }

    const id = requiredText(input?.participant?.id, "participant.id");
    const guestCount = snapshot.participants.filter(
      (participant) => participant.id !== snapshot.party.hostParticipantId,
    ).length;
    // Sem nome digitado, o rótulo provisório é "Convidado 1", "Convidado 2"… até o getUser.
    const name = optionalText(input?.participant?.name) ?? `Convidado ${guestCount + 1}`;
    if (snapshot.participants.some((participant) => participant.id === id)) {
      throw new PartyError(
        409,
        "PARTICIPANT_ALREADY_JOINED",
        "Participant already joined this Party",
      );
    }

    snapshot.participants.push(newParticipant(id, name));
    return {
      party: this.store.save(snapshot),
      participantToken: this.access.issue(snapshot.party.id, id),
    };
  }

  closeMembership(idOrCode: string, actorToken: string): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const actor = this.authorizeParticipant(idOrCode, actorToken);
    if (actor.participantId !== snapshot.party.hostParticipantId) {
      throw new PartyError(403, "HOST_ONLY", "Only the host can close the Party");
    }
    if (snapshot.party.membershipLocked || snapshot.party.status !== "OPEN") {
      throw new PartyError(409, "PARTY_CLOSED", "Party membership is already closed");
    }
    if (snapshot.participants.length < MIN_PARTICIPANTS) {
      throw new PartyError(
        409,
        "NOT_ENOUGH_PARTICIPANTS",
        "At least two participants are required",
      );
    }

    // Trava do anfitrião: a Party não começa enquanto algum convidado não conectou o iFood.
    // O host é quem inicia, então ele não entra na checagem.
    const pendingGuests = snapshot.participants.filter(
      (participant) =>
        participant.id !== snapshot.party.hostParticipantId &&
        participant.mcpConnectionStatus !== "connected",
    );
    if (pendingGuests.length > 0) {
      throw new PartyError(
        409,
        "GUESTS_NOT_CONNECTED",
        "Aguarde todos os convidados conectarem a conta do iFood antes de iniciar",
        {
          pendingParticipantIds: pendingGuests.map((participant) => participant.id),
          pendingParticipantNames: pendingGuests.map((participant) => participant.name),
        },
      );
    }

    snapshot.party.membershipLocked = true;
    snapshot.party.status = "COLLECTING_ANSWERS";
    return this.store.save(snapshot);
  }

  async revealTheme(idOrCode: string, actorToken: string): Promise<PartySnapshot> {
    const initial = this.get(idOrCode);
    const actor = this.authorizeParticipant(idOrCode, actorToken);
    if (actor.participantId !== initial.party.hostParticipantId) {
      throw new PartyError(403, "HOST_ONLY", "Only the host can reveal the result");
    }
    if (initial.party.status !== "READY_FOR_THEME") {
      throw new PartyError(
        409,
        "NOT_READY_FOR_REVEAL",
        "Party is not ready for the reveal yet",
      );
    }

    // O modelo pode levar alguns segundos; depois dele relê o snapshot para não gravar por cima
    // de uma resposta que tenha chegado nesse meio-tempo.
    const plan = await this.planTheme(answersByParticipant(initial));
    const snapshot = this.get(idOrCode);
    if (snapshot.party.status !== "READY_FOR_THEME") {
      throw new PartyError(
        409,
        "NOT_READY_FOR_REVEAL",
        "Party is not ready for the reveal yet",
      );
    }

    snapshot.party.status = "THEME_REVEALED";
    snapshot.party.theme = plan?.theme ?? deriveTheme(mergedAnswers(snapshot), this.now());
    if (plan?.queries.length) {
      snapshot.party.themeQueries = plan.queries;
    }
    if (plan?.reason) {
      snapshot.party.themeReason = plan.reason;
    }
    return this.store.save(snapshot);
  }

  /** Sem planner, ou se ele falhar, o reveal segue determinístico. */
  private async planTheme(answers: Record<string, unknown>[]): Promise<ThemePlan | undefined> {
    if (!this.themePlanner || answers.length === 0) return undefined;
    try {
      return await this.themePlanner(answers);
    } catch {
      return undefined;
    }
  }

  submitAnswers(
    idOrCode: string,
    actorToken: string,
    input: SubmitAnswersRequest,
  ): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const actor = this.authorizeParticipant(idOrCode, actorToken);
    if (snapshot.party.status === "OPEN") {
      throw new PartyError(409, "QUESTIONNAIRE_NOT_OPEN", "Close membership before answering");
    }

    const questionnaireVersion = requiredText(
      input?.questionnaireVersion,
      "questionnaireVersion",
    );
    const definition = getQuestionnaire(questionnaireVersion);
    if (!definition) {
      throw new PartyError(
        400,
        "QUESTIONNAIRE_VERSION_UNKNOWN",
        `Unknown questionnaire version: ${questionnaireVersion}`,
      );
    }
    if (
      !input?.answers ||
      typeof input.answers !== "object" ||
      Array.isArray(input.answers) ||
      typeof input.completed !== "boolean"
    ) {
      throw new PartyError(
        400,
        "INVALID_INPUT",
        "An answers object and a boolean completed flag are required",
      );
    }

    const answers = input.answers as Record<string, unknown>;
    const issues = validateAnswers(definition, answers, {
      requireComplete: input.completed,
    });
    if (issues.length > 0) {
      throw new PartyError(
        400,
        "INVALID_ANSWERS",
        "Some answers are missing or invalid",
        { issues },
      );
    }

    const participant = snapshot.participants.find(
      (candidate) => candidate.id === actor.participantId,
    );
    if (!participant) {
      throw new PartyError(403, "ACCESS_DENIED", "Token does not identify a participant");
    }

    participant.questionnaireResponse = {
      questionnaireVersion,
      answers: structuredClone(answers),
      completed: input.completed,
      submittedAt: new Date().toISOString(),
    };
    participant.answeredCount = countAnswered(definition, answers);
    this.reconcileStatus(snapshot);
    return this.store.save(snapshot);
  }

  private reconcileStatus(snapshot: PartySnapshot): void {
    if (
      snapshot.party.status === "COLLECTING_ANSWERS" &&
      snapshot.participants.every(
        (participant) => participant.questionnaireResponse?.completed === true,
      )
    ) {
      snapshot.party.status = "READY_FOR_THEME";
    }
  }

  authorizeParticipant(idOrCode: string, token: string): ParticipantActor {
    const snapshot = this.get(idOrCode);
    const actor = this.access.resolve(requiredText(token, "participantToken"));
    if (!actor || actor.partyId !== snapshot.party.id) {
      throw new PartyError(403, "ACCESS_DENIED", "Token does not belong to this Party");
    }
    return actor;
  }

  getSession(idOrCode: string, actorToken: string): Participant {
    const snapshot = this.get(idOrCode);
    const actor = this.authorizeParticipant(idOrCode, actorToken);
    const participant = snapshot.participants.find(
      (candidate) => candidate.id === actor.participantId,
    );
    if (!participant) {
      throw new PartyError(403, "ACCESS_DENIED", "Token does not identify a participant");
    }
    return participant;
  }

  setMcpConnectionStatus(
    idOrCode: string,
    actorToken: string,
    status: McpConnectionStatus,
  ): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const actor = this.authorizeParticipant(idOrCode, actorToken);
    const participant = snapshot.participants.find(
      (candidate) => candidate.id === actor.participantId,
    );
    if (!participant) {
      throw new PartyError(403, "ACCESS_DENIED", "Token does not identify a participant");
    }

    participant.mcpConnectionStatus = status;
    return this.store.save(snapshot);
  }

  setMcpConnectionStatusForParticipant(
    idOrCode: string,
    participantId: string,
    status: McpConnectionStatus,
    /** Nome vindo do `getUser`; substitui o rótulo provisório quando presente. */
    name?: string,
  ): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const participant = snapshot.participants.find(
      (candidate) => candidate.id === participantId,
    );
    if (!participant) {
      throw new PartyError(404, "PARTICIPANT_NOT_FOUND", "Participant not found");
    }

    participant.mcpConnectionStatus = status;
    const profileName = optionalText(name);
    if (profileName) {
      participant.name = profileName.slice(0, 80);
    }
    return this.store.save(snapshot);
  }

  setOrderProgressForParticipant(
    idOrCode: string,
    participantId: string,
    patch: { orderStage?: PartyOrderStage; orderId?: string; orderStatus?: string },
  ): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const participant = snapshot.participants.find(
      (candidate) => candidate.id === participantId,
    );
    if (!participant) {
      throw new PartyError(404, "PARTICIPANT_NOT_FOUND", "Participant not found");
    }

    if (patch.orderStage !== undefined) participant.orderStage = patch.orderStage;
    if (patch.orderId !== undefined) participant.orderId = patch.orderId;
    if (patch.orderStatus !== undefined) participant.orderStatus = patch.orderStatus;
    return this.store.save(snapshot);
  }

  recordCartSummaryForParticipant(
    idOrCode: string,
    participantId: string,
    input: {
      merchantId: string;
      itemCount: number;
      coordinates?: { latitude: number; longitude: number };
    },
  ): void {
    const snapshot = this.get(idOrCode);
    if (!snapshot.participants.some((participant) => participant.id === participantId)) {
      throw new PartyError(404, "PARTICIPANT_NOT_FOUND", "Participant not found");
    }

    const partyRecords = this.recordsForParty(snapshot.party.id);
    partyRecords.set(participantId, {
      merchantId: input.merchantId,
      itemCount: input.itemCount,
      ...(validCoordinates(input.coordinates) ? { coordinates: input.coordinates } : {}),
    });
  }

  getRetrospective(
    idOrCode: string,
    actorToken: string,
  ): PartyRetrospectiveResponse {
    const snapshot = this.get(idOrCode);
    this.authorizeParticipant(idOrCode, actorToken);

    const records = this.recordsForParty(snapshot.party.id);
    // "Pendente" é quem ainda não escolheu/preparou o pedido (sem carrinho registrado);
    // não depende de submeter ou rastrear o pedido até a entrega.
    const pendingDeliveryCount = snapshot.participants.filter(
      (participant) => !records.has(participant.id),
    ).length;
    if (pendingDeliveryCount > 0 || snapshot.party.status !== "THEME_REVEALED") {
      return { state: "waiting_for_deliveries", pendingDeliveryCount };
    }

    const participantRecords = snapshot.participants.map((participant) =>
      records.get(participant.id)!,
    );
    const coordinates = participantRecords.map((record) => record.coordinates);
    let maxDistanceKm: number | undefined;
    if (coordinates.every(validCoordinates)) {
      let maxDistance = 0;
      for (let first = 0; first < coordinates.length; first += 1) {
        for (let second = first + 1; second < coordinates.length; second += 1) {
          maxDistance = Math.max(
            maxDistance,
            distanceKm(coordinates[first], coordinates[second]),
          );
        }
      }
      maxDistanceKm = Math.round(maxDistance * 10) / 10;
    }

    const summary: PartyRetrospectiveSummary = {
      partyName: snapshot.party.name,
      ...(snapshot.party.theme ? { theme: snapshot.party.theme } : {}),
      participantCount: snapshot.participants.length,
      completedOrderCount: participantRecords.length,
      itemCount: participantRecords.reduce((total, record) => total + record.itemCount, 0),
      merchantCount: new Set(participantRecords.map((record) => record.merchantId)).size,
      ...(maxDistanceKm !== undefined ? { maxDistanceKm } : {}),
    };

    return { state: "ready", pendingDeliveryCount: 0, summary };
  }

  private recordsForParty(partyId: string): Map<string, ParticipantRetrospectiveRecord> {
    let records = this.retrospectiveRecords.get(partyId);
    if (!records) {
      records = new Map();
      this.retrospectiveRecords.set(partyId, records);
    }
    return records;
  }

  private createCode(): string {
    for (;;) {
      let code = "";
      for (let index = 0; index < 6; index += 1) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.store.hasCode(code)) return code;
    }
  }
}
