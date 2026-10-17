import type {
  IfoodItemDetail,
  IfoodSearchItem,
  LocalOption,
  SelectedOption,
} from "./types.js";

const MAX_QUANTITY = 3;

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
 * Monta uma opção com um item, respeitando pedido mínimo e orçamento (com frete).
 * Abaixo do mínimo, aumenta a quantidade até no máximo 3. Devolve `null` se não couber.
 */
export function buildOption(
  candidate: IfoodSearchItem,
  detail: IfoodItemDetail,
  budget: number,
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
  if (total > budget) return null;

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

/** Melhor avaliação primeiro; empate decidido pela entrega mais rápida e depois pelo menor total. */
export function rankOptions(options: LocalOption[]): LocalOption[] {
  return [...options].sort(
    (a, b) =>
      (b.merchant.rating ?? 0) - (a.merchant.rating ?? 0) ||
      a.estimatedDeliveryMinutes.max - b.estimatedDeliveryMinutes.max ||
      a.total - b.total,
  );
}
