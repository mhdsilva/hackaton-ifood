/**
 * Loop do agente: um planner LLM escolhe tools, um executor determinístico as roda.
 *
 * Invariante da spec (docs/superpowers/specs/2026-10-17-agente-llm-ifood-mcp.md): o agente decide
 * **intenção**; o executor resolve **fato**. Este módulo é genérico de propósito — `ifoodToolbox`
 * expõe a allowlist do iFood, mas o loop não conhece o iFood. Só tools da allowlist rodam, os
 * argumentos são validados e o resultado volta truncado.
 */

import type { ChatClient, ChatMessage, ChatTool } from "../llm/client.js";
import { pickAddress } from "./pick-address.js";
import { sanitizeAddress, stripPersonalData } from "./sanitize.js";
import type { IfoodAddress, IfoodCoordinates, IfoodItemDetail, IfoodSearchItem, ToolCaller } from "./types.js";

export interface ToolSpec {
  description: string;
  parameters: Record<string, unknown>;
  run(args: Record<string, unknown>): Promise<unknown>;
}

/** Allowlist: só o que existe aqui pode ser chamado pelo modelo. */
export type ToolBox = Record<string, ToolSpec>;

export interface PlannerSettings {
  maxSteps?: number;
  timeoutMs?: number;
  maxToolResultChars?: number;
  now?: () => number;
}

export interface PlannerStep {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface PlannerOutcome {
  finalText: string;
  steps: PlannerStep[];
  stoppedBy: "final" | "max_steps" | "timeout";
}

const DEFAULT_MAX_STEPS = 6;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 4_000;

function catalog(toolbox: ToolBox): ChatTool[] {
  return Object.entries(toolbox).map(([name, spec]) => ({
    type: "function",
    function: { name, description: spec.description, parameters: spec.parameters },
  }));
}

function serialize(value: unknown, maxChars: number): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? "null";
  } catch {
    text = JSON.stringify({ error: "result_not_serializable" });
  }
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

async function executeTool(
  toolbox: ToolBox,
  name: string,
  rawArguments: string,
  maxChars: number,
): Promise<{ step: PlannerStep; content: string }> {
  const spec = toolbox[name];
  if (!spec) {
    return {
      step: { tool: name, args: {}, error: "tool_not_allowed" },
      content: serialize({ error: "tool_not_allowed" }, maxChars),
    };
  }

  let args: Record<string, unknown>;
  try {
    const parsed = rawArguments.trim() === "" ? {} : JSON.parse(rawArguments);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    args = parsed as Record<string, unknown>;
  } catch {
    return {
      step: { tool: name, args: {}, error: "invalid_arguments" },
      content: serialize({ error: "invalid_arguments" }, maxChars),
    };
  }

  try {
    const result = await spec.run(args);
    return { step: { tool: name, args, result }, content: serialize(result, maxChars) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "tool falhou";
    return { step: { tool: name, args, error: message }, content: serialize({ error: message }, maxChars) };
  }
}

/**
 * Roda o loop até o modelo parar de chamar tools, até `maxSteps` ou até estourar o tempo.
 * Nunca lança por falha de uma tool: o erro volta ao modelo como resultado e o loop continua.
 */
export async function runPlanner(
  client: ChatClient,
  toolbox: ToolBox,
  messages: ChatMessage[],
  settings: PlannerSettings = {},
): Promise<PlannerOutcome> {
  const maxSteps = settings.maxSteps ?? DEFAULT_MAX_STEPS;
  const timeoutMs = settings.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxChars = settings.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
  const now = settings.now ?? Date.now;
  const deadline = now() + timeoutMs;

  const tools = catalog(toolbox);
  const transcript: ChatMessage[] = [...messages];
  const steps: PlannerStep[] = [];

  for (let step = 0; step < maxSteps; step++) {
    if (now() > deadline) return { finalText: "", steps, stoppedBy: "timeout" };

    const assistant = await client.complete(transcript, tools);
    transcript.push(assistant);

    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) {
      return { finalText: assistant.content ?? "", steps, stoppedBy: "final" };
    }

    for (const call of calls) {
      const { step: executed, content } = await executeTool(
        toolbox,
        call.function.name,
        call.function.arguments,
        maxChars,
      );
      steps.push(executed);
      transcript.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  return { finalText: "", steps, stoppedBy: "max_steps" };
}

export interface IfoodToolboxSettings {
  maxSearchResults?: number;
}

/** Observa os itens que o MCP devolveu, para a whitelist de IDs do planner. */
type ItemRecorder = (items: IfoodSearchItem[]) => void;

/** O executor resolve o endereço; o modelo nunca precisa (nem vê) as coordenadas. */
async function resolveCoordinates(caller: ToolCaller, addressId: unknown): Promise<IfoodCoordinates> {
  const payload = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  const chosen = pickAddress(
    payload.results ?? [],
    typeof addressId === "string" ? addressId : undefined,
  );
  return chosen.coordinates;
}

/**
 * Allowlist das tools do iFood MCP. `record` observa os itens devolvidos pelo MCP — é assim que o
 * planner monta a whitelist de IDs que o modelo pode propor. É o único ponto por onde o modelo
 * alcança o catálogo real; IDs e preços continuam vindo do MCP.
 */
function baseIfoodTools(
  caller: ToolCaller,
  settings: IfoodToolboxSettings = {},
  record?: ItemRecorder,
): ToolBox {
  return {
    listAddresses: {
      description:
        "Lista os endereços salvos da conta do participante, com um rótulo seguro (bairro e cidade).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      async run() {
        const payload = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
        return { results: (payload.results ?? []).map(sanitizeAddress) };
      },
    },
    getUserProfile: {
      description:
        "Perfil, preferências e sinais de comportamento da conta do participante. Nome, e-mail, telefone e documentos são descartados.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      async run() {
        return stripPersonalData(await caller.callTool<Record<string, unknown>>("getUser"));
      },
    },
    getRecommendations: {
      description:
        "Recomendações personalizadas do iFood para o participante, perto do endereço dele.",
      parameters: {
        type: "object",
        properties: {
          addressId: { type: "string", description: "Endereço escolhido, quando houver mais de um." },
          pageSize: { type: "number" },
        },
        additionalProperties: false,
      },
      async run(args) {
        const userLocation = await resolveCoordinates(caller, args.addressId);
        const payload = await caller.callTool<{ results?: IfoodSearchItem[] }>("getRecommendations", {
          userLocation,
          ...(typeof args.pageSize === "number" ? { pageSize: args.pageSize } : {}),
        });
        const results = payload.results ?? [];
        record?.(results);
        return { results };
      },
    },
    searchOffers: {
      description: "Busca itens disponíveis perto do endereço do participante, para um termo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca, ex.: 'pizza'." },
          addressId: { type: "string", description: "Endereço escolhido, quando houver mais de um." },
          maxItemPrice: { type: "number", description: "Teto de preço por item, em BRL." },
          onlyOpen: { type: "boolean", description: "Só lojas abertas. Padrão: true." },
        },
        required: ["query"],
        additionalProperties: false,
      },
      async run(args) {
        const query = String(args.query ?? "").trim();
        if (!query) throw new Error("query é obrigatória");
        const userLocation = await resolveCoordinates(caller, args.addressId);
        const payload = await caller.callTool<{ results?: IfoodSearchItem[] }>("searchOffers", {
          query,
          userLocation,
          resultKind: "ITEM",
          merchantType: "RESTAURANT",
          pageSize: settings.maxSearchResults ?? 10,
          refinements: {
            onlyOpen: args.onlyOpen !== false,
            ...(typeof args.maxItemPrice === "number" ? { maxItemPrice: args.maxItemPrice } : {}),
          },
        });
        const results = payload.results ?? [];
        record?.(results);
        return { results };
      },
    },
    getItem: {
      description: "Detalha um item pelo itemId: preço, mínimo e opções obrigatórias.",
      parameters: {
        type: "object",
        properties: {
          merchantId: { type: "string" },
          itemId: { type: "string" },
          addressId: { type: "string", description: "Endereço escolhido, quando houver mais de um." },
        },
        required: ["merchantId", "itemId"],
        additionalProperties: false,
      },
      async run(args) {
        const userLocation = await resolveCoordinates(caller, args.addressId);
        return caller.callTool<IfoodItemDetail>("getItem", {
          merchantId: String(args.merchantId ?? ""),
          itemId: String(args.itemId ?? ""),
          userLocation,
        });
      },
    },
  };
}

/**
 * Allowlist das tools do iFood MCP que o plano pode dirigir. É o único ponto por onde o modelo
 * alcança o catálogo real; IDs e preços continuam vindo do MCP.
 */
export function ifoodToolbox(caller: ToolCaller, settings: IfoodToolboxSettings = {}): ToolBox {
  return baseIfoodTools(caller, settings);
}

export interface PlannerToolboxSettings extends IfoodToolboxSettings {
  /** Teto de itens aceitos em `proposeOptions`. */
  maxOptions?: number;
}

export interface PlannerToolbox {
  /** Allowlist do iFood mais a tool de finalização `proposeOptions`. */
  toolbox: ToolBox;
  /** Itens que o MCP devolveu nesta execução, por `merchantId`+`itemId`. */
  seen: ReadonlyMap<string, IfoodSearchItem>;
  /** Itens aceitos (só IDs que o MCP devolveu), ou `undefined` se ainda não houve proposta. */
  proposal(): IfoodSearchItem[] | undefined;
}

const DEFAULT_MAX_PROPOSED = 3;

function itemKey(merchantId: unknown, itemId: unknown): string | undefined {
  if (typeof merchantId !== "string" || typeof itemId !== "string") return undefined;
  const merchant = merchantId.trim();
  const item = itemId.trim();
  return merchant && item ? `${merchant}\u0000${item}` : undefined;
}

/**
 * Allowlist do iFood + `proposeOptions`: a tool que o modelo chama para finalizar. Ela só aceita
 * IDs que apareceram nas respostas do MCP (`seen`); o resto volta como `rejected` e o modelo pode
 * corrigir. É o invariante "nunca ID inventado" da spec, sem depender do bom comportamento do LLM.
 */
export function plannerToolbox(
  caller: ToolCaller,
  settings: PlannerToolboxSettings = {},
): PlannerToolbox {
  const seen = new Map<string, IfoodSearchItem>();
  let accepted: IfoodSearchItem[] | undefined;

  const record: ItemRecorder = (items) => {
    for (const item of items) {
      if (!item || !item.merchant || !item.itemId) continue;
      const key = itemKey(item.merchant.merchantId, item.itemId);
      if (key && !seen.has(key)) seen.set(key, item);
    }
  };

  const toolbox = baseIfoodTools(caller, settings, record);
  toolbox.proposeOptions = {
    description:
      "Finaliza a busca propondo as opções escolhidas. Só aceita itens que apareceram nas respostas das tools.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              merchantId: { type: "string" },
              itemId: { type: "string" },
            },
            required: ["merchantId", "itemId"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    async run(args) {
      const requested = Array.isArray(args.items) ? args.items : [];
      const chosen = new Set<string>();
      const acceptedItems: IfoodSearchItem[] = [];
      const rejected: string[] = [];

      for (const entry of requested) {
        const raw = (entry ?? {}) as Record<string, unknown>;
        const key = itemKey(raw.merchantId, raw.itemId);
        const item = key ? seen.get(key) : undefined;
        if (!key || !item || chosen.has(key)) {
          rejected.push(key ?? `${String(raw.merchantId)}/${String(raw.itemId)}`);
          continue;
        }
        chosen.add(key);
        acceptedItems.push(item);
      }

      const limited = acceptedItems.slice(0, settings.maxOptions ?? DEFAULT_MAX_PROPOSED);
      if (limited.length > 0) accepted = limited;

      return {
        accepted: limited.map((item) => ({
          merchantId: item.merchant.merchantId,
          itemId: item.itemId,
          itemName: item.itemName,
        })),
        rejected,
        seen: seen.size,
      };
    },
  };

  return { toolbox, seen, proposal: () => accepted };
}
