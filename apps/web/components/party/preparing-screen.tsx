"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyHeader } from "@/components/party/party-shell";
import { ParticipantAvatar } from "@/components/party/participant-list";
import { PreparationIllustration } from "@/components/party/preparation-illustration";
import { useSplashComplete } from "@/components/party/splash-intro";
import { getMockPreparationGroup, getMockPreparationStages, MOCK_PREPARATION_STAGE_MS } from "@/lib/mock-preparation";

const participantNames = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

export function PreparingScreen() {
  const [group] = useState(getMockPreparationGroup);
  const [stageIndex, setStageIndex] = useState(0);
  const stages = getMockPreparationStages();
  const splashComplete = useSplashComplete();
  const router = useRouter();

  useEffect(() => {
    if (!splashComplete) return;
    const timeout = window.setTimeout(() => {
      if (stageIndex < stages.length - 1) setStageIndex((current) => current + 1);
      else router.replace("/party/pending/reveal");
    }, MOCK_PREPARATION_STAGE_MS);
    return () => window.clearTimeout(timeout);
  }, [stageIndex, splashComplete, router, stages.length]);

  const stage = stages[stageIndex];

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      <BrandBackdrop />
      <div className="relative"><PartyHeader /></div>
      <main id="main-content" aria-label="Preparação simulada da Party" className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 pt-5 pb-[max(40px,env(safe-area-inset-bottom))]">
        <section aria-live="polite" aria-atomic="true" className="space-y-1">
          <p className="text-[11px] leading-normal font-bold text-primary">AS ESCOLHAS SE ENCONTRAM</p>
          <h1 className="font-preparation text-5xl leading-[1.2] font-bold">{stage.title}</h1>
        </section>
        <div className="flex min-h-[306px] flex-1 items-center justify-center py-6">
          <PreparationIllustration stage={stage} participants={group.participants} hostId={group.hostId} />
        </div>
        <section aria-label="Progresso da preparação" className="space-y-4 text-preparation-caption">
          <div className="space-y-[10px]">
            <p className="text-[13px] leading-normal font-bold">Preparando a party · {stageIndex + 1} de {stages.length}</p>
            <div role="progressbar" aria-label="Preparação simulada" aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={stageIndex + 1} className="flex h-[5px] gap-1">
              {stages.map((item, index) => <span key={item.image} className={`h-full flex-1 rounded-full ${index <= stageIndex ? "bg-primary" : "bg-secondary"}`} />)}
            </div>
          </div>
          <div className="space-y-[10px]">
            <ul aria-label="Participantes conectados na simulação" className="flex gap-[10px]">
              {group.participants.map((participant) => <li key={participant.id} aria-label={participant.name}>
                <ParticipantAvatar name={participant.name} isHost={participant.id === group.hostId} variant="connected" className="size-[42px] text-[16.8px]" />
              </li>)}
            </ul>
            <p className="text-xs leading-normal">{participantNames.format(group.participants.map((participant) => participant.name))} conectados</p>
          </div>
        </section>
      </main>
    </div>
  );
}
