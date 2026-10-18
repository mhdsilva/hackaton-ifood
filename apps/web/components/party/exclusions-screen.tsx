"use client";

import { useState } from "react";
import { useQuestionRouter } from "@/components/party/question-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { useParty } from "@/components/party/party-provider";

export function ExclusionsScreen() {
  const { exclusionOptions, exclusions, toggleExclusion, otherExclusion, setOtherExclusion, hasRequiredAnswers, canCompleteQuestionnaire, completeQuestionnaire } = useParty();
  const router = useQuestionRouter();
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    const ok = await completeQuestionnaire();
    setSending(false);
    if (ok) router.push("/party/waiting");
  }

  return (
    <PartyShell backHref="/party/desires" footer={<Button type="submit" form="exclusions-form" size="party" className="w-full" disabled={!canCompleteQuestionnaire || sending}>{sending ? "Enviando..." : "Continuar"}</Button>}>
      <QuestionIntroduction id="exclusions-title" step={7} title="Tem alguma coisa que você definitivamente não quer hoje?" description="Marque tudo o que devemos deixar de fora das recomendações." />
      <form id="exclusions-form" className="space-y-4" onSubmit={submit}>
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-4 text-base leading-6 font-bold">Selecione as opções que se apliquem</legend>
          <div className="flex flex-wrap gap-2">
            {exclusionOptions.map((option) => <Button key={option.id} type="button" variant="chip" size="chip" aria-pressed={exclusions.includes(option.id)} onClick={() => toggleExclusion(option.id)}>{option.label}</Button>)}
          </div>
          {exclusions.includes("outro") && <div className="space-y-2">
            <label htmlFor="other-exclusion" className="text-sm font-medium">Conte o que você não deseja hoje</label>
            <Input id="other-exclusion" value={otherExclusion} onChange={(event) => setOtherExclusion(event.target.value)} placeholder="Digite aqui…" maxLength={500} required />
          </div>}
        </fieldset>
        {!hasRequiredAnswers && <p role="status" className="text-sm text-muted-foreground">Conclua as etapas anteriores para continuar.</p>}
      </form>
    </PartyShell>
  );
}
