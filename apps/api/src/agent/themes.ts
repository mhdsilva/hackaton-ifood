/**
 * Termos de busca por tema. O tema ainda é decidido pelo Júlio; enquanto isso, temas
 * desconhecidos viram a própria busca.
 */
const THEME_QUERIES: Record<string, string[]> = {
  italiano: ["massa", "pizza", "lasanha"],
  japones: ["sushi", "temaki", "yakisoba"],
  hamburguer: ["hamburguer", "smash burger", "cheeseburger"],
  mexicano: ["burrito", "taco", "nachos"],
  brasileiro: ["feijoada", "parmegiana", "prato feito"],
  arabe: ["esfiha", "kibe", "shawarma"],
  saudavel: ["salada", "poke", "bowl"],
  doce: ["doce", "brigadeiro", "açaí"],
};

/**
 * Buscas da "vibe" (tema sem contexto definido): um conjunto amplo, para o grupo ainda
 * receber opções reais quando o tema deriva para "sabadou/sextou à distância".
 */
export const VIBE_QUERIES = ["pizza", "hamburguer", "porcao", "lanche", "broto"];

/** Buscas genéricas usadas só quando o tema não produz nenhum pedido válido. */
export const BROAD_FALLBACK_QUERIES = [
  "prato feito",
  "marmita",
  "lanche",
  "pizza",
  "hamburguer",
  "comida",
];

const VIBE_THEMES = new Set([
  "a distancia",
  "sabadou a distancia",
  "sextou a distancia",
  "domingou a distancia",
]);

function normalize(theme: string): string {
  return theme
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function isVibeTheme(key: string): boolean {
  return VIBE_THEMES.has(key) || key.endsWith(" a distancia");
}

export function themeQueries(theme: string): string[] {
  const key = normalize(theme);
  const known = THEME_QUERIES[key];
  if (known) return known;
  if (isVibeTheme(key)) return VIBE_QUERIES;
  return key ? [theme.trim()] : [];
}

/** Temas conhecidos; base para a negociação de grupo propor alternativas. */
export function knownThemes(): string[] {
  return Object.keys(THEME_QUERIES);
}
