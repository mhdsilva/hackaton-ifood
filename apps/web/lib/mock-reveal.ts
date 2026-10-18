// Cenário visual do Figma: nenhum catálogo, carrinho ou pagamento real é consultado.
export function getMockRevealTheme() {
  return {
    title: "Italiano",
    description: "Sabores diferentes, a mesma temática.",
    image: "/figma/theme-italian.png",
  };
}

export function getMockRevealedOrder() {
  const items = [
    { id: "pizza", name: "Pizza individual", description: "Sabor Calabresa", price: 38 },
    { id: "focaccia", name: "Focaccia", description: "Sabor Alecrim", price: 12 },
    { id: "water", name: "Água com gás", description: "330ml", price: 8 },
  ];
  const fees = 6;
  return {
    theme: getMockRevealTheme().title,
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
