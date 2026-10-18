import type { IfoodAddress } from "./types.js";

export class AgentError extends Error {
  constructor(
    readonly code:
      | "NO_ADDRESS"
      | "ADDRESS_SELECTION_REQUIRED"
      | "ADDRESS_NOT_FOUND"
      | "ADDRESS_CREATION_FAILED"
      | "NO_OPTIONS"
      | "MCP_NOT_CONNECTED"
      | "NOT_FOUND"
      | "TIMEOUT",
    message: string,
    /** Seguro para a tela: nunca rua, número, CEP ou coordenadas. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

/**
 * Erros que exigem ação do participante (endereço, conexão): não podem ser mascarados pelo
 * fallback nem pela fixture. Mesma regra do ADR 0001.
 */
export const ACTIONABLE_AGENT_CODES = new Set<AgentError["code"]>([
  "NO_ADDRESS",
  "ADDRESS_SELECTION_REQUIRED",
  "ADDRESS_NOT_FOUND",
  "MCP_NOT_CONNECTED",
]);

export function isActionableAgentError(error: unknown): boolean {
  return error instanceof AgentError && ACTIONABLE_AGENT_CODES.has(error.code);
}

/** Rótulo seguro para mostrar ao participante: alias, ou bairro e cidade. */
export function addressLabel(address: IfoodAddress): string {
  if (address.alias) return address.alias;
  const { neighborhood, city } = address.location ?? {};
  return [neighborhood, city].filter(Boolean).join(", ") || "Endereço salvo";
}

/**
 * Um endereço salvo: usa direto. Vários: exige o `addressId` escolhido na Party,
 * sem inferir em silêncio (regra do User MCP).
 */
export function pickAddress(addresses: IfoodAddress[], addressId?: string): IfoodAddress {
  if (addresses.length === 0) {
    throw new AgentError("NO_ADDRESS", "A conta do iFood não tem endereço salvo");
  }
  if (addressId) {
    const chosen = addresses.find((address) => address.addressId === addressId);
    if (!chosen) {
      throw new AgentError("ADDRESS_NOT_FOUND", "O endereço escolhido não está nesta conta");
    }
    return chosen;
  }
  if (addresses.length === 1) return addresses[0];
  throw new AgentError(
    "ADDRESS_SELECTION_REQUIRED",
    "Escolha em qual endereço quer receber",
    {
      candidates: addresses.map((address) => ({
        addressId: address.addressId,
        label: addressLabel(address),
        isLastUsed: address.isLastUsedAddress ?? false,
      })),
    },
  );
}
