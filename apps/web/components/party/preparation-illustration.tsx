import Image from "next/image";
import type { CSSProperties } from "react";
import { ParticipantAvatar } from "@/components/party/participant-list";
import type { PreparationParticipant, PreparationStage } from "@/lib/mock-preparation";

/** Centro de cada bola fica na borda do círculo; as bolas se distribuem por igual. */
function orbitPosition(index: number, total: number): CSSProperties {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    left: `${50 + 50 * Math.cos(angle)}%`,
    top: `${50 + 50 * Math.sin(angle)}%`,
    transform: "translate(-50%, -50%)",
  };
}

export function PreparationIllustration({ stage, participants, hostId }: {
  stage: PreparationStage;
  participants: readonly PreparationParticipant[];
  hostId: string;
}) {
  const orbit = participants.slice(0, 4);

  return (
    <div aria-hidden="true" className="preparation-illustration relative flex aspect-square size-[258px] shrink-0 items-center justify-center rounded-full border">
      <div className="absolute size-[62%] rounded-full border" />
      <Image src={stage.image} alt="" width={stage.width} height={stage.height} loading="eager" className="relative h-auto max-h-[80%] w-3/4" />
      <div className="preparation-orbit pointer-events-none absolute inset-0">
        {orbit.map((participant, index) => <div key={participant.id} className="absolute" style={orbitPosition(index, orbit.length)}>
          <div className="preparation-orbit-avatar">
            <ParticipantAvatar name={participant.name} isHost={participant.id === hostId} variant="orbit" className="size-[42px] text-[16.8px]" />
          </div>
        </div>)}
      </div>
    </div>
  );
}
