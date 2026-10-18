import { randomUUID } from "node:crypto";

import type {
  CreatePartyRequest,
  JoinPartyRequest,
  McpConnectionStatus,
  Participant,
  PartyOrderStage,
  PartySessionResponse,
  PartySnapshot,
  SubmitAnswersRequest,
} from "@sidequest/contracts";

import { ParticipantAccessStore, type ParticipantActor } from "./access.js";
import { countAnswered, getQuestionnaire, validateAnswers } from "./questionnaire.js";
import { PartyStore } from "./store.js";
import { deriveTheme } from "./theme.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 4;

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
  constructor(
    private readonly store: PartyStore,
    private readonly access: ParticipantAccessStore,
    /** Relógio injetável: a vibe do tema depende do dia da revelação. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(input: CreatePartyRequest): PartySessionResponse {
    const hostId = requiredText(input?.host?.id, "host.id");
    const hostName = requiredText(input?.host?.name, "host.name");
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
    if (snapshot.party.membershipLocked || snapshot.party.status !== "OPEN") {
      throw new PartyError(409, "PARTY_CLOSED", "Party membership is closed");
    }
    if (snapshot.participants.length >= MAX_PARTICIPANTS) {
      throw new PartyError(409, "PARTY_FULL", "Party already has four participants");
    }

    const id = requiredText(input?.participant?.id, "participant.id");
    const name = requiredText(input?.participant?.name, "participant.name");
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

    snapshot.party.membershipLocked = true;
    snapshot.party.status = "COLLECTING_ANSWERS";
    return this.store.save(snapshot);
  }

  revealTheme(idOrCode: string, actorToken: string): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const actor = this.authorizeParticipant(idOrCode, actorToken);
    if (actor.participantId !== snapshot.party.hostParticipantId) {
      throw new PartyError(403, "HOST_ONLY", "Only the host can reveal the result");
    }
    if (snapshot.party.status !== "READY_FOR_THEME") {
      throw new PartyError(
        409,
        "NOT_READY_FOR_REVEAL",
        "Party is not ready for the reveal yet",
      );
    }

    snapshot.party.status = "THEME_REVEALED";
    const answers: Record<string, unknown> = {};
    for (const participant of snapshot.participants) {
      if (participant.questionnaireResponse) {
        Object.assign(answers, participant.questionnaireResponse.answers);
      }
    }
    snapshot.party.theme = deriveTheme(answers, this.now());
    return this.store.save(snapshot);
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
  ): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const participant = snapshot.participants.find(
      (candidate) => candidate.id === participantId,
    );
    if (!participant) {
      throw new PartyError(404, "PARTICIPANT_NOT_FOUND", "Participant not found");
    }

    participant.mcpConnectionStatus = status;
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
