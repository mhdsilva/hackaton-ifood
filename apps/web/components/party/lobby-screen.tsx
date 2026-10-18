"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useParty } from "@/components/party/party-provider";
import { ParticipantAvatar, ParticipantList } from "@/components/party/participant-list";
import { PartyShell } from "@/components/party/party-shell";
import { AuthenticationBanner } from "@/components/party/authentication-banner";
import { getLobbyState } from "@/lib/lobby-state";
import { buildPartyInviteUrl } from "@/lib/party-invitation";

export function LobbyScreen() {
  const { snapshot, currentParticipantId, startParty, connectMcp, connectingMcp } = useParty();
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const { isHost, host, me, hasStarted, canContinue, buttonLabel } = getLobbyState(snapshot, currentParticipantId);
  const mcpStatus = me?.mcpConnectionStatus ?? "not_connected";

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => {
      setCopied(false);
      setCopyStatus("");
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyInvitation() {
    setCopyStatus("");
    setCopying(true);
    try {
      const url = buildPartyInviteUrl(snapshot.party.code, window.location.origin);
      await navigator.clipboard.writeText(url);
      setCopyStatus("Link da Party copiado!");
      setCopied(true);
    } catch {
      setCopyStatus("Não foi possível copiar. Tente novamente.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <PartyShell brandTone="light" footer={
      <Button size="party" className="h-auto min-h-[50px] w-full py-3 break-words whitespace-normal" disabled={!canContinue || starting} aria-busy={starting} onClick={async () => {
        if (!canContinue || starting) return;
        setStarting(true);
        try {
          if (hasStarted || await startParty()) router.push("/party/address");
        } finally { setStarting(false); }
      }}>{starting ? "Iniciando party..." : buttonLabel}</Button>
    }>
      <section aria-labelledby="party-title" className="relative isolate overflow-hidden rounded-2xl bg-secondary p-6 text-foreground">
        <Image src="/figma/banner-logo.svg" alt="" width={286} height={155} className="pointer-events-none absolute top-7 left-[101px] -z-10 max-w-none opacity-50" />
        <p className="text-xs leading-[normal] font-bold text-primary">CRIAR PARTY</p>
        <h1 id="party-title" className="mt-2 text-4xl leading-[1.12] font-bold">{snapshot.party.name}</h1>
        {isHost ? <div className="mt-6 flex items-center gap-3 rounded-lg bg-invitation p-4 text-invitation-foreground">
          <Image src="/figma/share.svg" alt="" width={20} height={20} className="shrink-0" />
          <p className="min-w-0 flex-1 text-xs leading-[normal]">Envie o link para<br /><strong>seus amigos!</strong></p>
          <Button size="invite" className="min-w-[124px] disabled:bg-primary disabled:text-primary-foreground" disabled={copying || copied} aria-busy={copying} onClick={copyInvitation}>
            {copied ? <Image src="/figma/check.svg" alt="" width={16} height={16} /> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
            </svg>}
            {copied ? "Copiado!" : copying ? "Copiando..." : "Copiar link"}
          </Button>
        </div> : <div className="mt-6 flex items-center gap-3">
          <ParticipantAvatar name={host?.name ?? "Anfitrião"} isHost className="bg-foreground text-primary" />
          <p className="text-sm leading-[18px]">{host?.name ?? "O anfitrião"} chamou você<br />pra uma party</p>
        </div>}
        <p role="status" className="sr-only">{copyStatus}</p>
        {copyStatus && !copied && <p className="mt-3 text-xs" aria-hidden="true">{copyStatus}</p>}
      </section>
      <AuthenticationBanner status={mcpStatus} connecting={connectingMcp} onLogin={() => void connectMcp()} />
      <section aria-labelledby="experience-title" className="space-y-4">
        <h2 id="experience-title" className="text-2xl leading-[1.12] font-bold">Cada um no seu canto. Todo mundo na mesma vibe.</h2>
        <p className="text-sm leading-5 text-secondary-foreground">Vocês respondem juntos e descobrem uma temática. Cada pessoa recebe opções locais, adaptadas ao próprio endereço.</p>
      </section>
      <section aria-labelledby="participants-title" aria-live="polite" aria-atomic="true" className="space-y-2">
        <h2 id="participants-title" className="text-base leading-6 font-bold">Participantes da Party</h2>
        <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={currentParticipantId} />
      </section>
    </PartyShell>
  );
}
