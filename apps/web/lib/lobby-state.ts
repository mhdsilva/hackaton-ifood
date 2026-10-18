import type { PartySnapshot } from "@sidequest/contracts";
import { canStartLiveParty } from "./party-flow";

export function getLobbyState(snapshot: PartySnapshot, currentParticipantId: string) {
  const isHost = currentParticipantId === snapshot.party.hostParticipantId;
  const host = snapshot.participants.find((participant) => participant.id === snapshot.party.hostParticipantId);
  const me = snapshot.participants.find((participant) => participant.id === currentParticipantId);
  const hasStarted = snapshot.party.status === "COLLECTING_ANSWERS";
  const authenticated = me?.mcpConnectionStatus === "connected";
  const allAuthenticated = snapshot.participants.every((participant) => participant.mcpConnectionStatus === "connected");
  const canStart = authenticated && canStartLiveParty(snapshot, currentParticipantId);
  const canContinue = isHost && (hasStarted || canStart);
  const buttonLabel = !isHost ? `Aguardando ${host?.name ?? "o anfitrião"}...`
    : hasStarted ? "Continuar party"
    : !allAuthenticated ? "Aguardando autenticação"
    : snapshot.participants.length < 2 ? "Aguardando participantes"
    : "Iniciar party";
  return { isHost, host, me, hasStarted, canContinue, buttonLabel };
}
