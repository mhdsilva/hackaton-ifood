import Image from "next/image";
import { ParticipantAvatar } from "@/components/party/participant-list";
import type { PreparationParticipant, PreparationStage } from "@/lib/mock-preparation";

const orbitPositions = [
  "top-1/2 -right-3 -translate-y-1/2",
  "-top-[21px] left-1/2 -translate-x-1/2",
  "top-1/2 -left-3 -translate-y-1/2",
  "-bottom-[21px] left-1/2 -translate-x-1/2",
];

export function PreparationIllustration({ stage, participants, hostId }: {
  stage: PreparationStage;
  participants: readonly PreparationParticipant[];
  hostId: string;
}) {
  return (
    <div aria-hidden="true" className="relative flex size-[258px] shrink-0 items-center justify-center rounded-full border">
      <div className="flex size-40 items-center justify-center rounded-full border">
        <Image src={stage.image} alt="" width={stage.width} height={stage.height} loading="eager" className="shrink-0 max-w-none" />
      </div>
      {participants.slice(0, 4).map((participant, index) => <div key={participant.id} className={`absolute ${orbitPositions[index]}`}>
        <ParticipantAvatar name={participant.name} isHost={participant.id === hostId} variant="orbit" className="size-[42px] text-[16.8px]" />
      </div>)}
    </div>
  );
}
