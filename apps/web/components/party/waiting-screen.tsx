"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { ParticipantList } from "@/components/party/participant-list";
import { useParty } from "@/components/party/party-provider";

export function WaitingScreen() {
  const { snapshot, currentParticipantId, completedParticipantIds, canCompleteQuestionnaire, revealTheme, isMock } = useParty();
  const router = useRouter();
  const [revealing, setRevealing] = useState(false);
  const readyIds = completedParticipantIds.filter((id) => id !== currentParticipantId || canCompleteQuestionnaire);
  const allReady = snapshot.participants.length > 0 && snapshot.participants.every((participant) => readyIds.includes(participant.id));
  const canReveal = isMock || (allReady && snapshot.party.hostParticipantId === currentParticipantId);

  async function reveal() {
    if (!canReveal || revealing) return;
    setRevealing(true);
    const ok = await revealTheme();
    setRevealing(false);
    if (ok) router.push("/party/preparing");
  }

  return (
    <PartyShell backHref="/party/avoid" footer={<Button size="party" className="w-full" disabled={!canReveal || revealing} onClick={reveal}>{revealing ? "Revelando..." : "Revelar resultado"}</Button>}>
      <QuestionIntroduction id="waiting-title" step={8} title={!readyIds.includes(currentParticipantId) ? "Conclua suas respostas para continuar." : allReady ? "Tudo pronto!" : "Tudo pronto! Aguarde os outros participantes..."} />
      <section aria-labelledby="ready-participants-title" className="space-y-2" aria-live="polite">
        <h2 id="ready-participants-title" className="text-base leading-6 font-bold">Participantes da Party</h2>
        <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={currentParticipantId} readyParticipantIds={readyIds} />
      </section>
    </PartyShell>
  );
}
