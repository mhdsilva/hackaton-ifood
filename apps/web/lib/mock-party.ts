import type { PartySnapshot } from "@sidequest/contracts";
import fixture from "../../../fixtures/party.json";

// Cenário visual baseado na fixture compartilhada, com os nomes do Figma.
export function getMockParty(): PartySnapshot {
  return {
    party: { ...fixture.party, name: "Sabadou à distância", status: "OPEN", membershipLocked: false },
    participants: fixture.participants.slice(0, 2).map((participant, index) => ({
      ...participant,
      name: index === 0 ? "Júlio" : "Lucas",
      questionnaireResponse: null,
      mcpConnectionStatus: "not_connected",
    })),
  };
}

// Modelo de apresentação provisório: não é um contrato de endereço da API.
export interface MockAddress {
  id: string;
  label: string;
  street: string;
  region: string;
}

export function getMockAddresses(): MockAddress[] {
  return [
    { id: "home", label: "Casa", street: "Rua das Figueiras, 120 · ap. 42", region: "Vila Aurora · São Paulo, SP" },
    { id: "work", label: "Trabalho", street: "Av. Horizonte, 850 · sala 12", region: "Bela Vista · São Paulo, SP" },
  ];
}

export function canStartMockParty(snapshot: PartySnapshot, participantId: string): boolean {
  return snapshot.party.status === "OPEN" && !snapshot.party.membershipLocked &&
    snapshot.party.hostParticipantId === participantId &&
    snapshot.participants.length >= 2 && snapshot.participants.length <= 4;
}
