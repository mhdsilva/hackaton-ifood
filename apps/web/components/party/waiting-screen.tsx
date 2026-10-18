"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { ParticipantList } from "@/components/party/participant-list";
import { useMockParty } from "@/components/party/mock-party-provider";

export function WaitingScreen() {
  const { snapshot, currentParticipantId, completedParticipantIds, canCompleteQuestionnaire } = useMockParty();
  const router = useRouter();
  const readyIds = completedParticipantIds.filter((id) => id !== currentParticipantId || canCompleteQuestionnaire);
  const allReady = snapshot.participants.length > 0 && snapshot.participants.every((participant) => readyIds.includes(participant.id));

  return (
    <PartyShell backHref="/party/avoid" footer={<Button size="party" className="w-full" onClick={() => router.push("/party/preparing")}>Revelar resultado</Button>}>
      <QuestionIntroduction id="waiting-title" step={8} title={!readyIds.includes(currentParticipantId) ? "Conclua suas respostas para continuar." : allReady ? "Tudo pronto!" : "Tudo pronto! Aguarde os outros participantes..."} />
      <section aria-labelledby="ready-participants-title" className="space-y-2" aria-live="polite">
        <h2 id="ready-participants-title" className="text-base leading-6 font-bold">Participantes da Party</h2>
        <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={currentParticipantId} readyParticipantIds={readyIds} />
      </section>
    </PartyShell>
  );
}
