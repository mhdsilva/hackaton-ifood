/**
 * Endereço como o front exibe. A API devolve só `addressId` + `label` + `isLastUsedAddress`
 * (`ParticipantAddress` em `@sidequest/contracts`) — sem rua nem coordenadas. A lista de
 * exemplo acrescenta `street`/`region` para manter o desenho do Figma enquanto não há conta
 * do iFood conectada.
 */
import type { ParticipantAddress } from "@sidequest/contracts";

export interface PartyAddress {
  /** `addressId` do iFood (real) ou id local (exemplo). */
  id: string;
  label: string;
  street?: string;
  region?: string;
  /** Marcado pelo iFood como último endereço usado. */
  lastUsed?: boolean;
}

export function fromParticipantAddress(address: ParticipantAddress): PartyAddress {
  return {
    id: address.addressId,
    label: address.label,
    ...(address.isLastUsedAddress ? { lastUsed: true } : {}),
  };
}

/** Mantém a escolha atual se ela ainda existe; senão, o último usado, senão o primeiro. */
export function pickDefaultAddress(
  addresses: PartyAddress[],
  currentId: string | null,
): string | null {
  if (currentId && addresses.some((address) => address.id === currentId)) return currentId;
  return addresses.find((address) => address.lastUsed)?.id ?? addresses[0]?.id ?? null;
}
