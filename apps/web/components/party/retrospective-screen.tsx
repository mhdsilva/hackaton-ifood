"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { PartyRetrospectiveResponse } from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyShell } from "@/components/party/party-shell";
import { ParticipantAvatar } from "@/components/party/participant-list";
import { RetrospectiveStats } from "@/components/party/retrospective-stats";
import { RetrospectiveShareDialog } from "@/components/party/retrospective-share-dialog";
import { useParty } from "@/components/party/party-provider";
import { useSplashComplete } from "@/components/party/splash-intro";
import { describeError } from "@/lib/api-client";
import { getMockRetrospective, retrospectiveThemeLabel, type RetrospectivePreview } from "@/lib/mock-retrospective";

const distanceFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
/** Enquanto a Party espera todo mundo escolher o pedido, confere de novo a cada 3s. */
const RETROSPECTIVE_POLL_MS = 3000;

export function RetrospectiveScreen() {
  const { snapshot, isMock, loadRetrospective } = useParty();
  const params = useSearchParams();
  const rawPreview = params.get("preview");
  const preview: RetrospectivePreview = rawPreview === "waiting" || rawPreview === "no-distance" || rawPreview === "empty" ? rawPreview : "ready";
  // `?preview=` força o cenário simulado da vitrine mesmo em modo real; fora dele, o modo
  // real busca a retrospectiva de verdade (baseada no pedido que cada um escolheu).
  const usingPreview = isMock || rawPreview !== null;
  const mockResponse = useMemo(() => getMockRetrospective(snapshot, preview), [snapshot, preview]);
  const [liveResponse, setLiveResponse] = useState<PartyRetrospectiveResponse | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (usingPreview) return;
    let alive = true;
    let timer: number | undefined;
    const tick = () => {
      loadRetrospective()
        .then((result) => {
          if (!alive) return;
          setLiveResponse(result);
          setLiveError(null);
          if (result.state === "waiting_for_deliveries") {
            timer = window.setTimeout(tick, RETROSPECTIVE_POLL_MS);
          }
        })
        .catch((cause: unknown) => {
          if (alive) setLiveError(describeError(cause));
        });
    };
    tick();
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [usingPreview, loadRetrospective]);

  const response = usingPreview ? mockResponse : liveResponse;
  const summary = response?.summary;
  const waiting = response?.state === "waiting_for_deliveries";
  const container = useRef<HTMLDivElement>(null);
  const splashComplete = useSplashComplete();

  useGSAP(() => {
    if (!splashComplete) return;
    const elements = container.current?.querySelectorAll<HTMLElement>("[data-retro-number]");
    const finishNumbers = () => elements?.forEach((element) => {
      const value = Number(element.dataset.retroNumber);
      element.textContent = (element.hasAttribute("data-distance") ? distanceFormat : integerFormat).format(value);
    });
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-retro-reveal]", { y: 20, opacity: 0, duration: 0.65, stagger: 0.09, ease: "power3.out" });
      gsap.fromTo("[data-retro-thread]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.25, delay: 0.3, ease: "power2.inOut" });
      elements?.forEach((element) => {
        const target = Number(element.dataset.retroNumber);
        const counter = { value: 0 };
        gsap.to(counter, { value: target, duration: 1.4, delay: 0.25, ease: "power2.out", onUpdate: () => {
          element.textContent = (element.hasAttribute("data-distance") ? distanceFormat : integerFormat).format(counter.value);
        } });
      });
      return finishNumbers;
    });
    return () => { media.revert(); finishNumbers(); };
  }, { scope: container, dependencies: [splashComplete, preview, summary?.participantCount, summary?.completedOrderCount, summary?.itemCount, summary?.merchantCount, summary?.maxDistanceKm], revertOnUpdate: true });

  if (!usingPreview && liveError) {
    return (
      <PartyShell brandTone="light" backdrop={<BrandBackdrop />} footer={
        <Button asChild variant="ghost" className="w-full text-order-detail"><Link href="/">Voltar para a Party</Link></Button>
      }>
        <p role="alert" className="pt-10 text-center text-sm text-destructive">{liveError}</p>
      </PartyShell>
    );
  }
  if (!usingPreview && response === null) {
    return (
      <PartyShell brandTone="light" backdrop={<BrandBackdrop />} footer={null}>
        <p role="status" className="pt-10 text-center text-muted-foreground">Carregando retrospectiva...</p>
      </PartyShell>
    );
  }

  return (
    <PartyShell brandTone="light" backdrop={<BrandBackdrop />} contentClassName="pt-6 pb-8" footerClassName="space-y-2 pt-4" footer={<>
      {summary && <RetrospectiveShareDialog summary={summary} />}
      <Button asChild variant="ghost" className="w-full text-order-detail"><a href="https://www.ifood.com.br/">Acompanhar pedido</a></Button>
    </>}>
      <div ref={container} className="flex flex-col gap-6">
        <header data-retro-reveal className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-[10px] leading-4 font-bold tracking-[0.08em]">
            <p className="flex items-center gap-2 text-primary"><span className="size-1.5 rounded-full bg-primary" />{waiting ? "A PARTY AINDA ESTÁ ACONTECENDO" : "A RETROSPECTIVA DA PARTY"}</p>
            {usingPreview && <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">PRÉVIA</span>}
          </div>
          <h1 className="font-preparation text-[48px] leading-[1.05] font-bold tracking-[-0.015em]">
            {waiting ? <>A mesa está<br />quase completa.</> : summary ? <>Cada um num canto.<br /><span className="text-primary">Todo mundo junto.</span></> : <>Esse encontro ainda<br />vai virar história.</>}
          </h1>
          <p className="text-sm leading-5 text-order-detail">{waiting ? "A retrospectiva aparece quando todos os pedidos forem concluídos." : summary ? "Os pedidos foram diferentes. O momento foi de vocês." : "Ainda não temos os dados para contar como foi essa Party."}</p>
        </header>

        {summary ? <>
          <section data-retro-reveal aria-labelledby="distance-title" className="relative isolate overflow-hidden rounded-tl-[40px] rounded-tr-xl rounded-br-[40px] rounded-bl-xl bg-primary px-6 pt-5 pb-6 text-primary-foreground">
            <div aria-hidden="true" className="pointer-events-none absolute -top-5 -right-3 -z-10 font-preparation text-[180px] leading-none font-bold text-white/10">&</div>
            <div className="flex items-start justify-between gap-4">
              <p className="max-w-[130px] text-[10px] leading-[14px] font-bold tracking-[0.08em]">LONGE SÓ<br />NO MAPA</p>
              <p className="max-w-[155px] rounded-full border border-white/30 px-3 py-1 text-right text-[10px] leading-[14px] font-bold">{retrospectiveThemeLabel(summary.theme)}</p>
            </div>
            {summary.maxDistanceKm !== undefined ? <>
              <h2 id="distance-title" className="mt-4 flex items-baseline gap-2 font-preparation font-semibold tabular-nums">
                <span className="sr-only">{distanceFormat.format(summary.maxDistanceKm)} quilômetros</span>
                <span aria-hidden="true" data-retro-number={summary.maxDistanceKm} data-distance className="text-[clamp(56px,20vw,80px)] leading-none tracking-[-0.03em]">{distanceFormat.format(summary.maxDistanceKm)}</span><span aria-hidden="true" className="text-[32px]">km</span>
              </h2>
              <p className="mt-1 max-w-[250px] text-sm leading-5">entre os dois pontos mais distantes.<br /><strong>Uma mesma vibe no caminho.</strong></p>
            </> : <>
              <h2 id="distance-title" className="mt-5 font-preparation text-[56px] leading-none font-bold">Vários lugares.<br />Uma mesma vibe.</h2>
              <p className="mt-3 text-xs leading-4 text-white/80">A distância não está disponível nesta Party.</p>
            </>}
            <div aria-hidden="true" className="relative mt-6 flex items-center justify-between px-1">
              <svg viewBox="0 0 300 42" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-[42px] w-full" fill="none"><path data-retro-thread pathLength="1" strokeDasharray="1" d="M20 21C80 -5 220 47 280 21" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" /></svg>
              {snapshot.participants.map((person) => <span key={person.id} className="relative rounded-full border-[5px] border-primary"><ParticipantAvatar name={person.name} isHost={person.id === snapshot.party.hostParticipantId} variant="connected" className={`size-9 text-sm ${person.id === snapshot.party.hostParticipantId ? "bg-background text-foreground" : ""}`} /></span>)}
            </div>
            <p className="mt-2 text-[10px] leading-[14px] text-white/80">{summary.participantCount} pessoas. Uma Party para lembrar.</p>
          </section>

          <section data-retro-reveal aria-labelledby="table-title" className="space-y-3">
            <div className="flex items-center justify-between gap-3"><h2 id="table-title" className="text-sm font-bold">O que chegou à mesa</h2><span className="text-[10px] text-muted-foreground">PARTY CONCLUÍDA</span></div>
            <RetrospectiveStats summary={summary} />
          </section>

          <section data-retro-reveal aria-labelledby="memory-title" className="border-t pt-5">
            <p className="text-[10px] leading-4 font-bold tracking-[0.08em] text-primary">ESSE ENCONTRO TEM NOME</p>
            <h2 id="memory-title" className="mt-1 break-words font-preparation text-[30px] leading-tight font-semibold">{summary.partyName}</h2>
            <p className="mt-2 text-xs leading-5 text-order-detail">Que o próximo pedido seja mais uma desculpa para estar perto.</p>
          </section>
          <p data-retro-reveal className="text-[10px] leading-4 text-muted-foreground">{summary.maxDistanceKm !== undefined ? "A distância é aproximada, em linha reta, e compartilhada apenas como um número do grupo. Os endereços individuais não aparecem aqui. " : "Os endereços individuais não aparecem nesta retrospectiva. "}{usingPreview ? "Dados simulados para esta prévia." : ""}</p>
        </> : <section data-retro-reveal role="status" className="rounded-tl-[40px] rounded-tr-xl rounded-br-[40px] rounded-bl-xl border bg-background/90 p-7">
          <p className="font-preparation text-[80px] leading-none font-semibold text-primary">{waiting ? response?.pendingDeliveryCount : "—"}</p>
          <h2 className="mt-2 text-lg font-bold">{waiting ? response?.pendingDeliveryCount === 1 ? "pedido ainda em andamento" : "pedidos ainda em andamento" : "Retrospectiva indisponível"}</h2>
          <p className="mt-3 text-sm leading-6 text-order-detail">{waiting ? "Cada entrega tem seu tempo. Quando todas forem concluídas, a gente reúne os números desse encontro aqui." : "Volte para a Party para continuar. Assim que o resumo estiver disponível, ele aparece aqui."}</p>
          {usingPreview && <p className="mt-6 text-[10px] text-muted-foreground">Dados simulados para esta prévia.</p>}
        </section>}
      </div>
    </PartyShell>
  );
}
