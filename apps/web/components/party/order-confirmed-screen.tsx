"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandBackdrop } from "@/components/party/brand-backdrop";
import { PartyShell } from "@/components/party/party-shell";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { useParty } from "@/components/party/party-provider";

export function OrderConfirmedScreen() {
  const router = useRouter();
  const { snapshot, isMock, cart, submitPartyOrder } = useParty();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutSimulated = cart?.checkoutSimulated === true;

  if (!isMock) {
    return (
      <PartyShell
        brandTone="light"
        backdrop={<BrandBackdrop />}
        contentClassName="min-h-full justify-center gap-6 pt-5 pb-10"
        footerClassName="space-y-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]"
        footer={<>
          {cart ? <Button size="party" className="w-full" disabled={submitting} onClick={async () => {
            setSubmitting(true);
            setError(null);
            try {
              await submitPartyOrder(cart.cartId);
              router.push("/party/pending/delivery");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Não foi possível continuar a demonstração.");
              setSubmitting(false);
            }
          }}>{submitting ? "Processando..." : checkoutSimulated ? "Continuar demonstração" : "Enviar pedido ao iFood"}</Button> : (
            <Button asChild size="party" className="w-full"><Link href="/party/order">Voltar ao pedido</Link></Button>
          )}
          <p className="text-center text-xs text-muted-foreground">{checkoutSimulated ? "Pedido e entrega simulados. Nada será enviado ao restaurante nem cobrado." : "Ao continuar, o pedido será enviado ao restaurante pelo iFood."}</p>
          {error && <p role="alert" className="text-center text-xs text-destructive">{error}</p>}
        </>}
      >
        <section aria-labelledby="order-confirmed-title" className="text-center">
          <p className="mb-2 text-xs font-bold text-primary">{checkoutSimulated ? "PEDIDO PREPARADO · CHECKOUT SIMULADO" : "CARRINHO PRONTO"}</p>
          <h1 id="order-confirmed-title" className="font-preparation text-5xl leading-[1.2] font-bold">{checkoutSimulated ? <>Pedido pronto,<br />vamos continuar<br />a demonstração!</> : <>Carrinho pronto,<br />confirme seu<br />pedido no iFood.</>}</h1>
          <div className="flex h-[280px] items-center justify-center">
            <Image src="/figma/reveal-bag.svg" alt="Sacola do iFood" width={262.069} height={280} priority />
          </div>
          {cart?.total !== undefined && <p className="text-lg font-bold">{checkoutSimulated ? "Total estimado" : "Total do carrinho"}: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cart.total)}</p>}
          {cart && !checkoutSimulated && <p className="text-sm text-muted-foreground">Pagamento configurado: {cart.paymentMethod}</p>}
        </section>
        <PreparationParticipants participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} centered />
      </PartyShell>
    );
  }

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
