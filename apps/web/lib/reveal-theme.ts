import type { PartyInfo } from "@sidequest/contracts";

/**
 * Texto e arte da tela de revelação a partir do tema real da Party.
 *
 * A única arte de tema disponível hoje é a italiana (pizza). Até chegarem as demais, todo
 * tema usa esta imagem — o texto continua sendo o tema escolhido pelo agente. Trocar por
 * uma arte por tema é só preencher `THEME_IMAGE` em `THEME_COPY`.
 */
const PLACEHOLDER_IMAGE = "/figma/theme-italian.png";

interface ThemeCopy {
  /** Primeira linha, em peso normal (ex.: "Noite"). */
  introduction: string;
  /** Segunda linha, em destaque (ex.: "Italiana"). */
  emphasis: string;
}

const THEME_COPY: Record<string, ThemeCopy> = {
  italiano: { introduction: "Noite", emphasis: "Italiana" },
  japones: { introduction: "Noite", emphasis: "Japonesa" },
  hamburguer: { introduction: "Noite", emphasis: "Burger" },
  mexicano: { introduction: "Noite", emphasis: "Mexicana" },
  brasileiro: { introduction: "Noite", emphasis: "Brasileira" },
  arabe: { introduction: "Noite", emphasis: "Árabe" },
  saudavel: { introduction: "Noite", emphasis: "Saudável" },
  doce: { introduction: "Noite", emphasis: "Doce" },
};

const VIBE_COPY: ThemeCopy = { introduction: "Party", emphasis: "à Distância" };
const NO_THEME_COPY: ThemeCopy = { introduction: "Tema", emphasis: "da Party" };
const DEFAULT_DESCRIPTION = "Sabores diferentes, a mesma temática.";

export interface RevealTheme extends ThemeCopy {
  description: string;
  image: string;
}

function normalize(theme: string): string {
  return theme
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function revealTheme(party: Pick<PartyInfo, "theme" | "themeReason">): RevealTheme {
  const raw = party.theme?.trim();
  const key = raw ? normalize(raw) : "";

  const copy = !key
    ? NO_THEME_COPY
    : key.endsWith("a distancia")
      ? VIBE_COPY
      : (THEME_COPY[key] ?? { introduction: "Tema", emphasis: raw ?? "" });

  // A frase do agente explica a escolha do grupo; sem ela, fica a descrição genérica.
  const description = party.themeReason?.trim() || DEFAULT_DESCRIPTION;

  return { ...copy, description, image: PLACEHOLDER_IMAGE };
}
