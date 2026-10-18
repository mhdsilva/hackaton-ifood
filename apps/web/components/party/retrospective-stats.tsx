import type { PartyRetrospectiveSummary } from "@sidequest/contracts";

export function RetrospectiveStats({ summary }: { summary: PartyRetrospectiveSummary }) {
  const stats = [
    { value: summary.completedOrderCount, label: summary.completedOrderCount === 1 ? "pedido concluído" : "pedidos concluídos" },
    { value: summary.itemCount, label: summary.itemCount === 1 ? "item na mesa" : "itens na mesa" },
    { value: summary.merchantCount, label: summary.merchantCount === 1 ? "restaurante" : "restaurantes" },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-border rounded-2xl border py-5">
      {stats.map(({ value, label }) => <div key={label} className="flex min-w-0 flex-col px-3 text-center">
        <dt className="order-2 mt-1 text-[11px] leading-4 text-order-detail">{label}</dt>
        <dd className="font-preparation text-[38px] leading-none font-semibold tabular-nums">
          <span className="sr-only">{value}</span><span aria-hidden="true" data-retro-number={value}>{value}</span>
        </dd>
      </div>)}
    </dl>
  );
}
