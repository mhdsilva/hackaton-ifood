import type { Participant } from "@sidequest/contracts";

export function ParticipantList({ participants, hostId, currentParticipantId }: {
  participants: Participant[];
  hostId: string;
  currentParticipantId: string;
}) {
  return (
    <ul>
      {participants.map((participant) => {
        const isHost = participant.id === hostId;
        return (
          <li key={participant.id} className="flex min-h-[62px] items-center gap-3 border-b py-2">
            <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${isHost ? "bg-primary text-primary-foreground" : "bg-foreground text-primary"}`}>
              {participant.name.slice(0, 1).toLocaleUpperCase("pt-BR")}
            </span>
            <span className="min-w-0 flex-1 break-words">{participant.name}{participant.id === currentParticipantId ? " (Você)" : ""}</span>
            {isHost && <span className="rounded-full bg-host-badge px-3 py-1 text-[11px] leading-6 font-medium text-primary">Host</span>}
          </li>
        );
      })}
    </ul>
  );
}
