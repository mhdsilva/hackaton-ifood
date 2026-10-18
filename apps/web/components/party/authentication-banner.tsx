import Image from "next/image";
import type { McpConnectionStatus } from "@sidequest/contracts";
import { Button } from "@/components/ui/button";

export function AuthenticationBanner({ status, connecting = false, onLogin }: { status: McpConnectionStatus; connecting?: boolean; onLogin: () => void }) {
  if (status === "connected") return null;
  const busy = connecting || status === "validating";
  const failed = status === "error";

  return (
    <section aria-label="Autenticação no iFood" className="relative isolate flex min-h-[68px] items-center gap-3 overflow-hidden rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
      <Image src="/figma/party-face.svg" alt="" width={104} height={104} className="pointer-events-none absolute -top-4 -right-3 -z-10 rotate-[-15deg] opacity-20" />
      <Image src="/figma/party-face.svg" alt="" width={24} height={24} className="shrink-0" />
      <p role={failed ? "alert" : "status"} className="min-w-0 flex-1 text-sm leading-[18px]">
        {failed ? <>Não foi possível<br /><strong>se autenticar</strong></> : busy ? <>Autenticação<br /><strong>em andamento</strong></> : <>Você precisa<br /><strong>se autenticar</strong></>}
      </p>
      <Button size="invite" variant="inverse" className="gap-1 text-xs font-normal" disabled={busy} aria-busy={busy} onClick={onLogin}>
        {!busy && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h5v16h-5M3 12h12m-4-4 4 4-4 4" /></svg>}
        {busy ? "Aguarde..." : failed ? "Tentar de novo" : "Fazer Login"}
      </Button>
    </section>
  );
}
