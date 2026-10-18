/**
 * Derivação do tema comum a partir das respostas do grupo.
 *
 * Regra provisória (a definitiva é decisão do Júlio — Marco T):
 * 1. tema explícito, quando vier nas respostas;
 * 2. senão, o tema é inferido dos sinais das Etapas 4–7 (energia, formato, desejos);
 * 3. sem contexto, cai na "vibe" do dia — `sabadou`/`sextou à distância` — que o agente
 *    sabe buscar em qualquer endereço (`agent/themes.ts`, `VIBE_QUERIES`).
 */

type Answers = Record<string, unknown>;

/** Vibe por dia da semana; a chave é `Date#getDay()` (0 = domingo). */
const WEEKDAY_VIBE: Record<number, string> = {
  5: "sextou a distancia",
  6: "sabadou a distancia",
};

/** Vibe neutra para os demais dias (provisório). */
export const DEFAULT_VIBE = "a distancia";

export function vibeTheme(now: Date = new Date()): string {
  return WEEKDAY_VIBE[now.getDay()] ?? DEFAULT_VIBE;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function picks(value: unknown, option: string): boolean {
  return Array.isArray(value) && value.includes(option);
}

/**
 * Tabela provisória de sinais → tema (Marco T). Ordem importa: o primeiro que casar vence.
 * `surpreenda` e respostas vazias não decidem nada.
 */
const SIGNAL_THEME_RULES: Array<{ theme: string; matches: (answers: Answers) => boolean }> = [
  { theme: "doce", matches: (answers) => text(answers["order-style"]) === "sobremesa-bebida" },
  {
    theme: "saudavel",
    matches: (answers) =>
      text(answers.energy) === "leve-refrescante" || picks(answers.cravings, "fresco"),
  },
  {
    theme: "mexicano",
    matches: (answers) =>
      text(answers.energy) === "intensa-marcante" || picks(answers.cravings, "picante"),
  },
  { theme: "hamburguer", matches: (answers) => text(answers["order-style"]) === "lanche-simples" },
  {
    theme: "italiano",
    matches: (answers) =>
      text(answers.energy) === "quente-confortavel" || picks(answers.cravings, "cremoso"),
  },
  {
    theme: "brasileiro",
    matches: (answers) => text(answers["order-style"]) === "refeicao-completa",
  },
];

export function deriveTheme(answers: Answers, now: Date = new Date()): string {
  const explicit = text(answers.theme);
  if (explicit) return explicit;

  for (const rule of SIGNAL_THEME_RULES) {
    if (rule.matches(answers)) return rule.theme;
  }

  return vibeTheme(now);
}
