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
      contentClassName="justify-center"
      footerClassName="pt-6 pb-[max(24px,env(safe-area-inset-bottom))]"
      footer={<Button asChild size="party" className="w-full"><Link href="/party/retrospective">Ver retrospectiva</Link></Button>}
    >
      <section aria-labelledby="order-confirmed-title" className="text-center">
        <h1 id="order-confirmed-title" className="party-stage-title font-preparation leading-[1.2] font-bold">Pedido realizado,<br />aproveite com<br />seus amigos!</h1>
        <div className="flex h-[min(39cqh,280px)] items-center justify-center">
          <Image src="/figma/reveal-bag.svg" alt="Sacola do iFood" width={262.069} height={280} priority className="h-full w-auto" />
        </div>
      </section>
      <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered />
    </PartyShell>
  );
}
