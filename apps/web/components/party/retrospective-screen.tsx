"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PartyRetrospectiveSummary } from "@sidequest/contracts";
import { PartyShell } from "@/components/party/party-shell";
import { Button } from "@/components/ui/button";
import { useParty } from "@/components/party/party-provider";

type RetrospectiveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "waiting"; pending: number }
  | { status: "ready"; summary: PartyRetrospectiveSummary };

export function RetrospectiveScreen() {
  const { loadRetrospective, cart } = useParty();
  const [state, setState] = useState<RetrospectiveState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    loadRetrospective()
      .then((result) => {
        if (!alive) return;
        setState(result.state === "ready" && result.summary
          ? { status: "ready", summary: result.summary }
          : { status: "waiting", pending: result.pendingDeliveryCount });
      })
      .catch((cause: unknown) => {
        if (alive) setState({ status: "error", message: cause instanceof Error ? cause.message : "Não foi possível carregar a retrospectiva." });
      });
    return () => { alive = false; };
  }, [loadRetrospective]);

  return (
    <PartyShell
      brandTone="light"
      contentClassName="min-h-full justify-center gap-5 py-8"
      footer={<Button asChild size="party" className="w-full"><Link href="/">Voltar à Party</Link></Button>}
    >
      <section className="space-y-4 text-center" aria-live="polite">
        <p className="text-xs font-bold text-primary">RETROSPECTIVA DA PARTY</p>
        <h1 className="font-preparation text-4xl font-bold">{state.status === "ready" ? "Todo mundo pediu junto!" : "Fechando a retrospectiva..."}</h1>
        {state.status === "loading" && <p className="text-sm text-muted-foreground">Buscando o resumo da Party.</p>}
        {state.status === "waiting" && <p className="text-sm text-muted-foreground">Faltam {state.pending} entregas simuladas para concluir a retrospectiva.</p>}
        {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
        {state.status === "ready" && <>
          <h2 className="text-xl font-semibold">{state.summary.partyName}</h2>
          {state.summary.theme && <p>Tema: {state.summary.theme}</p>}
          <div className="grid grid-cols-2 gap-3 text-left">
            <SummaryCard label="Participantes" value={state.summary.participantCount} />
            <SummaryCard label="Pedidos simulados" value={state.summary.completedOrderCount} />
            <SummaryCard label="Itens" value={state.summary.itemCount} />
            <SummaryCard label="Restaurantes" value={state.summary.merchantCount} />
          </div>
          {state.summary.maxDistanceKm !== undefined && <p className="text-sm text-muted-foreground">Maior distância entre participantes: {state.summary.maxDistanceKm} km</p>}
          <p className="text-xs text-muted-foreground">{cart?.checkoutSimulated ? "Opções e carrinhos consultados no iFood. Pedidos e entregas simulados; nenhuma cobrança foi feita." : "Resumo dos pedidos e entregas da Party."}</p>
        </>}
      </section>
    </PartyShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>;
}
