"use client";

import { useQuestionRouter } from "@/components/party/question-navigation";
import { Button } from "@/components/ui/button";
import { BudgetChoices } from "@/components/party/budget-choices";
import { useParty } from "@/components/party/party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { parseMockBudget } from "@/lib/mock-questionnaire";

const rangeCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function BudgetScreen() {
  const {
    budgetOptions,
    budgetOptionId,
    setBudgetOptionId,
    budgetCustomRange,
    customBudget,
    setCustomBudget,
    usingLiveCatalog,
  } = useParty();
  const router = useQuestionRouter();
  const otherId = usingLiveCatalog ? "outro" : "other";
  const showsCustom = budgetOptionId !== null && budgetOptionId === otherId;
  const customAmount = parseMockBudget(customBudget);
  // A API valida o "Outro valor" contra budget.customInput (1–999): barramos aqui antes.
  const customInRange =
    customAmount !== null &&
    customAmount >= budgetCustomRange.min &&
    customAmount <= budgetCustomRange.max;
  const canContinue = budgetOptionId !== null && (!showsCustom || customInRange);
  const customInvalid = showsCustom && customBudget.trim().length > 0 && !customInRange;

  return (
    <PartyShell backHref="/party/restrictions" footer={<Button type="submit" form="budget-form" size="party" className="w-full" disabled={!canContinue}>Continuar</Button>}>
      <QuestionIntroduction id="budget-title" step={3} title="Até quanto você pretende gastar?" description="Esse valor é individual e inclui uma estimativa das taxas. O orçamento é individual, e não do grupo." />
      <form id="budget-form" onSubmit={(event) => { event.preventDefault(); if (canContinue) router.push("/party/energy"); }}>
        <BudgetChoices options={budgetOptions} selected={budgetOptionId} onSelect={setBudgetOptionId} otherId={otherId} customValue={customBudget} onCustomChange={setCustomBudget} inputId="custom-budget" />
        {showsCustom && (
          <p
            role={customInvalid ? "alert" : undefined}
            className={`mt-2 text-xs leading-4 ${customInvalid ? "text-primary" : "text-muted-foreground"}`}
          >
            Informe um valor entre {rangeCurrency.format(budgetCustomRange.min)} e {rangeCurrency.format(budgetCustomRange.max)}.
          </p>
        )}
      </form>
    </PartyShell>
  );
}
