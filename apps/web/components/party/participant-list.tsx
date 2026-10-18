import type { Participant } from "@sidequest/contracts";

export function ParticipantAvatar({ name, isHost }: { name: string; isHost: boolean }) {
  return (
    <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${isHost ? "bg-primary text-primary-foreground" : "bg-foreground text-primary"}`}>
      {name.slice(0, 1).toLocaleUpperCase("pt-BR")}
    </span>
  );
}

export function ParticipantList({ participants, hostId, currentParticipantId, readyParticipantIds }: {
  participants: Participant[];
  hostId: string;
  currentParticipantId: string;
  readyParticipantIds?: readonly string[];
}) {
  return (
    <ul>
      {participants.map((participant) => {
        const isHost = participant.id === hostId;
        return (
          <li key={participant.id} className="flex min-h-[62px] items-center gap-3 border-b py-2">
            <ParticipantAvatar name={participant.name} isHost={isHost} />
            <span className="min-w-0 flex-1 break-words">{participant.name}{participant.id === currentParticipantId ? " (Você)" : ""}</span>
            {readyParticipantIds ? <span className={`rounded-full px-3 py-1 text-[11px] leading-6 font-medium ${readyParticipantIds.includes(participant.id) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {readyParticipantIds.includes(participant.id) ? "Pronto" : "Aguardando..."}
            </span> : isHost && <span className="rounded-full bg-host-badge px-3 py-1 text-[11px] leading-6 font-medium text-primary">Host</span>}
          </li>
        );
      })}
    </ul>
  );
}
