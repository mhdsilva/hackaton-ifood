/**
 * Cenário visual do Figma: nenhum catálogo, carrinho ou pagamento real é consultado.
 *
 * Os itens acompanham o tema escolhido pelo agente e variam por participante (duas opções
 * por tema), para o resumo não repetir sempre a mesma pizza. Quando o pedido real entrar,
 * este módulo sai de cena.
 */
import { normalizeTheme, themeCopy } from "@/lib/reveal-theme";

export interface MockOrderItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface ThemeMenu {
  merchant: string;
  rating: string;
  /** Dois menus por tema; o participante vê um deles. */
  variants: MockOrderItem[][];
}

const FEES = 6;
const DEFAULT_THEME = "italiano";

const THEME_MENUS: Record<string, ThemeMenu> = {
  italiano: {
    merchant: "Forno da Vila",
    rating: "4,8",
    variants: [
      [
        { id: "pizza-calabresa", name: "Pizza individual", description: "Sabor Calabresa", price: 38 },
        { id: "focaccia", name: "Focaccia", description: "Sabor Alecrim", price: 12 },
        { id: "agua-gas", name: "Água com gás", description: "330ml", price: 8 },
      ],
      [
        { id: "pizza-margherita", name: "Pizza individual", description: "Sabor Margherita", price: 36 },
        { id: "bruschetta", name: "Bruschetta", description: "Tomate e manjericão", price: 14 },
        { id: "limonada", name: "Limonada", description: "Feita na casa", price: 8 },
      ],
    ],
  },
  hamburguer: {
    merchant: "Burger do Bairro",
    rating: "4,7",
    variants: [
      [
        { id: "burger-classico", name: "Burger clássico", description: "Blend 160g, queijo e picles", price: 32 },
        { id: "batata-rustica", name: "Batata rústica", description: "Com páprica", price: 14 },
        { id: "refrigerante", name: "Refrigerante", description: "Lata 350ml", price: 7 },
      ],
      [
        { id: "smash-duplo", name: "Smash duplo", description: "Dois blends, cheddar e cebola", price: 36 },
        { id: "onion-rings", name: "Onion rings", description: "Seis unidades", price: 13 },
        { id: "milkshake", name: "Milkshake", description: "Chocolate 300ml", price: 12 },
      ],
    ],
  },
  japones: {
    merchant: "Nori House",
    rating: "4,9",
    variants: [
      [
        { id: "combinado", name: "Combinado", description: "12 peças variadas", price: 42 },
        { id: "temaki-salmao", name: "Temaki de salmão", description: "Com cream cheese", price: 18 },
        { id: "cha-verde", name: "Chá verde", description: "Gelado 300ml", price: 6 },
      ],
      [
        { id: "donburi", name: "Donburi de salmão", description: "Arroz japonês e salmão", price: 38 },
        { id: "guioza", name: "Guioza", description: "Seis unidades", price: 16 },
        { id: "limonada-japonesa", name: "Limonada", description: "Com hortelã", price: 8 },
      ],
    ],
  },
  mexicano: {
    merchant: "Taco Loco",
    rating: "4,6",
    variants: [
      [
        { id: "burrito-carnitas", name: "Burrito de carnitas", description: "Com feijão e queijo", price: 34 },
        { id: "nachos", name: "Nachos", description: "Com guacamole", price: 16 },
        { id: "horchata", name: "Água de horchata", description: "300ml", price: 9 },
      ],
      [
        { id: "tacos-pastor", name: "Tacos al pastor", description: "Três unidades", price: 30 },
        { id: "quesadilla", name: "Quesadilla", description: "Frango e queijo", price: 18 },
        { id: "refrigerante-mexicano", name: "Refrigerante", description: "Lata 350ml", price: 7 },
      ],
    ],
  },
  brasileiro: {
    merchant: "Cantinho Mineiro",
    rating: "4,8",
    variants: [
      [
        { id: "feijoada", name: "Feijoada individual", description: "Com arroz e couve", price: 39 },
        { id: "farofa", name: "Farofa", description: "Da casa", price: 10 },
        { id: "suco-laranja", name: "Suco de laranja", description: "300ml", price: 9 },
      ],
      [
        { id: "frango-quiabo", name: "Frango com quiabo", description: "Com angu", price: 36 },
        { id: "arroz-couve", name: "Arroz e couve", description: "Porção individual", price: 12 },
        { id: "limonada-brasileira", name: "Limonada", description: "300ml", price: 8 },
      ],
    ],
  },
  arabe: {
    merchant: "Sabor Árabe",
    rating: "4,7",
    variants: [
      [
        { id: "kibe", name: "Kibe assado", description: "Dois unidades", price: 22 },
        { id: "esfiha", name: "Esfiha de carne", description: "Duas unidades", price: 18 },
        { id: "coalhada", name: "Coalhada seca", description: "Com azeite", price: 12 },
      ],
      [
        { id: "shawarma", name: "Shawarma de frango", description: "No pão sírio", price: 34 },
        { id: "homus", name: "Homus", description: "Com pão sírio", price: 14 },
        { id: "cha-hortela", name: "Chá de hortelã", description: "300ml", price: 6 },
      ],
    ],
  },
  saudavel: {
    merchant: "Verde Vivo",
    rating: "4,8",
    variants: [
      [
        { id: "bowl-quinoa", name: "Bowl de quinoa", description: "Legumes assados", price: 32 },
        { id: "salada-folhas", name: "Salada de folhas", description: "Com molho cítrico", price: 16 },
        { id: "suco-verde", name: "Suco verde", description: "300ml", price: 10 },
      ],
      [
        { id: "poke-atum", name: "Poke de atum", description: "Com arroz integral", price: 38 },
        { id: "salada-grao", name: "Salada de grão-de-bico", description: "Com ervas", price: 14 },
        { id: "agua-coco", name: "Água de coco", description: "300ml", price: 9 },
      ],
    ],
  },
  doce: {
    merchant: "Doce Encanto",
    rating: "4,9",
    variants: [
      [
        { id: "brownie", name: "Brownie", description: "Com sorvete de creme", price: 22 },
        { id: "bolo-fatia", name: "Fatia de bolo", description: "Chocolate com ganache", price: 16 },
        { id: "cafe", name: "Café coado", description: "200ml", price: 8 },
      ],
      [
        { id: "petit-gateau", name: "Petit gâteau", description: "Com calda de chocolate", price: 24 },
        { id: "cheesecake", name: "Cheesecake", description: "Frutas vermelhas", price: 18 },
        { id: "cappuccino", name: "Cappuccino", description: "200ml", price: 10 },
      ],
    ],
  },
};

export function getMockRevealTheme() {
  const copy = themeCopy(DEFAULT_THEME);
  return {
    name: `${copy.introduction} ${copy.emphasis}`,
    ...copy,
    description: "Sabores diferentes, a mesma temática.",
    image: "/figma/theme-italian.png",
  };
}

/**
 * Pedido visual do participante: o menu segue `party.theme` e `variant` (a posição dele na
 * Party) escolhe entre as duas opções do tema.
 */
export function getMockRevealedOrder(theme?: string, variant = 0) {
  const key = normalizeTheme(theme?.trim() || DEFAULT_THEME);
  const menu = THEME_MENUS[key] ?? THEME_MENUS[DEFAULT_THEME];
  const items = menu.variants[Math.abs(Math.trunc(variant)) % menu.variants.length] ?? menu.variants[0];
  const copy = themeCopy(THEME_MENUS[key] ? key : DEFAULT_THEME);

  return {
    theme: `${copy.introduction} ${copy.emphasis}`,
    merchant: menu.merchant,
    rating: menu.rating,
    items,
    fees: FEES,
    total: items.reduce((sum, item) => sum + item.price, FEES),
    delivery: "Hoje, 35 - 45 min",
    address: "Casa · Rua das Figueiras, 130",
    complement: "Parque Arnold Schmidt • Apt 13",
    paymentMethod: "Pix",
  };
}
