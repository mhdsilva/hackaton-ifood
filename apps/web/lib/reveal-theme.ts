import type { PartyInfo } from "@sidequest/contracts";

/**
 * Texto e arte da tela de revelação a partir do tema real da Party.
 *
 * O título vem pronto do agente em `party.theme`; o front não traduz, não prefixa e não
 * mapeia categorias. A frase de `themeReason` explica a escolha do grupo. A única arte
 * disponível hoje é a italiana (pizza).
 */
const PLACEHOLDER_IMAGE = "/figma/theme-italian.png";
const NO_THEME_TITLE = "Tema da Party";
const DEFAULT_DESCRIPTION = "Sabores diferentes, a mesma temática.";

export interface RevealTheme {
  /** Título livre escolhido pelo agente. */
  title: string;
  description: string;
  image: string;
}

export function revealTheme(party: Pick<PartyInfo, "theme" | "themeReason">): RevealTheme {
  const title = party.theme?.trim() || NO_THEME_TITLE;
  const description = party.themeReason?.trim() || DEFAULT_DESCRIPTION;
  return { title, description, image: PLACEHOLDER_IMAGE };
}
