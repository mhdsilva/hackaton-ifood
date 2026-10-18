/**
 * Liga o agente e o cliente MCP ao servidor da Party sem que o `server.ts` conheça o iFood.
 * O servidor recebe funções prontas: validar a conexão, resolver opções e conduzir
 * carrinho, pedido e rastreio de um participante.
 */

import { randomUUID } from "node:crypto";

import type {
  AddressCandidate,
  AddressResolutionResponse,
  CreateParticipantAddressRequest,
  CreateParticipantAddressResponse,
  McpConnectionStatus,
  ParticipantAddress,
} from "@sidequest/contracts";

import type { ChatClient } from "../llm/client.js";
import {
  CheckoutError,
  prepareCart,
  submitOrder,
  trackOrder,
  type CartSummary,
  type OrderTracking,
} from "../ifood/checkout.js";
import { IfoodMcpClient } from "../ifood/client.js";
import type { McpOAuthProvider } from "../ifood/provider.js";
import { validateConnection } from "../ifood/validate-connection.js";
import type { McpSessionRegistry } from "../mcp/session-registry.js";
import {
  fixtureCaller,
  fixtureQueriesFor,
  loadDiscoveryFixture,
  resolveOptionsPreferringPlanner,
  resolveOptionsWithFallback,
  SIMULATED_ADDRESS,
} from "./fallback.js";
import { AgentError, pickAddress } from "./pick-address.js";
import type { PlannerOptionsSettings } from "./planner-options.js";
import { resolveOptions } from "./resolve-options.js";
import { sanitizeAddress } from "./sanitize.js";
import { participantAddressDetails, toParticipantAddress } from "./participant-address.js";
import { loadPersonalization } from "./personalization.js";
import type {
  IfoodCoordinates,
  IfoodAddress,
  LocalOption,
  ResolveOptionsInput,
  ResolveOptionsOutput,
  ToolCaller,
} from "./types.js";

export interface ParticipantRef {
  partyId: string;
  participantId: string;
}

export interface PartyAgentIntegration {
  /** Ausente no modo `demo`: lá a conexão é sintética e vai direto para `connected`. */
  validateConnection?(
    actor: ParticipantRef,
  ): Promise<{ status: Extract<McpConnectionStatus, "connected" | "error">; name?: string }>;
  listAddresses?(actor: ParticipantRef): Promise<ParticipantAddress[]>;
  resolveNewAddress?(
    actor: ParticipantRef,
    input: { address: string },
  ): Promise<AddressResolutionResponse>;
  createParticipantAddress?(
    actor: ParticipantRef,
    input: CreateParticipantAddressRequest,
  ): Promise<CreateParticipantAddressResponse>;
  resolveOptions(
    actor: ParticipantRef,
    input: Omit<ResolveOptionsInput, "participantId">,
  ): Promise<ResolveOptionsOutput>;
  prepareCart?(
    actor: ParticipantRef,
    input: { option: LocalOption; addressId?: string },
  ): Promise<
    CartSummary & {
      simulated: boolean;
      checkoutSimulated?: boolean;
      participantCoordinates?: IfoodCoordinates;
    }
  >;
  submitOrder?(
    actor: ParticipantRef,
    input: { cartId: string; userConsent: boolean },
  ): Promise<{ orderId: string; simulated: boolean }>;
  trackOrder?(actor: ParticipantRef, orderId: string): Promise<OrderTracking & { simulated: boolean }>;
}

/** Modo real: cada participante usa o próprio token do registro privado. */
export function createIfoodIntegration(deps: {
  sessions: McpSessionRegistry;
  provider: McpOAuthProvider;
  mcpUrl?: string;
  fetchImpl?: typeof globalThis.fetch;
  /** Mantém o MCP real até o carrinho e simula submissão/rastreio para apresentações. */
  checkoutMode?: "ifood" | "simulated";
  /** Planner LLM opcional: sem ele, a integração fica no caminho determinístico. */
  llm?: { client: ChatClient; settings?: PlannerOptionsSettings };
}): PartyAgentIntegration {
  const checkoutMode = deps.checkoutMode ?? "ifood";
  const demoCarts = new Map<string, string>();
  const demoOrders = new Map<string, { owner: string; createdAt: number }>();
  const ownerKey = (actor: ParticipantRef) => `${actor.partyId}\u0000${actor.participantId}`;

  const clientFor = (actor: ParticipantRef): IfoodMcpClient => {
    const session = deps.sessions.get(actor.partyId, actor.participantId);
    if (!session) {
      throw new AgentError("MCP_NOT_CONNECTED", "Conecte sua conta do iFood antes de continuar");
    }
    return new IfoodMcpClient({
      session,
      ...(deps.mcpUrl ? { mcpUrl: deps.mcpUrl } : {}),
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      ...(deps.provider.refreshTokens
        ? { refreshTokens: (token: string) => deps.provider.refreshTokens!(token) }
        : {}),
      onSessionRefreshed: (next) => deps.sessions.set(actor.partyId, actor.participantId, next),
    });
  };

  // `listAddresses` já roda na busca de opções (resolveOptions/personalization) com o mesmo
  // endereço que depois vira o pedido; reaproveita essa leitura em vez de chamar o iFood de
  // novo em prepareCart, o que também evita falhas por chamadas repetidas em sequência.
  const ADDRESS_CACHE_TTL_MS = 5 * 60_000;
  const addressListCache = new Map<string, { addresses: IfoodAddress[]; expiresAt: number }>();

  const invalidateAddressCache = (actor: ParticipantRef) => {
    addressListCache.delete(ownerKey(actor));
  };

  /** Mesma interface de `clientFor`, mas serve `listAddresses` do cache quando ainda válido. */
  const cachedCallerFor = (actor: ParticipantRef): Pick<IfoodMcpClient, "callTool"> => {
    const real = clientFor(actor);
    return {
      async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
        if (name !== "listAddresses") return real.callTool<T>(name, args);
        const key = ownerKey(actor);
        const cached = addressListCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return { results: cached.addresses } as unknown as T;
        }
        const result = await real.callTool<{ results?: IfoodAddress[] }>(name, args);
        addressListCache.set(key, {
          addresses: result.results ?? [],
          expiresAt: Date.now() + ADDRESS_CACHE_TTL_MS,
        });
        return result as unknown as T;
      },
    };
  };

  return {
    async validateConnection(actor) {
      try {
        return await validateConnection(clientFor(actor));
      } catch {
        return { status: "error" as const };
      }
    },
    async listAddresses(actor) {
      const result = await cachedCallerFor(actor).callTool<{ results?: IfoodAddress[] }>("listAddresses");
      return (result.results ?? []).map(toParticipantAddress);
    },
    async resolveNewAddress(actor, input) {
      return resolveAddressCandidates(clientFor(actor), input.address);
    },
    async createParticipantAddress(actor, input) {
      const created = await persistParticipantAddress(clientFor(actor), input);
      invalidateAddressCache(actor);
      return created;
    },
    async resolveOptions(actor, input) {
      const fullInput = { ...input, participantId: actor.participantId };
      const caller = cachedCallerFor(actor);
      // Personalization enriches discovery when available; it must not block real MCP searches.
      const personalization = await loadPersonalization(fullInput, caller);
      return deps.llm
        ? resolveOptionsPreferringPlanner(
            fullInput,
            caller,
            deps.llm.client,
            deps.llm.settings ?? {},
            personalization,
          )
        : resolveOptionsWithFallback(fullInput, caller, undefined, {}, personalization);
    },
    async prepareCart(actor, input) {
      if (checkoutMode === "simulated") {
        const cartId = `demo-${randomUUID()}`;
        demoCarts.set(cartId, ownerKey(actor));
        // Carrinho e pagamento ficam simulados, mas o endereço que seria usado no pedido é
        // real (mesma leitura MCP de sempre, sem custo): a retrospectiva usa essa coordenada
        // em vez de depender da submissão/entrega, que este modo nunca faz.
        let participantCoordinates: IfoodCoordinates | undefined;
        try {
          const address = await resolveAddress(cachedCallerFor(actor), input.addressId);
          participantCoordinates = address.coordinates;
          if (!participantCoordinates) {
            console.warn("Simulated checkout: resolved address has no coordinates", {
              partyId: actor.partyId,
              participantId: actor.participantId,
              hadAddressId: Boolean(input.addressId),
            });
          }
        } catch (cause) {
          // Sem endereço resolvível (ex.: várias contas sem escolha): segue sem distância.
          console.warn("Simulated checkout: could not resolve the chosen address", {
            partyId: actor.partyId,
            participantId: actor.participantId,
            hadAddressId: Boolean(input.addressId),
            code: cause instanceof AgentError ? cause.code : undefined,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
        return {
          cartId,
          merchantId: input.option.merchant.id,
          deliveryMethodId: input.option.deliveryMethodId,
          paymentMethod: "SIMULATED",
          total: input.option.total,
          simulated: true,
          checkoutSimulated: true,
          ...(participantCoordinates ? { participantCoordinates } : {}),
        };
      }

      const client = cachedCallerFor(actor);
      const address = await resolveAddress(client, input.addressId);
      const cart = await prepareCart(client, { option: input.option, addressId: address.addressId });
      return {
        ...cart,
        simulated: false,
        ...(address.coordinates ? { participantCoordinates: address.coordinates } : {}),
      };
    },
    async submitOrder(actor, input) {
      if (checkoutMode === "simulated") {
        assertConsent(input.userConsent);
        if (demoCarts.get(input.cartId) !== ownerKey(actor)) {
          throw new AgentError("NOT_FOUND", "Carrinho não encontrado para este participante");
        }
        const orderId = `demo-${randomUUID()}`;
        demoOrders.set(orderId, { owner: ownerKey(actor), createdAt: Date.now() });
        return { orderId, simulated: true };
      }
      return { ...(await submitOrder(clientFor(actor), input)), simulated: false };
    },
    async trackOrder(actor, orderId) {
      if (checkoutMode === "simulated") {
        const order = demoOrders.get(orderId);
        if (!order || order.owner !== ownerKey(actor)) {
          throw new AgentError("NOT_FOUND", "Pedido de demonstração não encontrado");
        }
        return { ...simulatedTracking(orderId, order.createdAt), simulated: true };
      }
      return { ...(await trackOrder(clientFor(actor), orderId)), simulated: false };
    },
  };
}

async function resolveAddress(caller: ToolCaller, addressId?: string): Promise<IfoodAddress> {
  const addresses = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  return pickAddress(addresses.results ?? [], addressId);
}

async function resolveAddressCandidates(
  caller: ToolCaller,
  address: string,
): Promise<AddressResolutionResponse> {
  await caller.callTool("listAddresses");
  const result = await caller.callTool<Record<string, unknown>>("createAddress", { address });
  const rawCandidates = Array.isArray(result.candidates) ? result.candidates : [];
  const candidates = rawCandidates.flatMap((value): AddressCandidate[] => {
    if (typeof value !== "object" || value === null) return [];
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.candidateId !== "string" || typeof candidate.formattedAddress !== "string") {
      return [];
    }
    const location =
      typeof candidate.location === "object" && candidate.location !== null
        ? (candidate.location as Record<string, unknown>)
        : {};
    return [
      {
        candidateId: candidate.candidateId,
        formattedAddress: candidate.formattedAddress,
        ...(typeof location.neighborhood === "string"
          ? { neighborhood: location.neighborhood }
          : {}),
        ...(typeof location.city === "string" ? { city: location.city } : {}),
        ...(typeof location.state === "string" ? { state: location.state } : {}),
      },
    ];
  });
  const confidence = result.matchConfidence;
  const matchConfidence =
    candidates.length === 0
      ? "NONE"
      : confidence === "MULTIPLE" || candidates.length > 1
        ? "MULTIPLE"
        : "SINGLE";
  return { matchConfidence, candidates, simulated: false };
}

async function persistParticipantAddress(
  caller: ToolCaller,
  input: CreateParticipantAddressRequest,
): Promise<CreateParticipantAddressResponse> {
  await caller.callTool("listAddresses");
  const result = await caller.callTool<Record<string, unknown>>("createAddress", {
    address: input.address,
    candidateId: input.candidateId,
    ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
    ...(input.alias !== undefined ? { alias: input.alias } : {}),
    ...(input.complement !== undefined ? { complement: input.complement } : {}),
    ...(input.reference !== undefined ? { reference: input.reference } : {}),
  });
  if (typeof result.addressId !== "string" || result.addressId.length === 0) {
    throw new AgentError("ADDRESS_CREATION_FAILED", "O iFood não devolveu o endereço salvo");
  }
  const location =
    typeof result.location === "object" && result.location !== null
      ? (result.location as Record<string, unknown>)
      : {};
  const alias = typeof result.alias === "string" ? result.alias.trim() : "";
  const label =
    alias ||
    [location.neighborhood, location.city]
      .filter((part): part is string => typeof part === "string" && part.trim() !== "")
      .join(", ") ||
    "Endereço salvo";
  const agentHints =
    typeof result.agentHints === "object" && result.agentHints !== null
      ? (result.agentHints as Record<string, unknown>)
      : {};
  return {
    address: { addressId: result.addressId, label, isLastUsedAddress: false, ...participantAddressDetails(result) },
    alreadyExists: agentHints.alreadyExists === true,
    simulated: false,
  };
}

const DEMO_TIMELINE: Array<{ afterSeconds: number; code: string; description: string }> = [
  { afterSeconds: 0, code: "CONFIRMED", description: "Pedido confirmado pelo restaurante" },
  { afterSeconds: 4, code: "PREPARING", description: "O restaurante está preparando o pedido" },
  { afterSeconds: 8, code: "DISPATCHED", description: "Pedido saiu para entrega" },
  { afterSeconds: 12, code: "CONCLUDED", description: "Pedido entregue" },
];

function assertConsent(userConsent: boolean): void {
  if (!userConsent) {
    throw new CheckoutError("CONSENT_REQUIRED", "Confirme para continuar a demonstração");
  }
}

function simulatedTracking(
  orderId: string,
  createdAt: number,
  now: () => number = Date.now,
): OrderTracking {
  const elapsed = (now() - createdAt) / 1000;
  const step = [...DEMO_TIMELINE].reverse().find((entry) => elapsed >= entry.afterSeconds)!;
  const terminal = step.code === "CONCLUDED";
  return {
    orderId,
    statusCode: step.code,
    description: step.description,
    ...(terminal ? {} : { retryAfterSeconds: 2 }),
    terminal,
  };
}

/** Modo `demo`: opções capturadas e um pedido simulado que avança sozinho em 12 segundos. */
export function createDemoIntegration(now: () => number = Date.now): PartyAgentIntegration {
  const carts = new Map<string, { owner: string; option: LocalOption }>();
  const orders = new Map<string, { owner: string; createdAt: number }>();
  const demoAddresses = new Map<string, ParticipantAddress[]>();
  const demoCandidates = new Map<
    string,
    { owner: string; address: string; created?: ParticipantAddress }
  >();
  const ownerKey = (actor: ParticipantRef) => `${actor.partyId}\u0000${actor.participantId}`;

  const addressesFor = (owner: string) =>
    demoAddresses.get(owner) ?? [sanitizeAddress(SIMULATED_ADDRESS)];

  return {
    async listAddresses(actor) {
      return addressesFor(ownerKey(actor));
    },
    async resolveNewAddress(actor, input) {
      const owner = ownerKey(actor);
      const candidateId = `demo-${randomUUID()}`;
      demoCandidates.set(candidateId, { owner, address: input.address });
      return {
        matchConfidence: "SINGLE",
        candidates: [
          {
            candidateId,
            formattedAddress: `${input.address} (não validado; endereço simulado)`,
            neighborhood: "Centro",
            city: "São Carlos",
            state: "SP",
          },
        ],
        simulated: true,
      };
    },
    async createParticipantAddress(actor, input) {
      const owner = ownerKey(actor);
      const candidate = demoCandidates.get(input.candidateId);
      if (!candidate || candidate.owner !== owner || candidate.address !== input.address) {
        throw new AgentError("ADDRESS_NOT_FOUND", "Candidato de endereço não encontrado");
      }
      if (candidate.created) {
        return { address: candidate.created, alreadyExists: true, simulated: true };
      }
      const address: ParticipantAddress = {
        addressId: `demo-${randomUUID()}`,
        label: input.alias?.trim() || "Endereço de demonstração",
        isLastUsedAddress: false,
      };
      candidate.created = address;
      demoAddresses.set(owner, [...addressesFor(owner), address]);
      return { address, alreadyExists: false, simulated: true };
    },
    async resolveOptions(actor, input) {
      const fixture = await loadDiscoveryFixture();
      const output = await resolveOptions(
        {
          ...input,
          participantId: actor.participantId,
          addressId: undefined,
          queries: fixtureQueriesFor(fixture, input.queries),
        },
        fixtureCaller(fixture),
      );
      return { ...output, source: "simulated" };
    },
    async prepareCart(actor, input) {
      const cartId = randomUUID();
      carts.set(cartId, { owner: ownerKey(actor), option: input.option });
      return {
        cartId,
        merchantId: input.option.merchant.id,
        deliveryMethodId: input.option.deliveryMethodId,
        paymentMethod: "PIX",
        total: input.option.total,
        simulated: true,
      };
    },
    async submitOrder(actor, input) {
      // Mesma regra do modo real: a validação de consentimento vem antes de tudo.
      await submitOrder(
        { callTool: async <T>() => ({ orderId: "unused" }) as T },
        input,
      );
      const cart = carts.get(input.cartId);
      if (!cart || cart.owner !== ownerKey(actor)) {
        throw new AgentError("NOT_FOUND", "Carrinho não encontrado para este participante");
      }
      const orderId = randomUUID();
      orders.set(orderId, { owner: ownerKey(actor), createdAt: now() });
      return { orderId, simulated: true };
    },
    async trackOrder(actor, orderId) {
      const order = orders.get(orderId);
      if (!order || order.owner !== ownerKey(actor)) {
        throw new AgentError("NOT_FOUND", "Pedido não encontrado para este participante");
      }
      return {
        ...simulatedTracking(orderId, order.createdAt, now),
        simulated: true,
      };
    },
  };
}
