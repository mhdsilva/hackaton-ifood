/**
 * Sincronização do fluxo entre os participantes.
 *
 * Não existe socket nem webhook: cada navegador já consulta `GET /parties/:id` a cada
 * 1,5 s (`live-party-provider.tsx`). O que faltava era **reagir** ao estado da Party —
 * quando o anfitrião inicia, revela o tema etc., os outros navegadores ficavam parados
 * no lobby. Esta função diz para onde cada pessoa deve ir agora.
 */
import type { Participant, PartySnapshot } from "@sidequest/contracts";

/** Telas do questionário, na ordem em que o fluxo as percorre. */
export const QUESTION_PATHS = [
  "/party/address",
  "/party/restrictions",
  "/party/budget",
  "/party/energy",
  "/party/order-style",
  "/party/desires",
  "/party/avoid",
] as const;

const WAITING_PATH = "/party/waiting";
const PREPARING_PATH = "/party/preparing";

function isQuestionPath(pathname: string): boolean {
  return (QUESTION_PATHS as readonly string[]).includes(pathname);
}

/**
 * Convidados que ainda não conectaram a conta do iFood. A Party não começa antes disso
 * (o backend recusa `POST /parties/:id/close` com `409 GUESTS_NOT_CONNECTED`).
 */
export function pendingGuestsWithoutMcp(snapshot: PartySnapshot): Participant[] {
  return snapshot.participants.filter(
    (participant) =>
      participant.id !== snapshot.party.hostParticipantId &&
      participant.mcpConnectionStatus !== "connected",
  );
}

/**
 * O anfitrião só pode iniciar (`close`) com 2–4 pessoas e todos os convidados conectados.
 * Espelha a trava do backend para o botão não ficar habilitado à toa.
 */
export function canStartLiveParty(snapshot: PartySnapshot, participantId: string): boolean {
  return (
    snapshot.party.status === "OPEN" &&
    !snapshot.party.membershipLocked &&
    snapshot.party.hostParticipantId === participantId &&
    snapshot.participants.length >= 2 &&
    snapshot.participants.length <= 4 &&
    pendingGuestsWithoutMcp(snapshot).length === 0
  );
}

/**
 * Destino automático para o estado atual da Party, ou `null` para ficar onde está.
 *
 * - `OPEN`: ninguém é movido; o lobby é o lugar.
 * - `COLLECTING_ANSWERS`: quem estava no lobby entra no questionário; quem já concluiu
 *   vai para a espera (útil também depois de recarregar a página no meio do fluxo).
 * - `READY_FOR_THEME`: todos responderam, então todos esperam o anfitrião revelar.
 * - `THEME_REVEALED`: todos vão para a preparação.
 *
 * Telas fora dessa lista (`/party/pending/*`, a própria espera/preparação) nunca são
 * interrompidas.
 */
export function partyFlowTarget(
  snapshot: PartySnapshot,
  participantId: string,
  pathname: string,
): string | null {
  const status = snapshot.party.status;
  const completed =
    snapshot.participants.find((participant) => participant.id === participantId)
      ?.questionnaireResponse?.completed === true;

  switch (status) {
    case "OPEN":
      return null;
    case "COLLECTING_ANSWERS":
      if (completed && (pathname === "/" || isQuestionPath(pathname))) return WAITING_PATH;
      return pathname === "/" ? QUESTION_PATHS[0] : null;
    case "READY_FOR_THEME":
      return pathname === "/" || isQuestionPath(pathname) ? WAITING_PATH : null;
    case "THEME_REVEALED":
      return pathname === "/" || pathname === WAITING_PATH || isQuestionPath(pathname)
        ? PREPARING_PATH
        : null;
    default:
      return null;
  }
}
