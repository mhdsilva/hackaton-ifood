import type { PartyInfo } from "@sidequest/contracts";

/** O agente escreve um título livre; as buscas que ele escolheu orientam a arte da revelação. */
const DEFAULT_IMAGE = "/themes/theme-distancia.png";
const THEME_IMAGES = {
  italiano: "/figma/theme-italian.png",
  japones: "/themes/theme-japones.png",
  hamburguer: "/themes/theme-hamburguer.png",
  mexicano: "/themes/theme-mexicano.png",
  brasileiro: "/themes/theme-brasileiro.png",
  arabe: "/themes/theme-arabe.png",
  saudavel: "/themes/theme-saudavel.png",
  doce: "/themes/theme-doce.png",
  distancia: DEFAULT_IMAGE,
} as const;

const THEME_SIGNALS: Record<keyof typeof THEME_IMAGES, string[]> = {
  japones: ["japones", "japanese", "sushi", "temaki", "yakisoba", "ramen", "sashimi"],
  hamburguer: ["hamburguer", "hamburger", "burger", "smash", "cheeseburger"],
  mexicano: ["mexicano", "mexican", "taco", "burrito", "nachos", "quesadilla"],
  brasileiro: ["brasileiro", "brasileira", "feijoada", "farofa", "prato feito", "parmegiana"],
  arabe: ["arabe", "arab", "esfiha", "kibe", "shawarma", "falafel", "homus"],
  saudavel: ["saudavel", "salada", "poke", "bowl", "leve", "vegetal", "fitness"],
  doce: ["doce", "sobremesa", "brigadeiro", "acai", "bolo", "chocolate", "sorvete"],
  italiano: ["italiano", "italiana", "pizza", "massa", "lasanha", "pasta", "nhoque", "ravioli"],
  distancia: ["distancia", "sextou", "sabadou", "domingou"],
};

const DEFAULT_TITLE = "Tema da Party";
const DEFAULT_DESCRIPTION = "Sabores diferentes, a mesma temática.";

export interface RevealTheme {
  /** Título livre escolhido pelo agente. */
  title: string;
  description: string;
  image: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function imageForTheme(party: Pick<PartyInfo, "theme" | "themeQueries">): string {
  const text = normalize([party.theme, ...(party.themeQueries ?? [])].filter(Boolean).join(" "));
  const theme = (Object.keys(THEME_SIGNALS) as Array<keyof typeof THEME_SIGNALS>).find((key) =>
    THEME_SIGNALS[key].some((signal) => text.includes(signal)),
  );
  return theme ? THEME_IMAGES[theme] : DEFAULT_IMAGE;
}

export function revealTheme(
  party: Pick<PartyInfo, "theme" | "themeQueries" | "themeReason">,
): RevealTheme {
  return {
    title: party.theme?.trim() || DEFAULT_TITLE,
    description: party.themeReason?.trim() || DEFAULT_DESCRIPTION,
    image: imageForTheme(party),
  };
}
