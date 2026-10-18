import { ParticipantAvatar } from "@/components/party/participant-list";
import type { PreparationParticipant } from "@/lib/mock-preparation";

const participantNames = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

export function PreparationParticipants({ participants, hostId, centered = false }: {
  participants: readonly PreparationParticipant[];
  hostId: string;
  centered?: boolean;
}) {
  return (
    <div className={`space-y-[10px] text-preparation-caption ${centered ? "text-center" : ""}`}>
      <ul aria-label="Participantes conectados na simulação" className={`flex gap-[10px] ${centered ? "justify-center" : ""}`}>
        {participants.map((participant) => <li key={participant.id} aria-label={participant.name}>
          <ParticipantAvatar name={participant.name} isHost={participant.id === hostId} variant="connected" className="size-[42px] text-[16.8px]" />
        </li>)}
      </ul>
      <p className="text-xs leading-4">{participantNames.format(participants.map((participant) => participant.name))} conectados</p>
    </div>
  );
}
