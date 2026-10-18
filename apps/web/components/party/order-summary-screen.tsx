import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OrderDetailCard } from "@/components/party/order-detail-card";
import { PartyShell } from "@/components/party/party-shell";
import { getMockRevealedOrder } from "@/lib/mock-reveal";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function OrderSummaryScreen() {
  const order = getMockRevealedOrder();
  return (
    <PartyShell brandTone="light" contentClassName="gap-4 pt-3" footerClassName="space-y-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]" footer={<>
      <Button asChild size="party" className="w-full"><Link href="/party/confirmed">Confirmar e pagar</Link></Button>
      <Button asChild variant="secondary" size="party" className="w-full text-primary"><Link href="/party/pending/alternative">Gerar outra opção</Link></Button>
    </>}>
      <section aria-labelledby="order-title" className="space-y-1">
        <p className="text-[11px] leading-[14px] font-bold text-primary">SEU PEDIDO PARA O TEMA</p>
        <h1 id="order-title" className="font-preparation text-5xl leading-[1.2] font-bold">{order.theme}</h1>
        <p className="flex items-center gap-1 text-muted-foreground"><span className="text-xs">★ {order.rating}</span><span className="text-[13px] leading-[1.35]">{order.merchant}</span></p>
      </section>
      <ul aria-label="Itens do pedido">
        {order.items.map((item) => <li key={item.id} className="flex items-center gap-3 border-b py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary"><Image src="/figma/order-basket.svg" alt="" width={16} height={16} /></span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-sm leading-[1.35] font-bold">{item.name}</h2>
            <div className="flex items-start justify-between gap-3"><p className="text-xs leading-[1.35] text-order-detail">{item.description}</p><p className="shrink-0 text-sm leading-[1.35] font-bold">{currency.format(item.price)}</p></div>
          </div>
        </li>)}
      </ul>
      <section aria-label="Total do pedido" className="space-y-2 leading-[1.35]">
        <div className="flex items-center justify-between gap-3 text-2xl font-bold"><h2>Total do pedido</h2><p className="shrink-0">{currency.format(order.total)}</p></div>
        <p className="text-xs text-muted-foreground">Esse valor considera o frete, taxas e seus cupons disponíveis</p>
      </section>
      <OrderDetailCard icon="/figma/order-motorbike.svg" title="Entrega hoje" detail={order.delivery} />
      <OrderDetailCard icon="/figma/order-map-pin.svg" title={order.address} detail={order.complement} />
      <OrderDetailCard icon="/figma/order-wallet.svg" title="Método de Pagamento" detail={order.paymentMethod} action={
        <Button asChild variant="link" className="h-auto shrink-0 p-0 text-[11px] font-normal"><Link href="/party/pending/payment-method">Trocar método</Link></Button>
      } />
    </PartyShell>
  );
}
