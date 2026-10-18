/**
 * Converte a proposta do planner em opções reais.
 *
 * O modelo só aponta IDs que viu; aqui o executor refaz `getItem` + `buildOption` e ranqueia — a
 * mesma aritmética do pipeline determinístico, com o orçamento como referência para a ordem.
 * ID inexistente simplesmente não vira opção, então a falha do agente degrada para a lista vazia
 * (e o chamador decide o fallback), nunca para um dado inventado.
 *
 * Ver docs/superpowers/specs/2026-10-17-agente-llm-ifood-mcp.md (invariante "intenção × fato").
 */

import type { ChatClient } from "../llm/client.js";
import { buildOption, rankOptions } from "./build-option.js";
import { AgentError, pickAddress } from "./pick-address.js";
import { buildPlannerMessages } from "./planner-context.js";
import { plannerToolbox, runPlanner, type PlannerSettings } from "./planner.js";
import { mapRestrictions } from "./restrictions.js";
import type {
  IfoodAddress,
  IfoodItemDetail,
  IfoodSearchItem,
  LocalOption,
  ResolveOptionsInput,
  ResolveOptionsOutput,
  ToolCaller,
} from "./types.js";
import type { RequiredPersonalization } from "./personalization.js";

const DEFAULT_MAX_OPTIONS = 3;

export interface PlannerOptionsSettings extends PlannerSettings {
  /** Itens por busca que o modelo recebe do MCP. */
  maxSearchResults?: number;
}

/**
 * Detalha e monta as opções para os itens propostos. Não lança por item ruim; o orçamento só
 * define a ordem. Pode devolver lista vazia — aí o chamador usa o determinístico.
 */
export async function buildProposedOptions(
  candidates: IfoodSearchItem[],
  caller: ToolCaller,
  input: { budget: number; address: IfoodAddress; maxOptions?: number },
): Promise<LocalOption[]> {
  const maxOptions = input.maxOptions ?? DEFAULT_MAX_OPTIONS;

  const built = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const detail = await caller.callTool<IfoodItemDetail>("getItem", {
        merchantId: candidate.merchant.merchantId,
        itemId: candidate.itemId,
        userLocation: input.address.coordinates,
      });
      return buildOption(candidate, detail);
    }),
  );

  const bestByMerchant = new Map<string, LocalOption>();
  for (const result of built) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const option = result.value;
    const current = bestByMerchant.get(option.merchant.id);
    if (!current || option.total < current.total) bestByMerchant.set(option.merchant.id, option);
  }

  return rankOptions([...bestByMerchant.values()], input.budget).slice(0, maxOptions);
}

/**
 * Caminho do planner para um participante: endereço → mensagens → loop de tool-calling →
 * proposta revalidada em `LocalOption[]`. Lança `AgentError` quando não há proposta ou quando
 * nenhum item virou opção — o chamador (integração) decide cair no determinístico.
 *
 * O `ChatClient` vem por injeção: sem `OPENCODE_API_KEY` não existe cliente e este caminho nem é
 * escolhido (o determinístico continua sendo o padrão).
 */
export async function resolveOptionsWithPlanner(
  input: ResolveOptionsInput,
  caller: ToolCaller,
  client: ChatClient,
  settings: PlannerOptionsSettings = {},
  personalization?: RequiredPersonalization,
): Promise<ResolveOptionsOutput> {
  const maxOptions = input.maxOptions ?? DEFAULT_MAX_OPTIONS;

  const addresses = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  const address = pickAddress(addresses.results ?? [], input.addressId);

  const { maxSearchResults, ...plannerSettings } = settings;
  const toolbox = plannerToolbox(caller, {
    maxOptions,
    initialCandidates: personalization?.recommendations ?? [],
    ...(maxSearchResults !== undefined ? { maxSearchResults } : {}),
  });

  const outcome = await runPlanner(
    client,
    toolbox.toolbox,
    buildPlannerMessages({
      theme: input.theme,
      budget: input.budget,
      restrictions: input.restrictions,
      addressId: address.addressId,
      addresses: addresses.results ?? [],
      maxOptions,
      profile: personalization?.profile,
      recommendations: personalization?.recommendations,
    }),
    plannerSettings,
  );

  const proposal = toolbox.proposal();
  if (!proposal) {
    throw new AgentError("NO_OPTIONS", "O agente não chegou a uma proposta de opções", {
      theme: input.theme,
      stoppedBy: outcome.stoppedBy,
      steps: outcome.steps.length,
    });
  }

  const options = await buildProposedOptions(proposal, caller, {
    budget: input.budget,
    address,
    maxOptions,
  });
  if (options.length === 0) {
    throw new AgentError("NO_OPTIONS", "Nenhum item proposto pelo agente virou opção", {
      theme: input.theme,
      proposed: proposal.length,
    });
  }

  const { ignored } = mapRestrictions(input.restrictions);
  const warnings = ignored.length > 0 ? [`Restrições sem filtro no iFood: ${ignored.join(", ")}`] : [];
  if (outcome.stoppedBy === "timeout") warnings.push("O agente parou no limite de tempo");

  return {
    participantId: input.participantId,
    source: "live",
    theme: input.theme,
    options,
    warnings,
  };
}
