/**
 * Traduz o estado local das telas para o envelope real de `POST /parties/:id/answers`.
 *
 * Quando o catálogo real (`GET /questionnaire`) carrega, cada tela já renderiza as opções
 * reais e o estado local guarda os ids reais — não há tradução a fazer. Só no fallback (API
 * fora do ar), as telas mostram o catálogo fixo do Figma (`lib/mock-questionnaire.ts`), cujos
 * ids de restrições e orçamento são só visuais e não existem na API; por isso só esse caminho
 * passa por `RESTRICTION_ANSWER_ID`/`BUDGET_ANSWER_ID`. Energia, formato do pedido, desejos
 * (`cravings`) e exclusões já usam os mesmos ids da API também no mock, então nunca precisam
 * de tradução. Ver `apps/api/src/party/questionnaire.ts` (definição v2).
 */
import { otherAnswerKey, valueAnswerKey } from "@sidequest/contracts";
import type { PartyAddress } from "@/lib/addresses";
import { parseMockBudget, type BudgetOptionId, type RestrictionId } from "@/lib/mock-questionnaire";

const RESTRICTION_ANSWER_ID: Record<RestrictionId, string> = {
  vegetarian: "vegetarianismo",
  vegan: "veganismo",
  lactose: "sem-lactose",
  gluten: "sem-gluten",
  peanut: "alergia-amendoim",
  other: "outro",
};

const BUDGET_ANSWER_ID: Record<BudgetOptionId, string> = {
  "25": "ate-25",
  "50": "ate-50",
  "75": "ate-75",
  other: "outro",
};

export interface LiveAnswerState {
  selectedAddressId: string | null;
  addresses: PartyAddress[];
  restrictions: string[];
  otherRestriction: string;
  budgetOptionId: string | null;
  customBudget: string;
  preferences: Record<"energy" | "order-style", string | null>;
  desires: string[];
  exclusions: string[];
  otherExclusion: string;
  /** `false` só quando as telas estão no catálogo fixo do Figma (API indisponível). */
  usingLiveCatalog: boolean;
}

export function buildQuestionnaireAnswers(state: LiveAnswerState): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  const address = state.addresses.find((candidate) => candidate.id === state.selectedAddressId);
  if (address) answers.address = address.label;

  if (state.restrictions.length > 0) {
    answers.restrictions = state.usingLiveCatalog
      ? state.restrictions
      : state.restrictions.map((id) => RESTRICTION_ANSWER_ID[id as RestrictionId] ?? id);
    const otherId = state.usingLiveCatalog ? "outro" : "other";
    if (state.restrictions.includes(otherId) && state.otherRestriction.trim()) {
      answers[otherAnswerKey("restrictions")] = state.otherRestriction.trim();
    }
  }

  if (state.budgetOptionId) {
    answers.budget = state.usingLiveCatalog
      ? state.budgetOptionId
      : (BUDGET_ANSWER_ID[state.budgetOptionId as BudgetOptionId] ?? state.budgetOptionId);
    const otherId = state.usingLiveCatalog ? "outro" : "other";
    if (state.budgetOptionId === otherId) {
      const amount = parseMockBudget(state.customBudget);
      if (amount !== null) answers[valueAnswerKey("budget")] = amount;
    }
  }

  if (state.preferences.energy) answers.energy = state.preferences.energy;
  if (state.preferences["order-style"]) answers["order-style"] = state.preferences["order-style"];
  if (state.desires.length > 0) answers.cravings = state.desires;

  if (state.exclusions.length > 0) {
    answers.exclusions = state.exclusions;
    if (state.exclusions.includes("outro") && state.otherExclusion.trim()) {
      answers[otherAnswerKey("exclusions")] = state.otherExclusion.trim();
    }
  }

  return answers;
}
