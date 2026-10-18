import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyShell } from "@/components/party/party-shell";
import { Button } from "@/components/ui/button";

const screens: Record<string, { name: string; backHref: string }> = {
  "invite": { name: "Entrada pelo convite", backHref: "/" },
  "new-address": { name: "Adicionar novo endereço", backHref: "/party/address" },
  "next-question": { name: "Etapa 4 · Próxima pergunta", backHref: "/party/budget" },
};

export const metadata = { title: "Tela pendente | iFood Party" };

export default async function PendingPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  const destination = Object.hasOwn(screens, screen) ? screens[screen] : undefined;
  if (!destination) notFound();
  return (
    <PartyShell backHref={destination.backHref} footer={<Button asChild size="party" className="w-full"><Link href={destination.backHref}>Voltar à prévia</Link></Button>}>
      <div className="space-y-4 py-12">
        <p className="text-xs font-bold text-primary">TELA PENDENTE</p>
        <h1 className="text-3xl leading-tight font-bold">{destination.name}</h1>
        <p className="text-sm leading-5 text-secondary-foreground">Este é o próximo destino do fluxo. A tela ainda será implementada.</p>
      </div>
    </PartyShell>
  );
}
