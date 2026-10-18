import type { ParticipantAddress, ParticipantAddressDetails } from "@sidequest/contracts";
import type { IfoodAddress } from "./types.js";
import { sanitizeAddress } from "./sanitize.js";

/** Projeção privada para o dono do endereço. O planner continua usando sanitizeAddress. */
export function participantAddressDetails(address: {
  location?: unknown;
  formattedAddress?: unknown;
  postalCode?: unknown;
  complement?: unknown;
  reference?: unknown;
}): Pick<ParticipantAddress, "details"> {
  const location = typeof address.location === "object" && address.location !== null
    ? address.location as Record<string, unknown>
    : {};
  const details: ParticipantAddressDetails = {};
  for (const key of ["street", "number", "neighborhood", "city", "state"] as const) {
    const value = location[key];
    if (typeof value === "string" && value.trim()) details[key] = value.trim();
  }
  for (const key of ["formattedAddress", "postalCode", "complement", "reference"] as const) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) details[key] = value.trim();
  }
  return Object.keys(details).length ? { details } : {};
}

export function toParticipantAddress(address: IfoodAddress): ParticipantAddress {
  return { ...sanitizeAddress(address), ...participantAddressDetails(address) };
}
