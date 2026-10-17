import { createHash, randomBytes } from "node:crypto";

export interface ParticipantActor {
  partyId: string;
  participantId: string;
}

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class ParticipantAccessStore {
  private readonly sessions = new Map<string, ParticipantActor>();

  issue(partyId: string, participantId: string): string {
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(digest(token), { partyId, participantId });
    return token;
  }

  resolve(token: string): ParticipantActor | undefined {
    const actor = this.sessions.get(digest(token));
    return actor ? { ...actor } : undefined;
  }
}
