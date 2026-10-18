"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyShell } from "@/components/party/party-shell";
import { FlipDigit } from "@/components/party/flip-digit";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { useParty } from "@/components/party/party-provider";
import { useSplashComplete } from "@/components/party/splash-intro";

export function CountdownScreen() {
  const { snapshot } = useParty();
  const [count, setCount] = useState(3);
  const splashComplete = useSplashComplete();
  const router = useRouter();

  useEffect(() => {
    if (!splashComplete) return;
    const timer = window.setTimeout(() => {
      if (count > 1) setCount((current) => current - 1);
      else router.replace("/party/reveal");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [count, splashComplete, router]);

  return (
    <PartyShell fitViewport brandTone="light" backdrop={<BrandBackdrop />} contentClassName="justify-center">
      <section aria-labelledby="countdown-title" className="text-center">
        <div className="space-y-2">
          <p className="text-[11px] leading-[14px] font-bold text-primary">AS ESCOLHAS SE ENCONTRARAM</p>
          <h1 id="countdown-title" className="party-stage-title font-preparation leading-[1.2] font-bold">Todo mundo<br />pronto?</h1>
        </div>
        <div role="timer" aria-live="polite" aria-atomic="true">
          <span className="sr-only">{count}</span>
          <FlipDigit value={count} previous={count === 3 ? 3 : count + 1} />
        </div>
      </section>
      <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered />
    </PartyShell>
  );
}
