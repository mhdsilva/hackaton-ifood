/**
 * Contrato proposto do agente de opções locais (Marco B).
 * Vive aqui até o Matheus aprová-lo e movê-lo para `packages/contracts`.
 */

export interface ResolveOptionsInput {
  participantId: string;
  theme: string;
  /** Orçamento total do participante, incluindo frete (BRL). */
  budget: number;
  restrictions: string[];
  /** Obrigatório quando a conta tem mais de um endereço salvo. */
  addressId?: string;
  maxOptions?: number;
}

export interface SelectedOption {
  optionGroupId: string;
  optionId: string;
  name: string;
  additionalPrice: number;
}

export interface ResolvedItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Escolhas obrigatórias já feitas, prontas para `createCart`. */
  selectedOptions: SelectedOption[];
}

export interface LocalOption {
  merchant: {
    id: string;
    name: string;
    distanceKm: number;
    rating?: number;
  };
  items: ResolvedItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  minimumOrderAmount: number;
  deliveryMethodId: string;
  estimatedDeliveryMinutes: { min: number; max: number };
}

export interface ResolveOptionsOutput {
  participantId: string;
  source: "live" | "simulated";
  theme: string;
  options: LocalOption[];
  warnings: string[];
}

/** Só o que o agente precisa do cliente MCP; facilita testes e a contingência. */
export interface ToolCaller {
  callTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>;
}

// Formatos (parciais) devolvidos pelo iFood MCP.

export interface IfoodCoordinates {
  latitude: number;
  longitude: number;
}

export interface IfoodAddress {
  addressId: string;
  alias?: string | null;
  location?: { neighborhood?: string; city?: string; state?: string };
  coordinates: IfoodCoordinates;
  isLastUsedAddress?: boolean;
}

export interface IfoodDeliveryMethod {
  deliveryMethodId: string;
  deliveryMethodMode?: string;
  estimatedMinutes: { min: number; max: number };
  fee: number;
  promotionalFee?: number;
}

export interface IfoodSearchItem {
  itemId: string;
  itemName: string;
  unitPrice: number;
  promotionalUnitPrice?: number;
  merchant: {
    merchantId: string;
    merchantName: string;
    isOpen: boolean;
    minimumOrderAmount?: number;
    reviewRating?: number;
    straightLineDistanceKm: number;
    deliveryMethod: IfoodDeliveryMethod;
  };
}

export interface IfoodOptionGroup {
  optionGroupId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: Array<{ optionId: string; name: string; additionalPrice: number }>;
}

export interface IfoodItemDetail {
  itemId: string;
  itemName: string;
  merchantId: string;
  merchantMinimumOrderAmount?: number;
  unitPrice: number;
  promotionalUnitPrice?: number;
  optionGroups?: IfoodOptionGroup[];
}
