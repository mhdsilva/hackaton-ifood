import { randomUUID } from "node:crypto";

import type {
  AdvancePartyRequest,
  CreatePartyRequest,
  JoinPartyRequest,
  Participant,
  PartySnapshot,
  PartyStatus,
  PlanPartyRequest,
  SaveAnswersRequest,
  SetOrderStatusRequest,
  SetReadyRequest,
} from "@sidequest/contracts";

import { PartyStore } from "./store.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
    budget: null,
    restrictions: [],
    cartStatus: "pending",
    orderStatus: null,
    total: null,
    etaMinutes: null,
  };
}

export class PartyService {
  constructor(private readonly store: PartyStore) {}

  create(input: CreatePartyRequest): PartySnapshot {
    const hostId = requiredText(input?.host?.id, "host.id");
    const hostName = requiredText(input?.host?.name, "host.name");
    const partyName = requiredText(input?.name, "name");

    const snapshot: PartySnapshot = {
      party: {
        id: randomUUID(),
        code: this.createCode(),
        name: partyName,
        status: "LOBBY",
        hostParticipantId: hostId,
        createdAt: new Date().toISOString(),
      },
      participants: [newParticipant(hostId, hostName)],
      mission: null,
    };

    return this.store.save(snapshot);
  }

  get(idOrCode: string): PartySnapshot {
    const snapshot = this.store.findByIdOrCode(idOrCode);
    if (!snapshot) {
      throw new PartyError(404, "PARTY_NOT_FOUND", "Party not found");
    }

    return snapshot;
  }

  join(idOrCode: string, input: JoinPartyRequest): PartySnapshot {
    const snapshot = this.get(idOrCode);
    this.expectStatus(snapshot, ["LOBBY"]);

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
    return this.store.save(snapshot);
  }

  saveAnswers(idOrCode: string, input: SaveAnswersRequest): PartySnapshot {
    const snapshot = this.get(idOrCode);
    this.expectStatus(snapshot, ["COLLECTING_ANSWERS"]);
    const participant = this.getParticipant(snapshot, input?.participantId);
    const answers = input?.answers;

    if (!answers || typeof answers.budget !== "number" || answers.budget <= 0) {
      throw new PartyError(400, "INVALID_INPUT", "answers.budget must be greater than zero");
    }
    if (!Array.isArray(answers.restrictions)) {
      throw new PartyError(400, "INVALID_INPUT", "answers.restrictions must be an array");
    }

    participant.answers = structuredClone(answers);
    participant.budget = answers.budget;
    participant.restrictions = [...answers.restrictions];
    return this.store.save(snapshot);
  }

  plan(idOrCode: string, input: PlanPartyRequest): PartySnapshot {
    const snapshot = this.get(idOrCode);
    this.expectStatus(snapshot, ["PLANNING"]);

    if (!input?.mission || input.mission.roles.length === 0) {
      throw new PartyError(400, "INVALID_INPUT", "mission with at least one role is required");
    }
    if (!Array.isArray(input.kits)) {
      throw new PartyError(400, "INVALID_INPUT", "kits must be an array");
    }

    const kitsByParticipant = new Map(
      input.kits.map(({ participantId, kit }) => [participantId, kit]),
    );
    const missingKits = snapshot.participants
      .filter((participant) => !kitsByParticipant.has(participant.id))
      .map((participant) => participant.id);

    if (missingKits.length > 0) {
      throw new PartyError(409, "MISSING_KITS", "Every participant needs a resolved kit", {
        participantIds: missingKits,
      });
    }

    for (const participant of snapshot.participants) {
      const kit = kitsByParticipant.get(participant.id)!;
      const resolvedRoles = new Set(kit.items.map((item) => item.role));
      const missingRoles = input.mission.roles.filter((role) => !resolvedRoles.has(role));
      if (missingRoles.length > 0) {
        throw new PartyError(409, "MISSING_ROLES", "Resolved kit does not fulfill the mission", {
          participantId: participant.id,
          roles: missingRoles,
        });
      }

      participant.kit = structuredClone(kit);
      participant.total = kit.total;
      participant.etaMinutes = kit.estimatedDeliveryMinutes;
      participant.cartStatus = "ready";
    }

    snapshot.mission = structuredClone(input.mission);
    snapshot.party.status = "REVIEWING_CARTS";
    return this.store.save(snapshot);
  }

  setReady(idOrCode: string, input: SetReadyRequest): PartySnapshot {
    const snapshot = this.get(idOrCode);
    this.expectStatus(snapshot, ["REVIEWING_CARTS"]);
    const participant = this.getParticipant(snapshot, input?.participantId);

    if (typeof input?.ready !== "boolean") {
      throw new PartyError(400, "INVALID_INPUT", "ready must be a boolean");
    }
    if (!participant.kit) {
      throw new PartyError(409, "KIT_NOT_READY", "Participant does not have a resolved kit");
    }

    participant.cartStatus = input.ready ? "confirmed" : "ready";
    return this.store.save(snapshot);
  }

  setOrderStatus(idOrCode: string, input: SetOrderStatusRequest): PartySnapshot {
    const snapshot = this.get(idOrCode);
    this.expectStatus(snapshot, ["ORDERING", "WAITING_DELIVERIES"]);
    const participant = this.getParticipant(snapshot, input?.participantId);
    const allowed = ["submitted", "confirmed", "preparing", "dispatched", "delivered", "cancelled"];

    if (!allowed.includes(input?.status)) {
      throw new PartyError(400, "INVALID_INPUT", "Unknown order status");
    }

    participant.orderStatus = input.status;
    return this.store.save(snapshot);
  }

  advance(idOrCode: string, input: AdvancePartyRequest = {}): PartySnapshot {
    const snapshot = this.get(idOrCode);
    const nextStatus = this.nextStatus(snapshot);

    if (input.targetStatus && input.targetStatus !== nextStatus) {
      throw new PartyError(409, "INVALID_TRANSITION", "Party can only advance to its next state", {
        currentStatus: snapshot.party.status,
        requestedStatus: input.targetStatus,
        nextStatus,
      });
    }

    snapshot.party.status = nextStatus;
    return this.store.save(snapshot);
  }

  private nextStatus(snapshot: PartySnapshot): PartyStatus {
    switch (snapshot.party.status) {
      case "LOBBY":
        if (snapshot.participants.length < 2) {
          throw new PartyError(409, "NOT_ENOUGH_PARTICIPANTS", "At least two participants are required");
        }
        return "COLLECTING_ANSWERS";
      case "COLLECTING_ANSWERS": {
        const pending = snapshot.participants.filter((participant) => !participant.answers);
        if (pending.length > 0) {
          throw new PartyError(409, "ANSWERS_PENDING", "Every participant must answer first", {
            participantIds: pending.map((participant) => participant.id),
          });
        }
        return "PLANNING";
      }
      case "PLANNING":
        throw new PartyError(409, "PLAN_REQUIRED", "Submit the mission and kits through /plan");
      case "REVIEWING_CARTS": {
        const pending = snapshot.participants.filter(
          (participant) => participant.cartStatus !== "confirmed",
        );
        if (pending.length > 0) {
          throw new PartyError(409, "READY_CHECK_PENDING", "Every participant must confirm their cart", {
            participantIds: pending.map((participant) => participant.id),
          });
        }
        return "ORDERING";
      }
      case "ORDERING": {
        const pending = snapshot.participants.filter((participant) => !participant.orderStatus);
        if (pending.length > 0) {
          throw new PartyError(409, "ORDERS_PENDING", "Every participant must submit their own order", {
            participantIds: pending.map((participant) => participant.id),
          });
        }
        return "WAITING_DELIVERIES";
      }
      case "WAITING_DELIVERIES": {
        const pending = snapshot.participants.filter(
          (participant) => participant.orderStatus !== "delivered",
        );
        if (pending.length > 0) {
          throw new PartyError(409, "DELIVERIES_PENDING", "Every order must be delivered", {
            participantIds: pending.map((participant) => participant.id),
          });
        }
        return "READY_TO_PLAY";
      }
      case "READY_TO_PLAY":
        return "PLAYING";
      case "PLAYING":
        return "COMPLETED";
      case "COMPLETED":
        throw new PartyError(409, "PARTY_COMPLETED", "Party is already completed");
    }
  }

  private getParticipant(snapshot: PartySnapshot, participantId: unknown): Participant {
    const id = requiredText(participantId, "participantId");
    const participant = snapshot.participants.find((candidate) => candidate.id === id);
    if (!participant) {
      throw new PartyError(404, "PARTICIPANT_NOT_FOUND", "Participant not found");
    }

    return participant;
  }

  private expectStatus(snapshot: PartySnapshot, expected: PartyStatus[]): void {
    if (!expected.includes(snapshot.party.status)) {
      throw new PartyError(409, "INVALID_PARTY_STATUS", "Action is not available in the current state", {
        currentStatus: snapshot.party.status,
        expected,
      });
    }
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
