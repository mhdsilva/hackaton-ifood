"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LocalOption } from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { OrderDetailCard } from "@/components/party/order-detail-card";
import { PartyShell } from "@/components/party/party-shell";
import { useParty } from "@/components/party/party-provider";
import { describeError, LiveApiError } from "@/lib/api-client";
import { getMockRevealedOrder } from "@/lib/mock-reveal";
import { revealTheme } from "@/lib/reveal-theme";
import { addressDetailLines, selectedPartyAddress } from "@/lib/addresses";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const rating = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type OrderState =
  | { status: "loading" }
  | { status: "error"; message: string; canConnect: boolean }
  | { status: "ready"; options: LocalOption[] };

function distanceLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

function OrderItem({ name, detail, price }: { name: string; detail?: string; price: number }) {
  const complement = detail?.trim();
  return (
    <li className="flex h-[60px] items-center gap-3 border-b py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary"><Image src="/figma/order-basket.svg" alt="" width={16} height={16} /></span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate text-sm leading-[1.35] font-bold">{name}</h2>
          {complement && <p className="truncate text-xs leading-[1.35] text-order-detail">{complement}</p>}
        </div>
        <p className="shrink-0 text-sm leading-[1.35] font-bold">{currency.format(price)}</p>
      </div>
    </li>
  );
}

export function OrderSummaryScreen() {
  const router = useRouter();
  const {
    snapshot,
    currentParticipantId,
    isMock,
    resolveOrderOptions,
    connectMcp,
    connectingMcp,
    addressesLoading,
    addresses,
    addressesLive,
    selectedAddressId,
    prepareOrderCart,
  } = useParty();
  const [order, setOrder] = useState<OrderState>({ status: "loading" });
  const [optionIndex, setOptionIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [preparingCart, setPreparingCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // O snapshot é atualizado pelo polling; o ref evita refazer a busca a cada 1,5 s.
  const resolveRef = useRef(resolveOrderOptions);
  useEffect(() => {
    resolveRef.current = resolveOrderOptions;
  }, [resolveOrderOptions]);
  const theme = snapshot.party.theme ?? "";
  const themeCopy = revealTheme(snapshot.party);

  useEffect(() => {
    if (isMock || addressesLoading) return;
    let alive = true;
    resolveRef
      .current(reloadKey > 0)
      .then((options) => {
        if (alive) setOrder({ status: "ready", options });
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        setOrder({
          status: "error",
          message: describeError(cause),
          canConnect: cause instanceof LiveApiError && cause.code === "MCP_NOT_CONNECTED",
        });
      });
    return () => {
      alive = false;
    };
  }, [isMock, addressesLoading, currentParticipantId, theme, reloadKey]);

  if (isMock) {
    const mock = getMockRevealedOrder();
    return (
      <PartyShell brandTone="light" contentClassName="gap-4 pt-3" footerClassName="space-y-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]" footer={<>
        <Button asChild size="party" className="w-full"><Link href="/party/confirmed">Processar Pedido</Link></Button>
        <Button asChild variant="secondary" size="party" className="w-full text-primary"><Link href="/party/pending/alternative">Gerar outra opção</Link></Button>
      </>}>
        <section aria-labelledby="order-title" className="space-y-1">
          <p className="text-[11px] leading-[14px] font-bold text-primary">SEU PEDIDO PARA O TEMA</p>
          <h1 id="order-title" className="font-preparation text-[40px] leading-[1.2] font-bold">{mock.theme}</h1>
          <p className="flex items-center gap-1 text-muted-foreground"><span className="text-xs">★ {mock.rating}</span><span className="text-[13px] leading-[1.35]">{mock.merchant}</span></p>
        </section>
        <ul aria-label="Itens do pedido">
          {mock.items.map((item) => <OrderItem key={item.id} name={item.name} detail={item.description} price={item.price} />)}
        </ul>
        <section aria-label="Total do pedido" className="space-y-2 leading-[1.35]">
          <div className="flex items-center justify-between gap-3 text-2xl font-bold"><h2>Total do pedido</h2><p className="shrink-0">{currency.format(mock.total)}</p></div>
          <p className="text-xs text-muted-foreground">Esse valor considera o frete, taxas e seus cupons disponíveis</p>
        </section>
        <OrderDetailCard icon="/figma/order-motorbike.svg" title="Entrega hoje" detail={mock.delivery} />
        <OrderDetailCard icon="/figma/order-map-pin.svg" title={mock.address} detail={mock.complement} />
        <OrderDetailCard icon="/figma/order-wallet.svg" title="Método de Pagamento" detail="Pix" />
      </PartyShell>
    );
  }

  if (order.status === "loading") {
    return (
      <PartyShell brandTone="light" contentClassName="min-h-full justify-center gap-6 pt-5 pb-10" footer={<Button size="party" className="w-full" disabled>Buscando opções...</Button>}>
        <section role="status" aria-live="polite" className="space-y-4 text-center">
          <p className="text-[11px] leading-[14px] font-bold text-primary">SEU PEDIDO PARA O TEMA</p>
          <h1 className="font-preparation text-[40px] leading-[1.2] font-bold">{themeCopy.title}</h1>
          <span aria-hidden="true" className="mx-auto block size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm leading-[1.35] text-muted-foreground">
            Procurando no iFood lojas que combinem com o tema, o seu orçamento e as suas restrições...
          </p>
        </section>
      </PartyShell>
    );
  }

  if (order.status === "error") {
    return (
      <PartyShell brandTone="light" contentClassName="min-h-full justify-center gap-6 pt-5 pb-10" footerClassName="space-y-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]" footer={<>
        {order.canConnect ? (
          <Button size="party" className="w-full" onClick={() => void connectMcp()} disabled={connectingMcp}>
            {connectingMcp ? "Conectando..." : "Conectar iFood"}
          </Button>
        ) : null}
        <Button size="party" variant={order.canConnect ? "secondary" : "default"} className="w-full" onClick={() => {
          setOrder({ status: "loading" });
          setOptionIndex(0);
          setReloadKey((value) => value + 1);
        }}>
          Tentar de novo
        </Button>
        <Button asChild variant="link" className="w-full"><Link href="/party/reveal">Voltar ao tema</Link></Button>
      </>}>
        <section role="alert" className="space-y-3 text-center">
          <p className="text-[11px] leading-[14px] font-bold text-primary">SEU PEDIDO PARA O TEMA</p>
          <h1 className="font-preparation text-[40px] leading-[1.2] font-bold">Não deu para buscar agora</h1>
          <p className="text-sm leading-[1.35] text-muted-foreground">
            O iFood não devolveu uma opção para este tema e este orçamento.
          </p>
          <p className="break-words text-xs leading-[1.35] text-muted-foreground">{order.message}</p>
        </section>
      </PartyShell>
    );
  }

  const options = order.options;
  const option = options[optionIndex % options.length];
  if (!option) {
    // Só acontece se a API devolver uma lista vazia; o provider já converte isso em erro.
    return null;
  }
  const themeAddress = (() => {
    if (!addressesLive) return undefined;
    const me = snapshot.participants.find((participant) => participant.id === currentParticipantId);
    return selectedPartyAddress(addresses, selectedAddressId, me?.questionnaireResponse?.answers.address);
  })();
  const delivery = option.estimatedDeliveryMinutes.max > 0
    ? `Hoje, ${option.estimatedDeliveryMinutes.min} - ${option.estimatedDeliveryMinutes.max} min`
    : "Hoje";

  return (
    <PartyShell brandTone="light" contentClassName="gap-4 pt-3" footerClassName="space-y-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]" footer={<>
      <Button size="party" className="w-full" disabled={preparingCart} onClick={async () => {
        setPreparingCart(true);
        setCartError(null);
        try {
          await prepareOrderCart(option);
          router.push("/party/confirmed");
        } catch (cause) {
          setCartError(describeError(cause));
          setPreparingCart(false);
        }
      }}>{preparingCart ? "Processando pedido..." : "Processar Pedido"}</Button>
      {options.length > 1 && (
        <Button type="button" variant="secondary" size="party" className="w-full text-primary" onClick={() => setOptionIndex((index) => index + 1)}>
          Gerar outra opção
        </Button>
      )}
    </>}>
      <section aria-labelledby="order-title" className="space-y-1">
        <p className="text-[11px] leading-[14px] font-bold text-primary">SEU PEDIDO PARA O TEMA</p>
        <h1 id="order-title" className="font-preparation text-[40px] leading-[1.2] font-bold">{themeCopy.title}</h1>
        <p className="flex items-center gap-1 text-muted-foreground">
          {option.merchant.rating !== undefined && <span className="text-xs">★ {rating.format(option.merchant.rating)}</span>}
          <span className="text-[13px] leading-[1.35]">{option.merchant.name}</span>
          <span className="text-[11px] leading-[1.35] text-order-detail">· {distanceLabel(option.merchant.distanceKm)}</span>
        </p>
      </section>
      <ul aria-label="Itens do pedido">
        {option.items.map((item) => {
          const detail = item.selectedOptions.map((selected) => selected.name).join(" · ");
          return (
            <OrderItem key={`${item.itemId}-${detail}`} name={`${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name}`} detail={detail} price={item.unitPrice * item.quantity} />
          );
        })}
      </ul>
      <section aria-label="Total do pedido" className="space-y-2 leading-[1.35]">
        <div className="flex items-center justify-between gap-3 text-2xl font-bold"><h2>Total do pedido</h2><p className="shrink-0">{currency.format(option.total)}</p></div>
        <p className="text-xs text-muted-foreground">Valor estimado com frete. O checkout desta demonstração não cobra nada.</p>
      </section>
      <OrderDetailCard icon="/figma/order-motorbike.svg" title="Entrega hoje" detail={delivery} />
      <OrderDetailCard
        icon="/figma/order-map-pin.svg"
        title={themeAddress?.label ?? "Endereço de entrega"}
        detail={themeAddress ? addressDetailLines(themeAddress).join("\n") || "Endereço cadastrado no iFood" : "Endereço cadastrado no iFood"}
      />
      <OrderDetailCard icon="/figma/order-wallet.svg" title="Método de Pagamento" detail="Pix" />
      {cartError && <p role="alert" className="text-center text-xs text-destructive">{cartError}</p>}
      <p className="text-center text-xs text-muted-foreground">O checkout desta demonstração é simulado. Nenhum pedido será enviado nem cobrado.</p>
    </PartyShell>
  );
}
