import type { PartySnapshot } from "@sidequest/contracts";
import fixture from "../../../fixtures/party.json";
import type { PartyAddress } from "@/lib/addresses";

// Cenário visual baseado na fixture compartilhada, com os nomes do Figma.
export function getMockParty(): PartySnapshot {
  return {
    party: { ...fixture.party, name: "Sabadou à distância", status: "OPEN", membershipLocked: false, theme: "Noite Italiana" },
    participants: fixture.participants.slice(0, 2).map((participant, index) => ({
      ...participant,
      name: index === 0 ? "Júlio" : "Lucas",
      questionnaireResponse: null,
      mcpConnectionStatus: index === 0 ? "connected" : "not_connected",
    })),
  };
}

// Entrada simulada: o código da URL não autentica um participante real.
export function getMockPartySession(inviteCode: string | null = null, authenticatedPreview = false) {
  const snapshot = getMockParty();
  if (authenticatedPreview) snapshot.participants.forEach((participant) => { participant.mcpConnectionStatus = "connected"; });
  if (inviteCode) snapshot.party.code = inviteCode;
  const guest = snapshot.participants.find((participant) => participant.id !== snapshot.party.hostParticipantId);
  return {
    snapshot,
    inviteCode,
    authenticatedPreview,
    currentParticipantId: inviteCode && guest ? guest.id : snapshot.party.hostParticipantId,
  };
}

// Modelo de apresentação provisório: não é um contrato de endereço da API.
// Ver `lib/addresses.ts` — o mesmo tipo serve para os endereços reais do iFood.
export function getMockAddresses(): PartyAddress[] {
  return [
    { id: "home", label: "Casa", street: "Rua das Figueiras, 120 · ap. 42", region: "Vila Aurora · São Paulo, SP" },
    { id: "work", label: "Trabalho", street: "Av. Horizonte, 850 · sala 12", region: "Bela Vista · São Paulo, SP" },
  ];
}

export function canStartMockParty(snapshot: PartySnapshot, participantId: string): boolean {
  return snapshot.party.status === "OPEN" && !snapshot.party.membershipLocked &&
    snapshot.party.hostParticipantId === participantId &&
    snapshot.participants.length >= 2 && snapshot.participants.length <= 4 &&
    snapshot.participants.every((participant) => participant.mcpConnectionStatus === "connected");
}
