import type {
  IfoodItemDetail,
  IfoodSearchItem,
  LocalOption,
  SelectedOption,
} from "./types.js";

const MAX_QUANTITY = 3;

/** Folga sobre o orçamento de referência: escolher R$50 ainda conta como "dentro" até uns R$55. */
export const BUDGET_TOLERANCE = 0.1;

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Escolhe as opções mais baratas de cada grupo obrigatório (`minSelections ≥ 1`). */
export function cheapestRequiredOptions(detail: IfoodItemDetail): SelectedOption[] {
  const selected: SelectedOption[] = [];
  for (const group of detail.optionGroups ?? []) {
    if (group.minSelections < 1) continue;
    const cheapest = [...group.options]
      .sort((a, b) => a.additionalPrice - b.additionalPrice)
      .slice(0, group.minSelections);
    for (const option of cheapest) {
      selected.push({
        optionGroupId: group.optionGroupId,
        optionId: option.optionId,
        name: option.name,
        additionalPrice: option.additionalPrice,
      });
    }
  }
  return selected;
}

/**
 * Monta uma opção com um item, respeitando o pedido mínimo da loja.
 * Abaixo do mínimo, aumenta a quantidade até no máximo 3. Devolve `null` só quando o item não
 * forma um pedido válido: o orçamento é apenas referência e não descarta nada aqui — quem ordena
 * as opções por proximidade do orçamento é `rankOptions`.
 */
export function buildOption(
  candidate: IfoodSearchItem,
  detail: IfoodItemDetail,
): LocalOption | null {
  const { merchant } = candidate;
  const selectedOptions = cheapestRequiredOptions(detail);
  const basePrice = detail.promotionalUnitPrice ?? detail.unitPrice;
  const unitPrice = money(
    basePrice + selectedOptions.reduce((sum, option) => sum + option.additionalPrice, 0),
  );
  if (unitPrice <= 0) return null;

  const minimumOrderAmount =
    detail.merchantMinimumOrderAmount ?? merchant.minimumOrderAmount ?? 0;
  const quantity = Math.max(1, Math.ceil(minimumOrderAmount / unitPrice - 1e-9));
  if (quantity > MAX_QUANTITY) return null;

  const method = merchant.deliveryMethod;
  const deliveryFee = money(method.promotionalFee ?? method.fee);
  const subtotal = money(unitPrice * quantity);
  const total = money(subtotal + deliveryFee);

  return {
    merchant: {
      id: merchant.merchantId,
      name: merchant.merchantName,
      distanceKm: merchant.straightLineDistanceKm,
      ...(merchant.reviewRating ? { rating: money(merchant.reviewRating) } : {}),
    },
    items: [
      {
        itemId: detail.itemId,
        name: detail.itemName,
        quantity,
        unitPrice,
        selectedOptions,
      },
    ],
    subtotal,
    deliveryFee,
    total,
    minimumOrderAmount,
    deliveryMethodId: method.deliveryMethodId,
    estimatedDeliveryMinutes: method.estimatedMinutes,
  };
}

/**
 * Ordena as opções: primeiro as que caem no orçamento de referência (com a folga de
 * `BUDGET_TOLERANCE`); entre elas e as demais, melhor avaliação, entrega mais rápida e menor total.
 * Sem `budget`, mantém apenas a heurística de qualidade.
 */
export function rankOptions(options: LocalOption[], budget?: number): LocalOption[] {
  return [...options].sort(
    (a, b) =>
      overReference(a, budget) - overReference(b, budget) ||
      (b.merchant.rating ?? 0) - (a.merchant.rating ?? 0) ||
      a.estimatedDeliveryMinutes.max - b.estimatedDeliveryMinutes.max ||
      a.total - b.total,
  );
}

function overReference(option: LocalOption, budget?: number): number {
  if (budget === undefined) return 0;
  return option.total > money(budget * (1 + BUDGET_TOLERANCE)) ? 1 : 0;
}
