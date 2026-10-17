export interface McpTokenSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt?: string;
  scopes?: string[];
}

export class McpSessionRegistry {
  private readonly sessions = new Map<string, Map<string, McpTokenSession>>();

  set(partyId: string, participantId: string, session: McpTokenSession): void {
    if (
      session.accessToken.trim().length === 0 ||
      session.refreshToken.trim().length === 0 ||
      session.accessTokenExpiresAt.trim().length === 0
    ) {
      throw new Error("OAuth token set is incomplete");
    }

    const partySessions =
      this.sessions.get(partyId) ?? new Map<string, McpTokenSession>();
    partySessions.set(participantId, structuredClone(session));
    this.sessions.set(partyId, partySessions);
  }

  get(partyId: string, participantId: string): McpTokenSession | undefined {
    const session = this.sessions.get(partyId)?.get(participantId);
    return session ? structuredClone(session) : undefined;
  }

  deleteParty(partyId: string): void {
    this.sessions.delete(partyId);
  }
}
