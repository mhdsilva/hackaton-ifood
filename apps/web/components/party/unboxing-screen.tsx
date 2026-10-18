"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyShell } from "@/components/party/party-shell";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { useParty } from "@/components/party/party-provider";
import { useSplashComplete } from "@/components/party/splash-intro";

const UNBOXING_DURATION_MS = 2400;

export function UnboxingScreen() {
  const { snapshot } = useParty();
  const bag = useRef<HTMLDivElement>(null);
  const splashComplete = useSplashComplete();
  const router = useRouter();

  useGSAP(() => {
    if (!splashComplete) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline()
        .fromTo(bag.current, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: "power3.out" })
        .to(bag.current, { yPercent: -110, opacity: 0, duration: 0.6, ease: "power3.in" }, "+=1");
    });
    return () => media.revert();
  }, { scope: bag, dependencies: [splashComplete], revertOnUpdate: true });

  useEffect(() => {
    if (!splashComplete) return;
    router.prefetch("/party/order");
    const timer = window.setTimeout(() => router.replace("/party/order"), UNBOXING_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [splashComplete, router]);

  return (
    <PartyShell fitViewport brandTone="light" backdrop={<BrandBackdrop />} contentClassName="justify-center">
      <section aria-labelledby="unboxing-title" className="text-center">
        <div className="space-y-2">
          <p className="text-[11px] leading-[14px] font-bold text-primary">AS ESCOLHAS SE ENCONTRARAM</p>
          <h1 id="unboxing-title" className="font-preparation text-[40px] leading-[1.2] font-bold">E o pedido escolhido<br />para você foi...</h1>
        </div>
        <div className="mx-auto flex h-[min(39cqh,280px)] items-center justify-center overflow-hidden">
          <div ref={bag} className="h-full"><Image src="/figma/reveal-bag.svg" alt="Sacola surpresa do iFood" width={262.069} height={280} priority className="h-full w-auto" /></div>
        </div>
      </section>
      <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered />
    </PartyShell>
  );
}
