"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BudgetChoices } from "@/components/party/budget-choices";
import { useMockParty } from "@/components/party/mock-party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { parseMockBudget } from "@/lib/mock-questionnaire";

export function BudgetScreen() {
  const { budgetOptionId, setBudgetOptionId, customBudget, setCustomBudget } = useMockParty();
  const router = useRouter();
  const canContinue = budgetOptionId !== null && (budgetOptionId !== "other" || parseMockBudget(customBudget) !== null);

  return (
    <PartyShell backHref="/party/restrictions" footer={<Button type="submit" form="budget-form" size="party" className="w-full" disabled={!canContinue}>Continuar</Button>}>
      <QuestionIntroduction id="budget-title" step={3} title="Até quanto você pretende gastar?" description="Esse valor é individual e inclui uma estimativa das taxas. O orçamento é individual, e não do grupo." />
      <form id="budget-form" onSubmit={(event) => { event.preventDefault(); if (canContinue) router.push("/party/pending/next-question"); }}>
        <BudgetChoices selected={budgetOptionId} onSelect={setBudgetOptionId} customValue={customBudget} onCustomChange={setCustomBudget} inputId="custom-budget" />
      </form>
    </PartyShell>
  );
}
