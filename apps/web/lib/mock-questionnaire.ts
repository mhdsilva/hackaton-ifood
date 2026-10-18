// Definição visual provisória do Figma, independente da definição futura da API.
export const MOCK_QUESTIONNAIRE_STEPS = 8;

const restrictionOptions = [
  { id: "vegetarian", label: "Vegetarianismo" },
  { id: "vegan", label: "Veganismo" },
  { id: "lactose", label: "Sem lactose" },
  { id: "gluten", label: "Sem glúten" },
  { id: "peanut", label: "Alergia a amendoim" },
  { id: "other", label: "Outro" },
] as const;

const budgetOptions = [
  { id: "25", label: "Até R$25", amount: 25 },
  { id: "50", label: "Até R$50", amount: 50 },
  { id: "75", label: "Até R$75", amount: 75 },
  { id: "other", label: "Outro valor", amount: null },
] as const;

export type RestrictionId = (typeof restrictionOptions)[number]["id"];
export type BudgetOptionId = (typeof budgetOptions)[number]["id"];

export function getMockRestrictionOptions() { return restrictionOptions; }
export function getMockBudgetOptions() { return budgetOptions; }

export function parseMockBudget(value: string): number | null {
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value.trim().replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
