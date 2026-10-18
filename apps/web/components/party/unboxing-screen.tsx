"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyHeader } from "@/components/party/party-shell";
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
      gsap.set(bag.current, { transformOrigin: "50% 85%" });
      gsap.timeline({ delay: 0.25, repeat: 1, repeatDelay: 0.3 })
        .to(bag.current, { rotation: -7, x: -4, duration: 0.12, ease: "power2.inOut" })
        .to(bag.current, { rotation: 7, x: 4, duration: 0.18, ease: "power2.inOut" })
        .to(bag.current, { rotation: -4, x: -2, duration: 0.12, ease: "power2.inOut" })
        .to(bag.current, { rotation: 3, x: 1, duration: 0.1, ease: "power2.inOut" })
        .to(bag.current, { rotation: 0, x: 0, duration: 0.18, ease: "power2.out" });
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
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      <BrandBackdrop />
      <div className="relative"><PartyHeader brandTone="light" /></div>
      <main id="main-content" className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pt-5 pb-[max(40px,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="unboxing-title" className="text-center">
            <div className="space-y-2">
              <p className="text-[11px] leading-[14px] font-bold text-primary">AS ESCOLHAS SE ENCONTRARAM</p>
              <h1 id="unboxing-title" className="font-preparation text-5xl leading-[1.2] font-bold">E o pedido<br />escolhido para<br />você foi...</h1>
            </div>
            <div className="flex h-[280px] items-center justify-center">
              <div ref={bag}><Image src="/figma/reveal-bag.svg" alt="Sacola surpresa do iFood" width={262.069} height={280} priority /></div>
            </div>
          </section>
          <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered />
        </div>
      </main>
    </div>
  );
}
