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

function normalize(theme: string): string {
  return theme
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function themeQueries(theme: string): string[] {
  const key = normalize(theme);
  return THEME_QUERIES[key] ?? (key ? [theme.trim()] : []);
}

/** Temas conhecidos; base para a negociação de grupo propor alternativas. */
export function knownThemes(): string[] {
  return Object.keys(THEME_QUERIES);
}
