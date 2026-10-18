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

const preferenceQuestions = {
  energy: {
    step: 4,
    title: "Qual energia combina mais com você hoje?",
    description: "Vamos usar o clima escolhido para encontrar opções que combinem com o momento.",
    options: [
      { id: "leve-refrescante", label: "Leve e refrescante" },
      { id: "quente-confortavel", label: "Quente e confortável" },
      { id: "crocante-descontraida", label: "Crocante e descontraída" },
      { id: "intensa-marcante", label: "Intensa e marcante" },
      { id: "surpreenda", label: "Tanto faz, me surpreenda!" },
    ],
  },
  "order-style": {
    step: 5,
    title: "Como você quer curtir seu pedido?",
    description: "Isso ajuda a definir o tipo e a variedade de itens para o pedido.",
    options: [
      { id: "refeicao-completa", label: "Uma refeição completa" },
      { id: "varias-experimentar", label: "Várias coisas para experimentar" },
      { id: "lanche-simples", label: "Um lanche sem complicação" },
      { id: "sobremesa-bebida", label: "Uma sobremesa ou bebida especial" },
      { id: "surpreenda", label: "Tanto faz, me surpreenda!" },
    ],
  },
} as const;

const desireOptions = [
  { id: "crocante", label: "Crocante" },
  { id: "cremoso", label: "Cremoso" },
  { id: "fresco", label: "Fresco" },
  { id: "bem-temperado", label: "Bem temperado" },
  { id: "picante", label: "Picante" },
  { id: "agridoce", label: "Agridoce" },
  { id: "surpreenda", label: "Tanto faz, me surpreenda!" },
] as const;

const exclusionOptions = [
  { id: "fritura", label: "Fritura" },
  { id: "comida-crua", label: "Comida crua" },
  { id: "muito-picante", label: "Muito picante" },
  { id: "bebida", label: "Bebida" },
  { id: "sobremesa", label: "Sobremesa" },
  { id: "outro", label: "Outro" },
] as const;

export type PreferenceQuestionId = keyof typeof preferenceQuestions;
export type DesireId = (typeof desireOptions)[number]["id"];
export type ExclusionId = (typeof exclusionOptions)[number]["id"];
export const MAX_MOCK_DESIRES = 2;

export function getMockPreferenceQuestion(id: PreferenceQuestionId) { return preferenceQuestions[id]; }
export function getMockDesireOptions() { return desireOptions; }
export function getMockExclusionOptions() { return exclusionOptions; }

export function toggleMockDesire(current: DesireId[], id: DesireId): DesireId[] {
  if (current.includes(id)) return current.filter((value) => value !== id);
  return current.length < MAX_MOCK_DESIRES ? [...current, id] : current;
}
