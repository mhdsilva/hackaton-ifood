/**
 * Derivação do tema comum a partir das respostas do grupo. Regra provisória:
 * o Júlio ainda vai definir como as respostas (energia, formato, desejos,
 * exclusões) viram tema. Por ora, o default é `italiano`, que é o tema das
 * fixtures do demo (`fixtures/ifood-discovery-italiano.json`,
 * `options-italiano.json`), para o fluxo fechar sem hardcode no front.
 */
export const FALLBACK_THEME = "italiano";

export function deriveTheme(answers: Record<string, unknown>): string {
  const explicit = answers.theme;
  if (typeof explicit === "string" && explicit.trim() !== "") {
    return explicit.trim().toLowerCase();
  }
  return FALLBACK_THEME;
}
