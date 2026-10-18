/**
 * Mensagens iniciais do planner: tema, orçamento, restrições e os endereços já sanitizados.
 *
 * O modelo só vê rótulos seguros (`sanitizeAddress`); rua, número, CEP e coordenadas ficam no
 * executor. As restrições viram o enum do iFood quando possível e, quando não, entram como texto
 * para orientar a escolha. Ver docs/superpowers/specs/2026-10-17-agente-llm-ifood-mcp.md.
 */

import type { ChatMessage } from "../llm/client.js";
import { mapRestrictions } from "./restrictions.js";
import { sanitizeAddress } from "./sanitize.js";
import type { IfoodAddress } from "./types.js";

export interface PlannerContext {
  theme: string;
  budget: number;
  restrictions?: string[];
  /** Endereço escolhido na Party, quando a conta tem mais de um. */
  addressId?: string;
  addresses: IfoodAddress[];
  maxOptions?: number;
}

const DEFAULT_MAX_OPTIONS = 3;

function systemPrompt(maxOptions: number): string {
  return [
    "Você é o planner do SideQuest: um jogo em grupo que monta pedidos do iFood para amigos em",
    "endereços diferentes a partir de um tema comum.",
    "",
    `Sua função é escolher, para UM participante, até ${maxOptions} opções de restaurante que`,
    "combinem com o tema, usando as tools disponíveis. Regras invioláveis:",
    "- Você decide a intenção (quais buscas fazem sentido). Quem calcula preço, frete e pedido",
    "  mínimo é o executor; você nunca inventa IDs, preços ou valores.",
    "- Só proponha itens que apareceram de fato nas respostas das tools. IDs inventados são",
    "  descartados.",
    "- Respeite o orçamento (inclui frete) e as restrições alimentares.",
    "- Quando tiver a proposta, chame proposeOptions com os itens escolhidos.",
    "- Responda em português do Brasil, em poucas frases.",
  ].join("\n");
}

function userPrompt(context: PlannerContext, maxOptions: number): string {
  const { itemRestrictions, ignored } = mapRestrictions(context.restrictions ?? []);
  const addresses = context.addresses.map(sanitizeAddress);

  const lines = [
    `Tema escolhido pelo grupo: ${context.theme.trim() || "(sem tema definido)"}`,
    `Orçamento do participante: R$ ${context.budget.toFixed(2)} (inclui frete).`,
    `Opções desejadas: até ${maxOptions}.`,
  ];
  if (itemRestrictions.length > 0) {
    lines.push(`Restrições alimentares (filtro do iFood): ${itemRestrictions.join(", ")}.`);
  }
  if (ignored.length > 0) {
    lines.push(
      `Restrições sem filtro no iFood (considere ao escolher): ${ignored.join(", ")}.`,
    );
  }
  if (context.addressId) {
    lines.push(`Endereço escolhido: ${context.addressId}.`);
  }
  lines.push(
    addresses.length === 0
      ? "Endereços salvos: nenhum."
      : `Endereços salvos (use o addressId): ${JSON.stringify(addresses)}`,
  );
  return lines.join("\n");
}

/** Mensagens iniciais do planner. Nunca contém dado pessoal nem coordenada. */
export function buildPlannerMessages(context: PlannerContext): ChatMessage[] {
  const maxOptions = context.maxOptions ?? DEFAULT_MAX_OPTIONS;
  return [
    { role: "system", content: systemPrompt(maxOptions) },
    { role: "user", content: userPrompt(context, maxOptions) },
  ];
}
