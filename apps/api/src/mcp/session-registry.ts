export class McpSessionRegistry {
  private readonly sessions = new Map<string, Map<string, string>>();

  set(partyId: string, participantId: string, apiKey: string): void {
    if (apiKey.trim().length === 0) {
      throw new Error("API key is required");
    }

    const partySessions = this.sessions.get(partyId) ?? new Map<string, string>();
    partySessions.set(participantId, apiKey);
    this.sessions.set(partyId, partySessions);
  }

  get(partyId: string, participantId: string): string | undefined {
    return this.sessions.get(partyId)?.get(participantId);
  }

  deleteParty(partyId: string): void {
    this.sessions.delete(partyId);
  }
}
