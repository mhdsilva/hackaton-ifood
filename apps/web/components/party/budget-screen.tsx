"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BudgetChoices } from "@/components/party/budget-choices";
import { useParty } from "@/components/party/party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { parseMockBudget } from "@/lib/mock-questionnaire";

export function BudgetScreen() {
  const { budgetOptions, budgetOptionId, setBudgetOptionId, customBudget, setCustomBudget, usingLiveCatalog } = useParty();
  const router = useRouter();
  const otherId = usingLiveCatalog ? "outro" : "other";
  const canContinue = budgetOptionId !== null && (budgetOptionId !== otherId || parseMockBudget(customBudget) !== null);

  return (
    <PartyShell backHref="/party/restrictions" footer={<Button type="submit" form="budget-form" size="party" className="w-full" disabled={!canContinue}>Continuar</Button>}>
      <QuestionIntroduction id="budget-title" step={3} title="Até quanto você pretende gastar?" description="Esse valor é individual e inclui uma estimativa das taxas. O orçamento é individual, e não do grupo." />
      <form id="budget-form" onSubmit={(event) => { event.preventDefault(); if (canContinue) router.push("/party/energy"); }}>
        <BudgetChoices options={budgetOptions} selected={budgetOptionId} onSelect={setBudgetOptionId} otherId={otherId} customValue={customBudget} onCustomChange={setCustomBudget} inputId="custom-budget" />
      </form>
    </PartyShell>
  );
}
