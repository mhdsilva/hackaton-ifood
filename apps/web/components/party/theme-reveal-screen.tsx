import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PartyShell } from "@/components/party/party-shell";
import { PreparationParticipants } from "@/components/party/preparation-participants";
import { getMockPreparationGroup } from "@/lib/mock-preparation";
import { getMockRevealTheme } from "@/lib/mock-reveal";

export function ThemeRevealScreen() {
  const theme = getMockRevealTheme();
  const group = getMockPreparationGroup();

  return (
    <PartyShell tone="celebration" brandTone="inverse" contentClassName="pb-3" footerClassName="pt-6 pb-[max(24px,env(safe-area-inset-bottom))]" footer={
      <Button asChild variant="inverse" size="party" className="w-full"><Link href="/party/unboxing">Descobrir meu pedido</Link></Button>
    }>
      <section aria-labelledby="theme-title" className="space-y-1">
        <p className="text-xs leading-4 font-bold">A TEMÁTICA DE VOCÊS É</p>
        <h1 id="theme-title" className="font-preparation text-[80px] leading-none font-semibold"><span className="font-normal">{theme.introduction}</span><br />{theme.emphasis}</h1>
        <p className="text-sm leading-5">{theme.description}</p>
      </section>
      <div className="relative h-[245px] overflow-hidden rounded-tl-[64px] rounded-br-[64px]">
        <Image src={theme.image} alt="Pratos italianos com pizza, massas e salada" fill sizes="(max-width: 448px) calc(100vw - 40px), 408px" className="object-cover" priority />
      </div>
      <PreparationParticipants participants={group.participants} hostId={group.hostId} onPrimary />
    </PartyShell>
  );
}
