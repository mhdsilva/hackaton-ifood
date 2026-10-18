"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { QuestionChoices } from "@/components/party/question-choices";
import { useParty } from "@/components/party/party-provider";
import { getMockPreferenceQuestion, type PreferenceQuestionId } from "@/lib/mock-questionnaire";

export function PreferenceScreen({ questionId }: { questionId: PreferenceQuestionId }) {
  const { energyOptions, orderStyleOptions, preferences, selectPreference } = useParty();
  const question = getMockPreferenceQuestion(questionId);
  const options = questionId === "energy" ? energyOptions : orderStyleOptions;
  const selected = preferences[questionId];
  const router = useRouter();
  const formId = `${questionId}-form`;
  const backHref = questionId === "energy" ? "/party/budget" : "/party/energy";
  const nextHref = questionId === "energy" ? "/party/order-style" : "/party/desires";

  return (
    <PartyShell backHref={backHref} footer={<Button type="submit" form={formId} size="party" className="w-full" disabled={selected === null}>Continuar</Button>}>
      <QuestionIntroduction id={`${questionId}-title`} step={question.step} title={question.title} description={question.description} />
      <form id={formId} onSubmit={(event) => { event.preventDefault(); if (selected !== null) router.push(nextHref); }}>
        <QuestionChoices name={questionId} legend="Selecione uma opção" options={options} selected={selected ? [selected] : []} onSelect={(id) => selectPreference(questionId, id)} />
      </form>
    </PartyShell>
  );
}
