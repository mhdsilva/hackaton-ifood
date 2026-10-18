"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyShell } from "@/components/party/party-shell";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { useParty } from "@/components/party/party-provider";

export function OrderConfirmedScreen() {
  const { snapshot } = useParty();

  return (
    <PartyShell
      fitViewport
      brandTone="light"
      backdrop={<BrandBackdrop />}
      contentClassName="justify-center gap-6 pt-5 pb-10"
      footerClassName="pt-6 pb-[max(24px,env(safe-area-inset-bottom))]"
      footer={<Button asChild size="party" className="w-full"><Link href="/party/retrospective">Ver retrospectiva do pedido</Link></Button>}
    >
      <section aria-labelledby="order-confirmed-title" className="text-center">
        <h1 id="order-confirmed-title" className="font-preparation text-[40px] leading-[1.2] font-bold">Seu pedido<br />foi realizado!</h1>
        <div className="flex h-[min(43cqh,280px)] items-center justify-center">
          <Image src="/figma/reveal-bag.svg" alt="Sacola do iFood" width={262.069} height={280} priority className="h-full w-auto" />
        </div>
      </section>
      <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered caption="connected" />
    </PartyShell>
  );
}
