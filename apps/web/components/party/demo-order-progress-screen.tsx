"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PartyShell } from "@/components/party/party-shell";
import { Button } from "@/components/ui/button";
import { useParty } from "@/components/party/party-provider";

interface TrackingView {
  description: string;
  statusCode: string;
  simulated: boolean;
}

export function DemoOrderProgressScreen() {
  const router = useRouter();
  const { snapshot, currentParticipantId, trackPartyOrder, loadRetrospective } = useParty();
  const orderId = snapshot.participants.find((participant) => participant.id === currentParticipantId)?.orderId;
  const [tracking, setTracking] = useState<TrackingView | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const next = await trackPartyOrder(orderId);
        if (!alive) return;
        setTracking(next);
        if (next.terminal) {
          const retrospective = await loadRetrospective();
          if (!alive) return;
          if (retrospective.state === "ready") {
            router.replace("/party/retrospective");
            return;
          }
          setPending(retrospective.pendingDeliveryCount);
        }
        timer = setTimeout(tick, Math.max(1, next.retryAfterSeconds ?? 3) * 1000);
      } catch (cause) {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a demonstração.");
        timer = setTimeout(tick, 3000);
      }
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, loadRetrospective, router, trackPartyOrder]);

  return (
    <PartyShell
      backHref="/party/confirmed"
      contentClassName="min-h-full justify-center gap-5 py-8"
      footer={<Button asChild size="party" className="w-full"><Link href="/party/order">Voltar ao pedido</Link></Button>}
    >
      <section className="space-y-3 text-center" aria-live="polite">
        <p className="text-xs font-bold text-primary">ENTREGA DE DEMONSTRAÇÃO</p>
        <h1 className="font-preparation text-4xl font-bold">Acompanhe a Party</h1>
        {!orderId ? (
          <p className="text-sm text-muted-foreground">Monte o carrinho e continue a demonstração para iniciar o rastreio.</p>
        ) : (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-3xl" aria-hidden="true">{tracking?.statusCode === "CONCLUDED" ? "✓" : "⌛"}</div>
            <p className="text-lg font-semibold">{tracking?.description ?? "Iniciando pedido simulado..."}</p>
            <p className="text-xs text-muted-foreground">{tracking?.simulated ? "O pedido não foi enviado ao restaurante. A retrospectiva abre quando todos concluírem a simulação." : "Pedido enviado ao restaurante. A retrospectiva abre quando todas as entregas forem concluídas."}</p>
            {pending !== null && pending > 0 && <p className="text-sm">Aguardando mais {pending} {pending === 1 ? "participante" : "participantes"}.</p>}
          </>
        )}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </section>
    </PartyShell>
  );
}
