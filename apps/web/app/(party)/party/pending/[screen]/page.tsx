import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyShell } from "@/components/party/party-shell";
import { NewAddressScreen } from "@/components/party/new-address-screen";
import { Button } from "@/components/ui/button";
import { DemoOrderProgressScreen } from "@/components/party/demo-order-progress-screen";

const screens: Record<string, { name: string; backHref: string }> = {
  "invite": { name: "Entrada pelo convite", backHref: "/" },
  "new-address": { name: "Adicionar novo endereço", backHref: "/party/address" },
  "next-question": { name: "Etapa 4 · Próxima pergunta", backHref: "/party/budget" },
  "reveal": { name: "Resultado da Party", backHref: "/party/waiting" },
  "checkout": { name: "Confirmação e pagamento", backHref: "/party/order" },
  "alternative": { name: "Gerar outra opção", backHref: "/party/order" },
  "payment-method": { name: "Trocar método de pagamento", backHref: "/party/order" },
  "delivery": { name: "Acompanhar entrega", backHref: "/party/confirmed" },
};

export const metadata = { title: "Tela pendente | iFood Party" };

// Required for `output: "export"`: only these screens exist.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen }));
}

export default async function PendingPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (screen === "delivery" && process.env.NEXT_PUBLIC_PARTY_MODE !== "mock") {
    return <DemoOrderProgressScreen />;
  }
  // Endereço novo já tem comportamento real; o desenho definitivo ainda não existe.
  if (screen === "new-address" && process.env.NEXT_PUBLIC_PARTY_MODE !== "mock") return <NewAddressScreen />;
  const destination = Object.hasOwn(screens, screen) ? screens[screen] : undefined;
  if (!destination) notFound();
  return (
    <PartyShell backHref={destination.backHref} footer={<Button asChild size="party" className="w-full"><Link href={destination.backHref}>Voltar à prévia</Link></Button>}>
      <div className="space-y-4 py-12">
        <p className="text-xs font-bold text-primary">TELA PENDENTE</p>
        <h1 className="text-3xl leading-tight font-bold">{destination.name}</h1>
        <p className="text-sm leading-5 text-secondary-foreground">Este é o próximo destino do fluxo. A tela ainda será implementada.</p>
        {screen === "delivery" && <Button asChild variant="secondary" size="party" className="w-full"><Link href="/party/retrospective">Ver retrospectiva simulada</Link></Button>}
      </div>
    </PartyShell>
  );
}
