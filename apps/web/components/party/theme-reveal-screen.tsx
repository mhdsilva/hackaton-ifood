"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PartyShell } from "@/components/party/party-shell";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { useParty } from "@/components/party/party-provider";
import { getMockRevealTheme } from "@/lib/mock-reveal";
import { revealTheme } from "@/lib/reveal-theme";

export function ThemeRevealScreen() {
  const { snapshot, isMock } = useParty();
  // No modo mock o cenário visual continua italiano; no real, o tema vem do agente.
  const theme = isMock ? getMockRevealTheme() : revealTheme(snapshot.party);
  // Layout de duas linhas sem inventar texto: a primeira palavra fica normal, o resto em destaque.
  const [firstWord, ...restWords] = theme.title.split(/\s+/);
  const restOfTitle = restWords.join(" ");

  return (
    <PartyShell fitViewport tone="celebration" brandTone="inverse" contentClassName="theme-reveal-content justify-center" footerClassName="pt-3 pb-[max(12px,env(safe-area-inset-bottom))]" footer={
      <Button asChild variant="inverse" size="party" className="w-full"><Link href="/party/unboxing">Descobrir meu pedido</Link></Button>
    }>
      <section aria-labelledby="theme-title" className="shrink-0 space-y-1">
        <p className="text-xs leading-4 font-bold">A TEMÁTICA DE VOCÊS É</p>
        <h1 id="theme-title" className="theme-reveal-title font-preparation leading-none font-semibold"><span className="font-normal">{firstWord}</span>{restOfTitle && <><br />{restOfTitle}</>}</h1>
        <p className="text-sm leading-5">{theme.description}</p>
      </section>
      <div className="relative min-h-0 max-h-[245px] flex-1 overflow-hidden rounded-tl-[64px] rounded-br-[64px]">
        <Image src={theme.image} alt="" fill sizes="(max-width: 448px) calc(100vw - 40px), 408px" className="object-cover" priority />
      </div>
      <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} onPrimary />
    </PartyShell>
  );
}
