/**
 * Tools próprias do sistema (spec "Tools — próprias do sistema"): capacidades determinísticas que
 * o planner pode dirigir, em vez de o modelo improvisar.
 *
 * - `themeFromAnswers` reusa a regra de tema da Party (`deriveTheme`) + a tabela de consultas.
 * - `proposeSubstitutes` é a única que fala com o iFood: valida cada substituto com um
 *   `searchOffers` real e devolve só os termos que **existem** — "substituto só aponta para o que
 *   existe", que é o invariante da spec.
 * - `describeOption`/`rankOptions` operam sobre o que o executor já viu (`seen`); nunca inventam
 *   item, preço ou loja.
 *
 * Este módulo não importa `planner.ts` em tempo de execução (só tipos): assim `planner.ts` pode
 * compor a toolbox sem criar ciclo.
 */

import { deriveTheme } from "../party/theme.js";
import { themeQueries } from "./themes.js";
import type { IfoodCoordinates, IfoodSearchItem, ToolCaller } from "./types.js";
import type { ToolBox } from "./planner.js";

/** Chave estável de um item; o separator evita colisão entre ids. */
export function itemKey(merchantId: unknown, itemId: unknown): string | undefined {
  if (typeof merchantId !== "string" || typeof itemId !== "string") return undefined;
  const merchant = merchantId.trim();
  const item = itemId.trim();
  return merchant && item ? `${merchant}\u0000${item}` : undefined;
}

export interface SystemToolsContext {
  caller: ToolCaller;
  /** Itens que o MCP já devolveu nesta execução. */
  seen: ReadonlyMap<string, IfoodSearchItem>;
  /** Registra itens novos no `seen` (mesma whitelist do planner). */
  record(items: IfoodSearchItem[]): void;
  /** Resolve a coordenada do endereço escolhido; nunca chega ao modelo. */
  resolveLocation(addressId?: string): Promise<IfoodCoordinates>;
  /** Teto de itens por busca; espelha `IfoodToolboxSettings.maxSearchResults`. */
  searchPageSize?: number;
}

/** Tema comum a partir das respostas do grupo, na regra vigente da Party. */
export function themeFromAnswers(answers: Record<string, unknown>): {
  theme: string;
  queries: string[];
} {
  const theme = deriveTheme(answers);
  return { theme, queries: themeQueries(theme) };
}

/** Ordena candidatos por avaliação, proximidade e preço — a heurística do sistema. */
export function rankSeenItems(items: IfoodSearchItem[]): IfoodSearchItem[] {
  return [...items].sort(
    (a, b) =>
      (b.merchant.reviewRating ?? 0) - (a.merchant.reviewRating ?? 0) ||
      a.merchant.straightLineDistanceKm - b.merchant.straightLineDistanceKm ||
      (a.promotionalUnitPrice ?? a.unitPrice) - (b.promotionalUnitPrice ?? b.unitPrice),
  );
}

export interface ItemDescription {
  merchantId: string;
  itemId: string;
  itemName: string;
  merchantName: string;
  price: number;
  rating?: number;
  distanceKm: number;
  deliveryMinutes: { min: number; max: number };
  isOpen: boolean;
}

/** Fatos reais de um item visto, para o modelo descrever sem inventar. */
export function describeItem(item: IfoodSearchItem): ItemDescription {
  return {
    merchantId: item.merchant.merchantId,
    itemId: item.itemId,
    itemName: item.itemName,
    merchantName: item.merchant.merchantName,
    price: item.promotionalUnitPrice ?? item.unitPrice,
    ...(item.merchant.reviewRating ? { rating: item.merchant.reviewRating } : {}),
    distanceKm: item.merchant.straightLineDistanceKm,
    deliveryMinutes: item.merchant.deliveryMethod.estimatedMinutes,
    isOpen: item.merchant.isOpen,
  };
}

/** Monta as tools do sistema, ligadas ao `seen`/`record` do executor. */
export function systemTools(context: SystemToolsContext): ToolBox {
  const { caller, seen, record, resolveLocation } = context;

  const lookup = (merchantId: unknown, itemId: unknown): IfoodSearchItem | undefined => {
    const key = itemKey(merchantId, itemId);
    return key ? seen.get(key) : undefined;
  };

  return {
    themeFromAnswers: {
      description:
        "Deriva um tema comum e as consultas de busca a partir das respostas do questionário do grupo.",
      parameters: {
        type: "object",
        properties: {
          answers: { type: "object", description: "Respostas do questionário (chave → valor)." },
        },
        required: ["answers"],
        additionalProperties: false,
      },
      async run(args) {
        const answers = (args.answers ?? {}) as Record<string, unknown>;
        return themeFromAnswers(answers);
      },
    },
    proposeSubstitutes: {
      description:
        "Testa termos substitutos no catálogo real e devolve só os que têm resultado (substituto validado).",
      parameters: {
        type: "object",
        properties: {
          queries: { type: "array", minItems: 1, items: { type: "string" } },
          maxItemPrice: { type: "number", description: "Teto de preço por item, em BRL." },
          addressId: { type: "string", description: "Endereço escolhido, quando houver mais de um." },
        },
        required: ["queries"],
        additionalProperties: false,
      },
      async run(args) {
        const queries = (Array.isArray(args.queries) ? args.queries : [])
          .map((query) => String(query).trim())
          .filter((query) => query.length > 0);
        if (queries.length === 0) throw new Error("queries é obrigatório");

        const userLocation = await resolveLocation(
          typeof args.addressId === "string" ? args.addressId : undefined,
        );
        const substitutes: Array<{ query: string; items: IfoodSearchItem[] }> = [];
        for (const query of queries) {
          const payload = await caller.callTool<{ results?: IfoodSearchItem[] }>("searchOffers", {
            query,
            userLocation,
            resultKind: "ITEM",
            merchantType: "RESTAURANT",
            pageSize: context.searchPageSize ?? 10,
            refinements: {
              onlyOpen: true,
              ...(typeof args.maxItemPrice === "number" ? { maxItemPrice: args.maxItemPrice } : {}),
            },
          });
          const results = payload.results ?? [];
          if (results.length === 0) continue;
          record(results);
          substitutes.push({ query, items: results.slice(0, 3) });
        }
        return { substitutes };
      },
    },
    describeOption: {
      description:
        "Descreve um item que já apareceu nas buscas, com dados reais (preço, avaliação, distância, entrega).",
      parameters: {
        type: "object",
        properties: {
          merchantId: { type: "string" },
          itemId: { type: "string" },
        },
        required: ["merchantId", "itemId"],
        additionalProperties: false,
      },
      async run(args) {
        const item = lookup(args.merchantId, args.itemId);
        if (!item) throw new Error("item não apareceu nas buscas");
        return describeItem(item);
      },
    },
    rankOptions: {
      description:
        "Ordena itens já vistos por avaliação, proximidade e preço (heurística do sistema).",
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
        const known: IfoodSearchItem[] = [];
        for (const entry of requested) {
          const raw = (entry ?? {}) as Record<string, unknown>;
          const item = lookup(raw.merchantId, raw.itemId);
          if (item) known.push(item);
        }
        return {
          items: rankSeenItems(known).map((item) => ({
            merchantId: item.merchant.merchantId,
            itemId: item.itemId,
          })),
        };
      },
    },
  };
}
