/**
 * Tipos internos do agente de opções locais. O contrato público
 * (`ResolveOptionsInput/Output`, `LocalOption`, `ResolvedItem`, `SelectedOption`)
 * vive em `@sidequest/contracts` e é reexportado aqui por compatibilidade.
 */

export type {
  LocalOption,
  ResolvedItem,
  ResolveOptionsInput,
  ResolveOptionsOutput,
  SelectedOption,
} from "@sidequest/contracts";

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
