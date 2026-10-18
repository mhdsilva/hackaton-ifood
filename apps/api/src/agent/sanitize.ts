/**
 * Fronteira de exposição ao modelo: o que pode e o que não pode ir para o prompt.
 *
 * Estende a regra do ADR 0001 (nunca nome, e-mail, telefone, token) para o agente: o modelo
 * recebe os sinais úteis do perfil e do catálogo, nunca dados pessoais. Ver
 * docs/superpowers/specs/2026-10-17-agente-llm-ifood-mcp.md.
 */

import type { ParticipantAddress } from "@sidequest/contracts";

import { addressLabel } from "./pick-address.js";
import type { IfoodAddress } from "./types.js";

/** Chaves descartadas em qualquer profundidade. Comparação ignora `_`, `-` e caixa. */
const PERSONAL_KEYS = new Set([
  "email",
  "phone",
  "phonenumber",
  "cellphone",
  "mobilephone",
  "cpf",
  "cnpj",
  "document",
  "documentnumber",
  "taxid",
  "birthdate",
  "birthday",
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
]);

/** Nomes de catálogo que o modelo precisa ver e que **não** são pessoas. */
const CATALOG_NAME_KEYS = new Set([
  "itemname",
  "merchantname",
  "optionname",
  "optiongroupname",
  "groupname",
  "categoryname",
  "storename",
  "productname",
  "brandname",
]);

function normalizeKey(key: string): string {
  return key.replace(/[_\s-]/g, "").toLowerCase();
}

/** Pessoal: chave conhecida, ou qualquer `*name` que não seja nome de catálogo. */
function isPersonalKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (PERSONAL_KEYS.has(normalized)) return true;
  return normalized.endsWith("name") && !CATALOG_NAME_KEYS.has(normalized);
}

/** Remove dados pessoais recursivamente, preservando o resto da estrutura. */
export function stripPersonalData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPersonalData);
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isPersonalKey(key)) continue;
      output[key] = stripPersonalData(child);
    }
    return output;
  }
  return value;
}

/** Projeta o endereço para o que o modelo pode ver: sem coordenadas, rua, número ou CEP. */
export function sanitizeAddress(address: IfoodAddress): ParticipantAddress {
  return {
    addressId: address.addressId,
    label: addressLabel(address),
    isLastUsedAddress: address.isLastUsedAddress ?? false,
  };
}
