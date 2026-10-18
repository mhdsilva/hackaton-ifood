"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { QuestionChoices } from "@/components/party/question-choices";
import { useMockParty } from "@/components/party/mock-party-provider";
import { getMockDesireOptions, MAX_MOCK_DESIRES } from "@/lib/mock-questionnaire";

export function DesiresScreen() {
  const { desires, toggleDesire } = useMockParty();
  const router = useRouter();
  const canContinue = desires.length >= 1 && desires.length <= MAX_MOCK_DESIRES;

  return (
    <PartyShell backHref="/party/order-style" footer={<Button type="submit" form="desires-form" size="party" className="w-full" disabled={!canContinue}>Continuar</Button>}>
      <QuestionIntroduction id="desires-title" step={6} title="Escolha até dois desejos para hoje." description="Vamos priorizar opções que tenham os sabores e texturas escolhidos." />
      <form id="desires-form" onSubmit={(event) => { event.preventDefault(); if (canContinue) router.push("/party/avoid"); }}>
        <QuestionChoices name="desires" legend="Selecione até duas opções" options={getMockDesireOptions()} selected={desires} onSelect={toggleDesire} multiple maxSelections={MAX_MOCK_DESIRES} />
      </form>
    </PartyShell>
  );
}
