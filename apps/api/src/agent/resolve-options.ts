import { buildOption, rankOptions } from "./build-option.js";
import { AgentError, pickAddress } from "./pick-address.js";
import { mapRestrictions } from "./restrictions.js";
import { themeQueries } from "./themes.js";
import type {
  IfoodAddress,
  IfoodItemDetail,
  IfoodSearchItem,
  LocalOption,
  ResolveOptionsInput,
  ResolveOptionsOutput,
  ToolCaller,
} from "./types.js";

const DEFAULT_MAX_OPTIONS = 3;
const CANDIDATES_PER_MERCHANT = 2;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface ResolveOptionsSettings {
  timeoutMs?: number;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AgentError("TIMEOUT", "O iFood demorou demais para responder")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Opções reais do tema para um participante, usando apenas a sessão MCP dele:
 * endereço → busca por tema → detalhe dos itens → combinação. O orçamento é referência:
 * opções acima dele continuam na lista, só aparecem depois das que caem no valor.
 */
export function resolveOptions(
  input: ResolveOptionsInput,
  caller: ToolCaller,
  settings: ResolveOptionsSettings = {},
): Promise<ResolveOptionsOutput> {
  return withTimeout(resolve(input, caller), settings.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

async function resolve(
  input: ResolveOptionsInput,
  caller: ToolCaller,
): Promise<ResolveOptionsOutput> {
  const maxOptions = input.maxOptions ?? DEFAULT_MAX_OPTIONS;
  const warnings: string[] = [];

  const addresses = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  const address = pickAddress(addresses.results ?? [], input.addressId);

  const { itemRestrictions, ignored } = mapRestrictions(input.restrictions);
  if (ignored.length > 0) warnings.push(`Restrições sem filtro no iFood: ${ignored.join(", ")}`);

  const searches = await Promise.allSettled(
    themeQueries(input.theme).map((query) =>
      caller.callTool<{ results?: IfoodSearchItem[] }>("searchOffers", {
        query,
        userLocation: address.coordinates,
        resultKind: "ITEM",
        merchantType: "RESTAURANT",
        pageSize: 10,
        refinements: {
          onlyOpen: true,
          ...(itemRestrictions.length > 0 ? { itemRestrictions } : {}),
        },
      }),
    ),
  );

  const candidates = selectCandidates(
    searches.flatMap((search) => (search.status === "fulfilled" ? search.value.results ?? [] : [])),
    maxOptions * 2,
  );

  const built = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const detail = await caller.callTool<IfoodItemDetail>("getItem", {
        merchantId: candidate.merchant.merchantId,
        itemId: candidate.itemId,
        userLocation: address.coordinates,
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

  const options = rankOptions([...bestByMerchant.values()], input.budget).slice(0, maxOptions);
  if (options.length === 0) {
    throw new AgentError(
      "NO_OPTIONS",
      "Nenhum restaurante aberto do tema agora",
      { theme: input.theme, budget: input.budget },
    );
  }

  return {
    participantId: input.participantId,
    source: "live",
    theme: input.theme,
    options,
    warnings,
  };
}

/** Itens únicos, só de lojas abertas, no máximo dois por loja, das lojas melhor avaliadas. */
export function selectCandidates(
  results: IfoodSearchItem[],
  maxMerchants: number,
): IfoodSearchItem[] {
  const byMerchant = new Map<string, IfoodSearchItem[]>();
  const seen = new Set<string>();
  for (const item of results) {
    if (!item.merchant?.isOpen || seen.has(item.itemId)) continue;
    seen.add(item.itemId);
    const list = byMerchant.get(item.merchant.merchantId) ?? [];
    list.push(item);
    byMerchant.set(item.merchant.merchantId, list);
  }

  return [...byMerchant.values()]
    .sort((a, b) => (b[0].merchant.reviewRating ?? 0) - (a[0].merchant.reviewRating ?? 0))
    .slice(0, maxMerchants)
    .flatMap((items) =>
      items
        .sort(
          (a, b) =>
            (a.promotionalUnitPrice ?? a.unitPrice) - (b.promotionalUnitPrice ?? b.unitPrice),
        )
        .slice(0, CANDIDATES_PER_MERCHANT),
    );
}

export type PartyOptionsResult =
  | { participantId: string; status: "ok"; output: ResolveOptionsOutput }
  | { participantId: string; status: "error"; code: string; message: string; details?: unknown };

/**
 * Resolvedor de um participante, injetável: o orquestrador passa o caminho que preferir
 * (determinístico, planner LLM...) e a negociação reusa exatamente o mesmo.
 */
export type PartyOptionResolver = (
  input: ResolveOptionsInput,
  caller: ToolCaller,
) => Promise<ResolveOptionsOutput>;

/**
 * Resolve todos os participantes em paralelo. Cada um usa o próprio `ToolCaller`
 * (a própria sessão MCP); a falha de um não cancela os outros.
 */
export async function resolveOptionsForParty(
  requests: Array<{ input: ResolveOptionsInput; caller: ToolCaller }>,
  settings: ResolveOptionsSettings = {},
  resolve: PartyOptionResolver = (input, caller) => resolveOptions(input, caller, settings),
): Promise<PartyOptionsResult[]> {
  const settled = await Promise.allSettled(
    requests.map(({ input, caller }) => resolve(input, caller)),
  );
  return settled.map((result, index) => {
    const participantId = requests[index].input.participantId;
    if (result.status === "fulfilled") {
      return { participantId, status: "ok", output: result.value };
    }
    const error = result.reason;
    return error instanceof AgentError
      ? { participantId, status: "error", code: error.code, message: error.message, details: error.details }
      : {
          participantId,
          status: "error",
          code: "UNAVAILABLE",
          message: "Não foi possível consultar o iFood agora",
        };
  });
}
