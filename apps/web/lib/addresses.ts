/** Endereço privado do participante, compartilhado entre seleção e resumo do pedido. */
import type { ParticipantAddress } from "@sidequest/contracts";

export interface PartyAddress {
  /** `addressId` do iFood (real) ou id local (exemplo). */
  id: string;
  label: string;
  street?: string;
  region?: string;
  formattedAddress?: string;
  complement?: string;
  reference?: string;
  /** Marcado pelo iFood como último endereço usado. */
  lastUsed?: boolean;
}

export function fromParticipantAddress(address: ParticipantAddress): PartyAddress {
  const details = address.details;
  const street = details?.street ? [details.street, details.number].filter(Boolean).join(", ") : undefined;
  const postalCode = details?.postalCode?.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  const region = [details?.neighborhood, [details?.city, details?.state].filter(Boolean).join(", "), postalCode && `CEP ${postalCode}`].filter(Boolean).join(" · ");
  return {
    id: address.addressId,
    label: address.label,
    ...(street ? { street } : {}),
    ...(region ? { region } : {}),
    ...(details?.formattedAddress ? { formattedAddress: details.formattedAddress } : {}),
    ...(details?.complement ? { complement: details.complement } : {}),
    ...(details?.reference ? { reference: details.reference } : {}),
    ...(address.isLastUsedAddress ? { lastUsed: true } : {}),
  };
}

export function addressDetailLines(address: PartyAddress): string[] {
  // O endereço formatado é o fallback quando o iFood não devolve rua/número separados.
  let lines = [address.street, address.complement, address.region];
  if (!address.street && address.formattedAddress) {
    const complement = address.complement && !address.formattedAddress.includes(address.complement) ? address.complement : undefined;
    const postalCode = !address.formattedAddress.includes("CEP") ? address.region?.match(/CEP .+$/)?.[0] : undefined;
    lines = [address.formattedAddress, complement, postalCode];
  }
  if (address.reference) lines.push(`Referência: ${address.reference}`);
  return lines.filter((line): line is string => Boolean(line));
}

export function selectedPartyAddress(addresses: PartyAddress[], selectedId: string | null, answer: unknown): PartyAddress | undefined {
  const selected = addresses.find((address) => address.id === selectedId);
  if (selected && (typeof answer !== "string" || selected.label === answer)) return selected;
  return addresses.find((address) => address.label === answer) ?? selected;
}

/** Mantém a escolha atual se ela ainda existe; senão, o último usado, senão o primeiro. */
export function pickDefaultAddress(
  addresses: PartyAddress[],
  currentId: string | null,
): string | null {
  if (currentId && addresses.some((address) => address.id === currentId)) return currentId;
  return addresses.find((address) => address.lastUsed)?.id ?? addresses[0]?.id ?? null;
}
