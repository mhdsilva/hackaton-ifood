import type { PartyInfo } from "@sidequest/contracts";

/** O agente escreve um título livre; as buscas que ele escolheu orientam a arte da revelação. */
const DEFAULT_IMAGE = "/themes/theme-distancia.webp";
const THEME_IMAGES = {
  italiano: "/figma/theme-italian.png",
  japones: "/themes/theme-japones.webp",
  hamburguer: "/themes/theme-hamburguer.webp",
  mexicano: "/themes/theme-mexicano.webp",
  brasileiro: "/themes/theme-brasileiro.webp",
  arabe: "/themes/theme-arabe.webp",
  saudavel: "/themes/theme-saudavel.webp",
  doce: "/themes/theme-doce.webp",
  cafeDaManha: "/themes/theme-cafe-da-manha.webp",
  distancia: DEFAULT_IMAGE,
} as const;

const THEME_SIGNALS: Record<keyof typeof THEME_IMAGES, string[]> = {
  japones: ["japones", "japanese", "sushi", "temaki", "yakisoba", "ramen", "sashimi"],
  hamburguer: ["hamburguer", "hamburger", "burger", "smash", "cheeseburger"],
  mexicano: ["mexicano", "mexican", "taco", "burrito", "nachos", "quesadilla"],
  brasileiro: ["brasileiro", "brasileira", "feijoada", "farofa", "prato feito", "parmegiana"],
  arabe: ["arabe", "arab", "esfiha", "kibe", "shawarma", "falafel", "homus"],
  cafeDaManha: ["cafe da manha", "breakfast", "cafe", "pao", "croissant", "tapioca", "ovos", "omelete", "waffle", "panqueca"],
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
  const title = party.theme?.trim() || DEFAULT_TITLE;
  return {
    title: title.charAt(0).toLocaleUpperCase("pt-BR") + title.slice(1),
    description: party.themeReason?.trim() || DEFAULT_DESCRIPTION,
    image: imageForTheme(party),
  };
}
