/**
 * Carrinho, pedido e rastreio de um participante (Marco D), sempre com a sessão MCP dele.
 *
 * Ordem exigida pelo iFood:
 *   createCart → getCartDeliveryMethods → setCartDelivery → listPaymentMethods
 *   → setCartPayment → getCart → (consentimento) → submitOrder → trackOrder
 *
 * A documentação não fixa os nomes de todos os campos de resposta do Cart MCP, então a
 * leitura é tolerante (`findValue`). `getOrder` não é usado: devolve endereço e código de
 * verificação, que não podem chegar ao estado público.
 */

import type { LocalOption, ToolCaller } from "../agent/types.js";

export class CheckoutError extends Error {
  constructor(
    readonly code:
      | "CONSENT_REQUIRED"
      | "CART_NOT_CREATED"
      | "NO_DELIVERY_METHOD"
      | "PAYMENT_METHOD_UNAVAILABLE"
      | "ORDER_NOT_CREATED",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface CartSummary {
  cartId: string;
  merchantId: string;
  deliveryMethodId: string;
  paymentMethod: string;
  /**
   * Valor final calculado pelo iFood depois de entrega e pagamento definidos. Pode diferir da
   * estimativa do agente: o iFood soma taxa de serviço e aplica benefícios só nesta etapa.
   */
  total?: number;
  breakdown?: {
    items?: number;
    delivery?: number;
    fees?: number;
    benefits?: number;
    vouchers?: number;
  };
}

function amount(summary: unknown, key: string): number | undefined {
  const value = findValue(summary, key);
  return typeof value === "number" ? value : undefined;
}

export interface OrderTracking {
  orderId: string;
  statusCode: string;
  /** Texto do iFood para mostrar ao participante; o `statusCode` é só para lógica. */
  description: string;
  /** Quando consultar de novo, ditado pelo servidor. */
  retryAfterSeconds?: number;
  terminal: boolean;
  /** Pix "copia e cola" enquanto o pagamento está pendente (só para o dono do pedido). */
  pixCode?: string;
}

const STATUS_TEXT: Record<string, string> = {
  PIX_CREATED: "Aguardando o pagamento via Pix",
};

/** Procura a primeira ocorrência de uma chave em profundidade. */
export function findValue(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findValue(entry, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (key in record && record[key] !== null) return record[key];
    for (const entry of Object.values(record)) {
      const found = findValue(entry, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Primeiro array de objetos que contenha a chave de identificação indicada. */
function findList(value: unknown, idKey: string): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    if (value.some((entry) => entry && typeof entry === "object" && idKey in entry)) {
      return value as Array<Record<string, unknown>>;
    }
    for (const entry of value) {
      const found = findList(entry, idKey);
      if (found.length > 0) return found;
    }
    return [];
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const found = findList(entry, idKey);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Itens no formato do `createCart`, com as escolhas obrigatórias já resolvidas pelo agente. */
export function cartItemsFrom(option: LocalOption) {
  return option.items.map((item) => ({
    itemId: item.itemId,
    quantity: item.quantity,
    options: item.selectedOptions.map((selected) => ({
      optionId: selected.optionId,
      quantity: 1,
    })),
  }));
}

/**
 * Cria o carrinho da opção escolhida e deixa entrega e pagamento definidos.
 * Não envia pedido nem cobra nada.
 */
export async function prepareCart(
  caller: ToolCaller,
  input: { option: LocalOption; addressId: string; paymentPreference?: RegExp },
): Promise<CartSummary> {
  const merchantId = input.option.merchant.id;
  const created = await caller.callTool("createCart", {
    merchantId,
    addressId: input.addressId,
    items: cartItemsFrom(input.option),
  });
  const cartId = findValue(created, "cartId");
  if (typeof cartId !== "string") {
    throw new CheckoutError("CART_NOT_CREATED", "O iFood não devolveu o carrinho");
  }

  const methods = findList(
    await caller.callTool("getCartDeliveryMethods", { cartId }),
    "deliveryMethodId",
  );
  const delivery =
    methods.find((method) => method.deliveryMethodId === input.option.deliveryMethodId) ??
    methods.find((method) => method.deliveryMethodMode !== "TAKEOUT") ??
    methods[0];
  if (!delivery) {
    throw new CheckoutError("NO_DELIVERY_METHOD", "Nenhuma forma de entrega disponível agora");
  }
  const deliveryMethodId = String(delivery.deliveryMethodId);
  await caller.callTool("setCartDelivery", { cartId, deliveryMethodId });

  const payments = findList(
    await caller.callTool("listPaymentMethods", { merchantId }),
    "paymentMethodId",
  );
  const preference = input.paymentPreference ?? /pix/i;
  // Formato real: { paymentMethodId, kind: "PIX", displayName: "Pix", brand: "PIX" }.
  const payment = payments.find((method) =>
    preference.test(
      [method.kind, method.displayName, method.brand, method.name, method.type]
        .filter((part) => typeof part === "string")
        .join(" "),
    ),
  );
  if (!payment) {
    throw new CheckoutError(
      "PAYMENT_METHOD_UNAVAILABLE",
      "A forma de pagamento escolhida não está disponível neste restaurante",
    );
  }
  await caller.callTool("setCartPayment", {
    cartId,
    paymentMethodId: String(payment.paymentMethodId),
  });

  // A resposta do carrinho traz rua e número do endereço: só os valores saem daqui.
  const summary = findValue(await caller.callTool("getCart", { cartId }), "summary");
  const total = amount(summary, "totalAmount");
  const breakdown = {
    items: amount(summary, "subtotalAmount"),
    delivery: amount(summary, "deliveryFeeAmount"),
    fees: amount(summary, "feeTotalAmount"),
    benefits: amount(summary, "benefitsTotalAmount"),
    vouchers: amount(summary, "voucherTotalAmount"),
  };
  const knownBreakdown = Object.fromEntries(
    Object.entries(breakdown).filter(([, value]) => value !== undefined),
  );
  return {
    cartId,
    merchantId,
    deliveryMethodId,
    paymentMethod: String(payment.displayName ?? payment.kind ?? payment.name ?? "PIX"),
    ...(total !== undefined ? { total } : {}),
    ...(Object.keys(knownBreakdown).length > 0 ? { breakdown: knownBreakdown } : {}),
  };
}

/** Envia o pedido. Recusa localmente, sem chamar o iFood, se o participante não consentiu. */
export async function submitOrder(
  caller: ToolCaller,
  input: { cartId: string; userConsent: boolean },
): Promise<{ orderId: string }> {
  if (input.userConsent !== true) {
    throw new CheckoutError(
      "CONSENT_REQUIRED",
      "O pedido só é enviado com a confirmação do próprio participante",
    );
  }
  const result = await caller.callTool("submitOrder", {
    cartId: input.cartId,
    userConsent: true,
  });
  const orderId = findValue(result, "orderId");
  if (typeof orderId !== "string") {
    throw new CheckoutError("ORDER_NOT_CREATED", "O iFood não confirmou o pedido");
  }
  return { orderId };
}

/** Status resumido para a Party, seguindo a cadência que o próprio iFood indica. */
export async function trackOrder(caller: ToolCaller, orderId: string): Promise<OrderTracking> {
  const result = (await caller.callTool("trackOrder", { orderId })) as {
    status?: { code?: string; description?: string };
    agentHints?: { retryMessage?: string | null; pollingStop?: boolean | null };
  };
  const retry = result.agentHints?.retryMessage?.match(/(\d+)\s*(second|segundo|s\b)/i);
  const statusCode = result.status?.code ?? "UNKNOWN";
  const rawDescription = result.status?.description ?? "Status indisponível";
  // Formato real: "Event published when PIX is created - QR Code: 000201…"
  const pixCode = rawDescription.match(/QR Code:\s*(\S+)/i)?.[1];
  return {
    orderId,
    statusCode,
    description: STATUS_TEXT[statusCode] ?? (pixCode ? "Aguardando o pagamento" : rawDescription),
    ...(retry ? { retryAfterSeconds: Number(retry[1]) } : {}),
    terminal: result.agentHints?.pollingStop === true,
    ...(pixCode ? { pixCode } : {}),
  };
}
