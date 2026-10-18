"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LobbyScreen } from "@/components/party/lobby-screen";
import { useMockParty } from "@/components/party/mock-party-provider";

export function PartyEntryLoading() {
  return <div role="status" className="grid min-h-dvh place-items-center text-muted-foreground">Carregando Party...</div>;
}

export function PartyEntry() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() || null;
  const { inviteCode, enterParty } = useMockParty();

  useEffect(() => { enterParty(code); }, [code, enterParty]);

  if (inviteCode !== code) return <PartyEntryLoading />;
  return <LobbyScreen />;
}
