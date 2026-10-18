import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChatClient, ChatMessage } from "../llm/client.js";
import {
  createLlmThemePlanner,
  normalizeThemeCandidate,
  parseThemePlan,
  themePlannerMessages,
} from "./theme-planner.js";
import { knownThemes } from "./themes.js";

test("reads the theme JSON even inside a code fence", () => {
  const plan = parseThemePlan(
    'Claro! ```json\n{"theme":"Japonês","reason":"  Maioria pediu sushi.  "}\n```',
  );
  assert.deepEqual(plan, { theme: "japones", reason: "Maioria pediu sushi." });
});

test("rejects a theme outside the catalog", () => {
  assert.equal(parseThemePlan('{"theme":"churrasco"}'), undefined);
  assert.equal(parseThemePlan('{"theme":""}'), undefined);
  assert.equal(parseThemePlan('{"theme":42}'), undefined);
});

test("rejects malformed or empty responses", () => {
  assert.equal(parseThemePlan(null), undefined);
  assert.equal(parseThemePlan("não sei"), undefined);
  assert.equal(parseThemePlan('{"theme":"italiano"'), undefined);
});

test("accepts aliases the model might use", () => {
  assert.equal(normalizeThemeCandidate("italiana"), "italiano");
  assert.equal(normalizeThemeCandidate("comida japonesa"), "japones");
  assert.equal(normalizeThemeCandidate("saudável"), "saudavel");
  assert.equal(normalizeThemeCandidate("churrasco"), undefined);
});

test("the prompt carries each participant's signals but no personal data", () => {
  const messages = themePlannerMessages([
    { address: "Rua das Flores, 10", budget: "ate-50", budget__value: 50, energy: "picante" },
    { address: "casa", restrictions: ["vegetariano"] },
  ]);

  const system = messages[0].content ?? "";
  const user = messages[1].content ?? "";
  for (const theme of knownThemes()) {
    assert.ok(system.includes(theme), `o catálogo deve listar ${theme}`);
  }
  assert.equal(user.includes("Rua das Flores"), false);
  assert.equal(user.includes("__value"), false);
  assert.ok(user.includes("ate-50"));
  assert.ok(user.includes("vegetariano"));
  assert.equal((JSON.parse(user.slice(user.indexOf("["))) as unknown[]).length, 2);
});

test("without theme signals the model is not called", async () => {
  let called = false;
  const client: ChatClient = {
    async complete() {
      called = true;
      return { role: "assistant", content: '{"theme":"italiano"}' };
    },
  };

  await assert.rejects(async () =>
    createLlmThemePlanner(client)([{ address: "casa" }]),
  );
  assert.equal(called, false);
});

test("the planner returns the model's valid choice", async () => {
  const calls: ChatMessage[][] = [];
  const client: ChatClient = {
    async complete(messages) {
      calls.push(messages);
      return { role: "assistant", content: '{"theme":"arabe","reason":"Grupo pediu esfiha."}' };
    },
  };

  const plan = await createLlmThemePlanner(client)([{ energy: "intensa-marcante" }]);

  assert.deepEqual(plan, { theme: "arabe", reason: "Grupo pediu esfiha." });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].role, "system");
});

test("an out-of-catalog answer fails so the caller can fall back", async () => {
  const client: ChatClient = {
    async complete() {
      return { role: "assistant", content: '{"theme":"churrasco"}' };
    },
  };

  await assert.rejects(async () => createLlmThemePlanner(client)([{ energy: "surpreenda" }]));
});

test("a slow model times out", async () => {
  const client: ChatClient = {
    complete: () => new Promise<ChatMessage>(() => {}),
  };

  await assert.rejects(
    async () =>
      createLlmThemePlanner(client, { timeoutMs: 10 })([{ energy: "surpreenda" }]),
    /tempo limite/,
  );
});
