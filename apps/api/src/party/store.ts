import type { PartySnapshot } from "@sidequest/contracts";

export class PartyStore {
  private readonly parties = new Map<string, PartySnapshot>();

  save(snapshot: PartySnapshot): PartySnapshot {
    const saved = structuredClone(snapshot);
    this.parties.set(saved.party.id, saved);
    return structuredClone(saved);
  }

  findByIdOrCode(idOrCode: string): PartySnapshot | undefined {
    const normalized = idOrCode.toUpperCase();
    const party = [...this.parties.values()].find(
      (candidate) =>
        candidate.party.id === idOrCode || candidate.party.code === normalized,
    );

    return party ? structuredClone(party) : undefined;
  }

  hasCode(code: string): boolean {
    return [...this.parties.values()].some(
      (candidate) => candidate.party.code === code,
    );
  }
}
