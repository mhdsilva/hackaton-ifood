"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyShell } from "@/components/party/party-shell";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { PreparationIllustration } from "@/components/party/preparation-illustration";
import { PreparationTitle } from "@/components/party/preparation-title";
import { SegmentedProgress } from "@/components/party/segmented-progress";
import { useParty } from "@/components/party/party-provider";
import { useSplashComplete } from "@/components/party/splash-intro";
import { getMockPreparationStages, MOCK_PREPARATION_STAGE_MS } from "@/lib/mock-preparation";

const preparationTitles = getMockPreparationStages().map((stage) => stage.title);

export function PreparingScreen() {
  const { snapshot, currentParticipantId, isMock, addressesLoading, resolveOrderOptions } = useParty();
  const participants = snapshot.participants;
  const [stageIndex, setStageIndex] = useState(0);
  const optionsPrefetchedFor = useRef<string | null>(null);
  const stages = getMockPreparationStages();
  const splashComplete = useSplashComplete();
  const router = useRouter();

  useEffect(() => {
    if (isMock || addressesLoading || snapshot.party.status !== "THEME_REVEALED" || !snapshot.party.theme) return;
    const key = `${snapshot.party.id}:${currentParticipantId}`;
    if (optionsPrefetchedFor.current === key) return;
    optionsPrefetchedFor.current = key;
    void resolveOrderOptions().catch(() => {});
  }, [addressesLoading, currentParticipantId, isMock, resolveOrderOptions, snapshot.party.id, snapshot.party.status, snapshot.party.theme]);

  useEffect(() => {
    if (!splashComplete) return;
    const timeout = window.setTimeout(() => {
      if (stageIndex < stages.length - 1) setStageIndex((current) => current + 1);
      else router.replace("/party/countdown");
    }, MOCK_PREPARATION_STAGE_MS);
    return () => window.clearTimeout(timeout);
  }, [stageIndex, splashComplete, router, stages.length]);

  const stage = stages[stageIndex];

  return (
    <PartyShell fitViewport backdrop={<BrandBackdrop />} contentClassName="items-center justify-center text-center">
      <section aria-live="polite" aria-atomic="true" className="w-full space-y-1">
        <p className="text-[11px] leading-normal font-bold text-primary">AS ESCOLHAS SE ENCONTRAM</p>
        <PreparationTitle titles={preparationTitles} current={stageIndex} />
      </section>
      <div className="preparation-orbit-space flex w-full min-h-0 max-h-[326px] flex-1 items-center justify-center [container-type:size]">
        <PreparationIllustration stage={stage} participants={participants} hostId={snapshot.party.hostParticipantId} />
      </div>
      <section aria-label="Progresso da preparação" className="w-full shrink-0 space-y-4 text-preparation-caption">
        <div className="space-y-[10px]">
          <p className="text-[13px] leading-normal font-bold">Preparando a party · {stageIndex + 1} de {stages.length}</p>
          <SegmentedProgress current={stageIndex + 1} total={stages.length} label="Preparação da Party" duration={MOCK_PREPARATION_STAGE_MS} running={splashComplete} />
        </div>
        <PreparationParticipants participants={participants} hostId={snapshot.party.hostParticipantId} centered />
      </section>
    </PartyShell>
  );
}
