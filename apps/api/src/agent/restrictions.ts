export type IfoodItemRestriction =
  | "LAC_FREE"
  | "SUGAR_FREE"
  | "VEGAN"
  | "VEGETARIAN"
  | "ORGANIC"
  | "GLUTEN_FREE";

/**
 * Tradução das restrições da Party para o enum de itens do iFood.
 *
 * Atenção: `alergia-amendoim` **não** tem equivalente no enum do iFood
 * (`LAC_FREE`, `SUGAR_FREE`, `VEGAN`, `VEGETARIAN`, `ORGANIC`, `GLUTEN_FREE`) e por isso
 * cai em `ignored` — quem consome precisa tratar alergia à parte, nunca só descartar.
 */
const MAPPING: Record<string, IfoodItemRestriction> = {
  vegetarian: "VEGETARIAN",
  vegetariano: "VEGETARIAN",
  vegetarianismo: "VEGETARIAN",
  vegan: "VEGAN",
  vegano: "VEGAN",
  veganismo: "VEGAN",
  lactose_free: "LAC_FREE",
  sem_lactose: "LAC_FREE",
  gluten_free: "GLUTEN_FREE",
  sem_gluten: "GLUTEN_FREE",
  sugar_free: "SUGAR_FREE",
  sem_acucar: "SUGAR_FREE",
  organic: "ORGANIC",
  organico: "ORGANIC",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Converte as restrições da Party para o enum do iFood; as desconhecidas voltam em `ignored`. */
export function mapRestrictions(restrictions: string[]): {
  itemRestrictions: IfoodItemRestriction[];
  ignored: string[];
} {
  const itemRestrictions = new Set<IfoodItemRestriction>();
  const ignored: string[] = [];
  for (const restriction of restrictions) {
    const mapped = MAPPING[normalize(restriction)];
    if (mapped) itemRestrictions.add(mapped);
    else if (restriction.trim()) ignored.push(restriction);
  }
  return { itemRestrictions: [...itemRestrictions], ignored };
}
