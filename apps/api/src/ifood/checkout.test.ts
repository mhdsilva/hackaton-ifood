import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { LocalOption, ResolveOptionsOutput, ToolCaller } from "../agent/types.js";
import {
  CheckoutError,
  cartItemsFrom,
  findValue,
  prepareCart,
  submitOrder,
  trackOrder,
} from "./checkout.js";

const sample = JSON.parse(
  readFileSync(new URL("../../../../fixtures/options-italiano.json", import.meta.url), "utf8"),
) as ResolveOptionsOutput;
const pizza: LocalOption = sample.options[0];

function recordingCaller(responses: Record<string, unknown>) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const caller: ToolCaller = {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      calls.push({ name, args });
      if (!(name in responses)) throw new Error(`unexpected tool ${name}`);
      return responses[name] as T;
    },
  };
  return { caller, calls };
}

/** Respostas reais do Cart MCP, capturadas em 17/10/2026. */
const realCart = JSON.parse(
  readFileSync(new URL("../../../../fixtures/ifood-cart-italiano.json", import.meta.url), "utf8"),
);
const happyResponses = {
  createCart: realCart.createCart,
  getCartDeliveryMethods: realCart.getCartDeliveryMethods,
  setCartDelivery: realCart.getCart,
  listPaymentMethods: realCart.listPaymentMethods,
  setCartPayment: realCart.getCart,
  getCart: {
    ...realCart.getCart,
    deliveryAddress: { streetName: "Rua Privada", streetNumber: "123" },
  },
};
const CART_ID = "3901f018-d1c8-4ac1-9c08-ffd349dd9d2a";
const PIX_ID = "75354fd8-e916-41db-9286-93be2232efe2";

test("cart items carry the required options chosen by the agent", () => {
  assert.deepEqual(cartItemsFrom(pizza), [
    {
      itemId: pizza.items[0].itemId,
      quantity: 2,
      options: pizza.items[0].selectedOptions.map((option) => ({
        optionId: option.optionId,
        quantity: 1,
      })),
    },
  ]);
});

test("prepares the cart in the order iFood requires and picks Pix, without submitting", async () => {
  const { caller, calls } = recordingCaller(happyResponses);

  const cart = await prepareCart(caller, { option: pizza, addressId: "address-1" });

  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "createCart",
      "getCartDeliveryMethods",
      "setCartDelivery",
      "listPaymentMethods",
      "setCartPayment",
      "getCart",
    ],
  );
  assert.equal(calls[0].args.addressId, "address-1");
  assert.equal(calls[0].args.merchantId, pizza.merchant.id);
  assert.equal(calls[2].args.deliveryMethodId, "DEFAULT");
  assert.equal(calls[4].args.paymentMethodId, PIX_ID);
  assert.deepEqual(cart, {
    cartId: CART_ID,
    merchantId: pizza.merchant.id,
    deliveryMethodId: "DEFAULT",
    paymentMethod: "Pix",
    total: 26.72,
    breakdown: { items: 50.9, delivery: 0, fees: 1.27, benefits: 25.45, vouchers: 0 },
  });
  assert.equal(JSON.stringify(cart).includes("Rua Privada"), false);
});

test("never chooses takeout when delivery is available", async () => {
  const { caller, calls } = recordingCaller(happyResponses);
  await prepareCart(caller, {
    option: { ...pizza, deliveryMethodId: "UNKNOWN" },
    addressId: "address-1",
  });
  assert.equal(calls[2].args.deliveryMethodId, "DEFAULT");
});

test("fails clearly when Pix is not offered", async () => {
  const { caller } = recordingCaller({
    ...happyResponses,
    listPaymentMethods: {
      paymentMethods: [{ paymentMethodId: "pm-card", kind: "CREDIT", displayName: "Crédito" }],
    },
  });

  await assert.rejects(
    prepareCart(caller, { option: pizza, addressId: "address-1" }),
    (error: unknown) =>
      error instanceof CheckoutError && error.code === "PAYMENT_METHOD_UNAVAILABLE",
  );
});

test("never calls submitOrder without explicit consent", async () => {
  const { caller, calls } = recordingCaller({ submitOrder: { orderId: "order-1" } });

  for (const userConsent of [false, undefined, "true"] as unknown[]) {
    await assert.rejects(
      submitOrder(caller, { cartId: "cart-1", userConsent: userConsent as boolean }),
      (error: unknown) => error instanceof CheckoutError && error.code === "CONSENT_REQUIRED",
    );
  }
  assert.equal(calls.length, 0);

  assert.deepEqual(await submitOrder(caller, { cartId: "cart-1", userConsent: true }), {
    orderId: "order-1",
  });
  assert.deepEqual(calls[0].args, { cartId: "cart-1", userConsent: true });
});

test("tracking follows the server cadence and stops at the terminal state", async () => {
  const live = recordingCaller({
    trackOrder: {
      status: { code: "DISPATCHED", description: "Merchant released order for delivery." },
      agentHints: { retryMessage: "Please call again in 60 seconds for updates", pollingStop: null },
    },
  });
  assert.deepEqual(await trackOrder(live.caller, "order-1"), {
    orderId: "order-1",
    statusCode: "DISPATCHED",
    description: "Merchant released order for delivery.",
    retryAfterSeconds: 60,
    terminal: false,
  });

  const done = recordingCaller({
    trackOrder: {
      status: { code: "CONCLUDED", description: "Order delivered." },
      agentHints: { retryMessage: null, pollingStop: true },
    },
  });
  assert.equal((await trackOrder(done.caller, "order-1")).terminal, true);
});

test("real unpaid Pix order: readable status and the Pix code in its own field", async () => {
  const { caller } = recordingCaller({ trackOrder: realCart.trackOrderPixCreated });

  const tracking = await trackOrder(caller, "order-1");

  assert.equal(tracking.statusCode, "PIX_CREATED");
  assert.equal(tracking.description, "Aguardando o pagamento via Pix");
  assert.match(tracking.pixCode ?? "", /^000201/);
  assert.equal(tracking.retryAfterSeconds, 60);
  assert.equal(tracking.terminal, false);
});

test("real submitOrder response yields the orderId", async () => {
  const { caller } = recordingCaller({ submitOrder: realCart.submitOrder });
  assert.deepEqual(await submitOrder(caller, { cartId: CART_ID, userConsent: true }), {
    orderId: realCart.submitOrder.orderId,
  });
});

test("findValue reads nested fields from unknown response shapes", () => {
  assert.equal(findValue({ a: [{ b: { cartId: "x" } }] }, "cartId"), "x");
  assert.equal(findValue({ cartId: null, nested: { cartId: "y" } }, "cartId"), "y");
  assert.equal(findValue({ a: 1 }, "cartId"), undefined);
});
