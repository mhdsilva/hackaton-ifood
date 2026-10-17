/**
 * Liga o agente e o cliente MCP ao servidor da Party sem que o `server.ts` conheça o iFood.
 * O servidor recebe funções prontas: validar a conexão, resolver opções e conduzir
 * carrinho, pedido e rastreio de um participante.
 */

import { randomUUID } from "node:crypto";

import type { McpConnectionStatus } from "@sidequest/contracts";

import {
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
import { fixtureCaller, loadDiscoveryFixture, resolveOptionsWithFallback } from "./fallback.js";
import { AgentError, pickAddress } from "./pick-address.js";
import { resolveOptions } from "./resolve-options.js";
import type {
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
  validateConnection?(actor: ParticipantRef): Promise<Extract<McpConnectionStatus, "connected" | "error">>;
  resolveOptions(
    actor: ParticipantRef,
    input: Omit<ResolveOptionsInput, "participantId">,
  ): Promise<ResolveOptionsOutput>;
  prepareCart?(
    actor: ParticipantRef,
    input: { option: LocalOption; addressId?: string },
  ): Promise<CartSummary & { simulated: boolean }>;
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
}): PartyAgentIntegration {
  const clientFor = (actor: ParticipantRef): IfoodMcpClient => {
    const session = deps.sessions.get(actor.partyId, actor.participantId);
    if (!session) {
      throw new AgentError("MCP_NOT_CONNECTED", "Conecte sua conta do iFood antes de continuar");
    }
    return new IfoodMcpClient({
      session,
      ...(deps.mcpUrl ? { mcpUrl: deps.mcpUrl } : {}),
      ...(deps.provider.refreshTokens
        ? { refreshTokens: (token: string) => deps.provider.refreshTokens!(token) }
        : {}),
      onSessionRefreshed: (next) => deps.sessions.set(actor.partyId, actor.participantId, next),
    });
  };

  return {
    async validateConnection(actor) {
      try {
        return await validateConnection(clientFor(actor));
      } catch {
        return "error";
      }
    },
    resolveOptions(actor, input) {
      return resolveOptionsWithFallback(
        { ...input, participantId: actor.participantId },
        clientFor(actor),
      );
    },
    async prepareCart(actor, input) {
      const client = clientFor(actor);
      const addressId = await resolveAddressId(client, input.addressId);
      return { ...(await prepareCart(client, { option: input.option, addressId })), simulated: false };
    },
    async submitOrder(actor, input) {
      return { ...(await submitOrder(clientFor(actor), input)), simulated: false };
    },
    async trackOrder(actor, orderId) {
      return { ...(await trackOrder(clientFor(actor), orderId)), simulated: false };
    },
  };
}

async function resolveAddressId(caller: ToolCaller, addressId?: string): Promise<string> {
  const addresses = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  return pickAddress(addresses.results ?? [], addressId).addressId;
}

const DEMO_TIMELINE: Array<{ afterSeconds: number; code: string; description: string }> = [
  { afterSeconds: 0, code: "CONFIRMED", description: "Pedido confirmado pelo restaurante" },
  { afterSeconds: 20, code: "PREPARING", description: "O restaurante está preparando o pedido" },
  { afterSeconds: 40, code: "DISPATCHED", description: "Pedido saiu para entrega" },
  { afterSeconds: 60, code: "CONCLUDED", description: "Pedido entregue" },
];

/** Modo `demo`: opções capturadas e um pedido simulado que avança sozinho em ~1 minuto. */
export function createDemoIntegration(now: () => number = Date.now): PartyAgentIntegration {
  const carts = new Map<string, { owner: string; option: LocalOption }>();
  const orders = new Map<string, { owner: string; createdAt: number }>();
  const ownerKey = (actor: ParticipantRef) => `${actor.partyId}\u0000${actor.participantId}`;

  return {
    async resolveOptions(actor, input) {
      const output = await resolveOptions(
        { ...input, participantId: actor.participantId, addressId: undefined },
        fixtureCaller(await loadDiscoveryFixture()),
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
      const elapsed = (now() - order.createdAt) / 1000;
      const step = [...DEMO_TIMELINE].reverse().find((entry) => elapsed >= entry.afterSeconds)!;
      const terminal = step.code === "CONCLUDED";
      return {
        orderId,
        statusCode: step.code,
        description: step.description,
        ...(terminal ? {} : { retryAfterSeconds: 5 }),
        terminal,
        simulated: true,
      };
    },
  };
}
