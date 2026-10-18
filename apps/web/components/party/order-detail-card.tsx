import Image from "next/image";
import type { ReactNode } from "react";

export function OrderDetailCard({ icon, title, detail, action }: { icon: string; title: string; detail: string; action?: ReactNode }) {
  return (
    <section className="flex items-center gap-[10px] rounded-lg bg-secondary px-3 py-[10px]">
      <Image src={icon} alt="" width={20} height={20} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5 break-words leading-[1.35]">
        <h2 className="text-xs font-bold">{title}</h2>
        <p className="text-[11px] whitespace-pre-line text-order-detail">{detail}</p>
      </div>
      {action}
    </section>
  );
}
