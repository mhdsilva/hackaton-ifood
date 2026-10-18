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
      brandTone="light"
      backdrop={<BrandBackdrop />}
      contentClassName="min-h-full justify-center gap-6 pt-5 pb-10"
      footerClassName="pt-6 pb-[max(24px,env(safe-area-inset-bottom))]"
      footer={<Button asChild size="party" className="w-full"><Link href="/party/pending/delivery">Acompanhar entrega</Link></Button>}
    >
      <section aria-labelledby="order-confirmed-title" className="text-center">
        <h1 id="order-confirmed-title" className="font-preparation text-5xl leading-[1.2] font-bold">Pedido realizado,<br />aproveite com<br />seus amigos!</h1>
        <div className="flex h-[280px] items-center justify-center">
          <Image src="/figma/reveal-bag.svg" alt="Sacola do iFood" width={262.069} height={280} priority />
        </div>
      </section>
      <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered />
    </PartyShell>
  );
}
