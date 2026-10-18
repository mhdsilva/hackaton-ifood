import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChatClient, ChatMessage } from "../llm/client.js";
import {
  createLlmThemePlanner,
  parseThemePlan,
  themePlannerMessages,
} from "./theme-planner.js";

test("reads a free-form theme and its queries even inside a code fence", () => {
  const plan = parseThemePlan(
    'Claro! ```json\n{"theme":"Domingo de Massa","queries":["massa","pizza"],"reason":"  Maioria pediu algo quente.  "}\n```',
  );
  assert.deepEqual(plan, {
    theme: "Domingo de Massa",
    queries: ["massa", "pizza"],
    reason: "Maioria pediu algo quente.",
  });
});

test("accepts any theme, without a fixed catalog", () => {
  assert.deepEqual(parseThemePlan('{"theme":"Churrasco de Varanda","queries":["carne"]}'), {
    theme: "Churrasco de Varanda",
    queries: ["carne"],
  });
});

test("sanitizes and deduplicates the queries", () => {
  assert.deepEqual(
    parseThemePlan(
      '{"theme":"  Noite   Coreana ","queries":["  kimchi ","Kimchi","bibimbap",""," bulgogi ","tteokbokki"]}',
    ),
    {
      theme: "Noite Coreana",
      queries: ["kimchi", "bibimbap", "bulgogi", "tteokbokki"],
    },
  );
});

test("rejects incomplete or malformed responses", () => {
  assert.equal(parseThemePlan('{"theme":"churrasco"}'), undefined);
  assert.equal(parseThemePlan('{"theme":"churrasco","queries":[]}'), undefined);
  assert.equal(parseThemePlan('{"theme":"churrasco","queries":"carne"}'), undefined);
  assert.equal(parseThemePlan('{"theme":"","queries":["carne"]}'), undefined);
  assert.equal(parseThemePlan('{"theme":42,"queries":["carne"]}'), undefined);
  assert.equal(parseThemePlan(null), undefined);
  assert.equal(parseThemePlan("não sei"), undefined);
  assert.equal(parseThemePlan('{"theme":"italiano"'), undefined);
});

test("the prompt carries the time and only the group consensus, never personal data", () => {
  const messages = themePlannerMessages(
    [
      {
        address: "Rua das Flores, 10",
        budget: "ate-50",
        budget__value: 50,
        energy: "intensa-marcante",
        restrictions: ["veganismo"],
        restrictions__other: "sem coentro",
        exclusions: ["fritura"],
        cravings: ["picante", "crocante"],
      },
      { address: "casa", energy: "intensa-marcante", cravings: ["picante"] },
    ],
    new Date("2026-10-18T14:30:00-03:00"),
  );

  const system = messages[0].content ?? "";
  const user = messages[1].content ?? "";
  assert.match(system, /LIVRE/);
  assert.match(system, /Não existe lista de temas permitidos/);
  assert.match(system, /2 a 4 termos/);
  assert.match(system, /O tema é o consenso do grupo/);
  assert.equal(system.includes("veto"), false);
  assert.match(user, /Horário de referência: domingo, 18 de outubro de 2026/);
  assert.match(user, /14:30/);
  assert.match(user, /Participantes: 2/);
  assert.ok(user.includes("intensa-marcante"));
  assert.ok(user.includes("picante"));
  assert.equal(user.includes("crocante"), false, "desejo de uma pessoa só não vira tema");
  for (const personal of ["Rua das Flores", "__value", "ate-50", "veganismo", "sem coentro", "fritura"]) {
    assert.equal(user.includes(personal), false, `${personal} não deve chegar ao modelo`);
  }
});

test("without theme signals the model is not called", async () => {
  let called = false;
  const client: ChatClient = {
    async complete() {
      called = true;
      return { role: "assistant", content: '{"theme":"italiano","queries":["massa"]}' };
    },
  };

  await assert.rejects(async () =>
    createLlmThemePlanner(client)([{ address: "casa" }, { address: "praia" }]),
  );
  assert.equal(called, false);
});

test("the planner returns the model's free-form choice and queries", async () => {
  const calls: ChatMessage[][] = [];
  const client: ChatClient = {
    async complete(messages) {
      calls.push(messages);
      return {
        role: "assistant",
        content:
          '{"theme":"Domingo de Massa","queries":["massa","pizza"],"reason":"Grupo pediu algo quente."}',
      };
    },
  };

  const plan = await createLlmThemePlanner(client, {
    now: () => new Date("2026-10-18T14:30:00-03:00"),
  })([{ energy: "intensa-marcante" }, { energy: "intensa-marcante" }]);

  assert.deepEqual(plan, {
    theme: "Domingo de Massa",
    queries: ["massa", "pizza"],
    reason: "Grupo pediu algo quente.",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].role, "system");
  assert.match(calls[0][1].content ?? "", /domingo, 18 de outubro de 2026/);
});

test("an answer without queries fails so the caller can fall back", async () => {
  const client: ChatClient = {
    async complete() {
      return { role: "assistant", content: '{"theme":"Churrasco de Varanda"}' };
    },
  };

  await assert.rejects(async () => createLlmThemePlanner(client)([{ energy: "leve-refrescante" }, { energy: "leve-refrescante" }]));
});

test("a slow model times out", async () => {
  const client: ChatClient = {
    complete: () => new Promise<ChatMessage>(() => {}),
  };

  await assert.rejects(
    async () =>
      createLlmThemePlanner(client, { timeoutMs: 10 })([{ energy: "leve-refrescante" }, { energy: "leve-refrescante" }]),
    /tempo limite/,
  );
});

test("without a group consensus the model is not called, even if one person has signals", async () => {
  let called = false;
  const client: ChatClient = {
    async complete() {
      called = true;
      return { role: "assistant", content: '{"theme":"vegano","queries":["vegano"]}' };
    },
  };

  await assert.rejects(async () =>
    createLlmThemePlanner(client)([
      { restrictions: ["veganismo"], energy: "leve-refrescante" },
      { restrictions: [], energy: "intensa-marcante" },
    ]),
  );
  assert.equal(called, false);
});
