import type { PartyInfo } from "@sidequest/contracts";

/**
 * Texto e arte da tela de revelação a partir do tema real da Party.
 *
 * O **tema** (italiano, japonês, ...) vem do agente em `party.theme`; aqui só formatamos o
 * nome para exibição. O prefixo é genérico de propósito: não amarra a experiência a
 * "noite"/"sábado", então funciona de dia ou de noite. A única arte disponível hoje é a
 * italiana (pizza); trocar é preencher `THEME_IMAGE` em `THEME_COPY`.
 */
const PLACEHOLDER_IMAGE = "/figma/theme-italian.png";

interface ThemeCopy {
  /** Primeira linha, em peso normal (ex.: "Bocado"). */
  introduction: string;
  /** Segunda linha, em destaque (ex.: "Italiano"). */
  emphasis: string;
}

const THEME_COPY: Record<string, ThemeCopy> = {
  italiano: { introduction: "Bocado", emphasis: "Italiano" },
  japones: { introduction: "Bocado", emphasis: "Japonês" },
  hamburguer: { introduction: "Bocado", emphasis: "Burger" },
  mexicano: { introduction: "Bocado", emphasis: "Mexicano" },
  brasileiro: { introduction: "Bocado", emphasis: "Brasileiro" },
  arabe: { introduction: "Bocado", emphasis: "Árabe" },
  saudavel: { introduction: "Bocado", emphasis: "Saudável" },
  doce: { introduction: "Bocado", emphasis: "Doce" },
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
