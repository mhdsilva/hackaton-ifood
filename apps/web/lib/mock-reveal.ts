import type { LocalOption } from "@sidequest/contracts";

// Cenário visual do Figma: nenhum catálogo, carrinho ou pagamento real é consultado.
export function getMockRevealTheme() {
  return {
    title: "Noite Italiana",
    description: "Sabores diferentes, a mesma temática.",
    image: "/figma/theme-italian.png",
  };
}

export function getMockOrderOptions(): LocalOption[] {
  const order = getMockRevealedOrder();
  return [{
    merchant: { id: "mock-forno", name: order.merchant, rating: 4.8, distanceKm: 1.5 },
    items: order.items.map((item) => ({
      itemId: item.id, name: item.name, quantity: 1, unitPrice: item.price,
      selectedOptions: item.description ? [{ optionGroupId: "mock-detail", optionId: item.id, name: item.description, additionalPrice: 0 }] : [],
    })),
    subtotal: order.total - order.fees, deliveryFee: order.fees, total: order.total,
    minimumOrderAmount: 0, deliveryMethodId: "mock-delivery",
    estimatedDeliveryMinutes: { min: 35, max: 45 },
  }];
}

export function getMockRevealedOrder() {
  const items = [
    { id: "pizza", name: "Pizza individual", description: "Sabor Calabresa", price: 38 },
    { id: "focaccia", name: "Focaccia", price: 12 },
    { id: "water", name: "Água com gás", description: "330ml", price: 8 },
  ];
  const fees = 6;
  return {
    theme: "Italiano",
    merchant: "Forno da Vila",
    rating: "4,8",
    items,
    fees,
    total: items.reduce((sum, item) => sum + item.price, fees),
    delivery: "Hoje, 35 - 45 min",
    address: "Casa · Rua das Figueiras, 130",
    complement: "Parque Arnold Schmidt • Apt 13",
    paymentMethod: "Pix",
  };
}
