import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChatClient, ChatMessage } from "../llm/client.js";
import { ifoodToolbox, runPlanner } from "./planner.js";
import type { IfoodAddress, ToolCaller } from "./types.js";

function assistant(
  call: { id?: string; name: string; args: string } | null,
  text = "",
): ChatMessage {
  if (!call) return { role: "assistant", content: text };
  return {
    role: "assistant",
    content: text || null,
    tool_calls: [
      { id: call.id ?? "call_1", type: "function", function: { name: call.name, arguments: call.args } },
    ],
  };
}

function scripted(responses: ChatMessage[]): ChatClient {
  let index = 0;
  return {
    async complete() {
      const reply = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return reply;
    },
  };
}

test("runs an allowlisted tool and returns the final answer", async () => {
  const seen: unknown[] = [];
  const outcome = await runPlanner(
    scripted([
      assistant({ name: "echo", args: JSON.stringify({ x: 1 }) }),
      assistant(null, "pronto"),
    ]),
    {
      echo: {
        description: "eco",
        parameters: { type: "object" },
        run: async (args) => {
          seen.push(args);
          return { got: args.x };
        },
      },
    },
    [{ role: "user", content: "faça" }],
  );

  assert.equal(outcome.stoppedBy, "final");
  assert.equal(outcome.finalText, "pronto");
  assert.deepEqual(seen, [{ x: 1 }]);
  assert.deepEqual(outcome.steps[0], { tool: "echo", args: { x: 1 }, result: { got: 1 } });
});

test("feeds the tool result back to the model as a tool message", async () => {
  const seen: ChatMessage[][] = [];
  const responses = [
    assistant({ name: "echo", args: JSON.stringify({ n: 2 }) }),
    assistant(null, "fim"),
  ];
  let index = 0;
  const client: ChatClient = {
    async complete(messages) {
      seen.push(messages.map((message) => ({ ...message })));
      return responses[index++];
    },
  };

  await runPlanner(
    client,
    {
      echo: {
        description: "e",
        parameters: {},
        run: async (args) => ({ doubled: Number(args.n) * 2 }),
      },
    },
    [{ role: "user", content: "dobre" }],
  );

  const toolMessage = seen[1].find((message) => message.role === "tool");
  assert.equal(toolMessage?.tool_call_id, "call_1");
  assert.match(toolMessage?.content ?? "", /doubled/);
});

test("blocks a tool outside the allowlist without running it", async () => {
  let ran = false;
  const outcome = await runPlanner(
    scripted([assistant({ name: "deleteEverything", args: "{}" }), assistant(null, "ok")]),
    {
      safe: {
        description: "s",
        parameters: {},
        run: async () => {
          ran = true;
        },
      },
    },
    [{ role: "user", content: "x" }],
  );

  assert.equal(outcome.steps[0].error, "tool_not_allowed");
  assert.equal(ran, false);
});

test("reports invalid JSON arguments without running the tool", async () => {
  let ran = false;
  const outcome = await runPlanner(
    scripted([assistant({ name: "echo", args: "{oops" }), assistant(null, "ok")]),
    {
      echo: {
        description: "e",
        parameters: {},
        run: async () => {
          ran = true;
        },
      },
    },
    [{ role: "user", content: "x" }],
  );

  assert.equal(outcome.steps[0].error, "invalid_arguments");
  assert.equal(ran, false);
});

test("a failing tool becomes an error step and the loop continues", async () => {
  const outcome = await runPlanner(
    scripted([assistant({ name: "boom", args: "{}" }), assistant(null, "segui")]),
    {
      boom: {
        description: "b",
        parameters: {},
        run: async () => {
          throw new Error("explodiu");
        },
      },
    },
    [{ role: "user", content: "x" }],
  );

  assert.equal(outcome.stoppedBy, "final");
  assert.equal(outcome.steps[0].error, "explodiu");
});

test("stops at maxSteps when the model keeps calling tools", async () => {
  const client: ChatClient = {
    async complete() {
      return assistant({ name: "echo", args: "{}" });
    },
  };

  const outcome = await runPlanner(
    client,
    { echo: { description: "e", parameters: {}, run: async () => "ok" } },
    [{ role: "user", content: "x" }],
    { maxSteps: 2 },
  );

  assert.equal(outcome.stoppedBy, "max_steps");
  assert.equal(outcome.steps.length, 2);
});

test("stops on timeout instead of hanging the Party", async () => {
  let clock = 1_000;
  const client: ChatClient = {
    async complete() {
      clock += 100;
      return assistant({ name: "echo", args: "{}" });
    },
  };

  const outcome = await runPlanner(
    client,
    { echo: { description: "e", parameters: {}, run: async () => "ok" } },
    [{ role: "user", content: "x" }],
    { maxSteps: 10, timeoutMs: 50, now: () => clock },
  );

  assert.equal(outcome.stoppedBy, "timeout");
  assert.equal(outcome.steps.length, 1);
});

const address: IfoodAddress = {
  addressId: "addr-1",
  alias: "Casa",
  location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
  coordinates: { latitude: -22.01, longitude: -47.89 },
};

test("ifoodToolbox hides coordinates and injects the participant location", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const caller: ToolCaller = {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      calls.push({ name, args });
      if (name === "listAddresses") return { results: [address] } as T;
      if (name === "searchOffers") return { results: [{ itemId: "i1" }] } as T;
      throw new Error("tool inesperada");
    },
  };

  const toolbox = ifoodToolbox(caller);

  const addresses = await toolbox.listAddresses.run({});
  assert.deepEqual(addresses, {
    results: [{ addressId: "addr-1", label: "Casa", isLastUsedAddress: false }],
  });

  const search = await toolbox.searchOffers.run({ query: "pizza" });
  assert.deepEqual(search, { results: [{ itemId: "i1" }] });
  const searchArgs = calls.find((call) => call.name === "searchOffers")!.args;
  assert.deepEqual(searchArgs.userLocation, { latitude: -22.01, longitude: -47.89 });
  assert.equal(searchArgs.query, "pizza");
  assert.equal((searchArgs.refinements as { onlyOpen: boolean }).onlyOpen, true);
});

test("searchOffers rejects a missing query", async () => {
  const caller: ToolCaller = {
    async callTool<T>(): Promise<T> {
      return { results: [address] } as T;
    },
  };

  await assert.rejects(ifoodToolbox(caller).searchOffers.run({}), /query é obrigatória/);
});

test("getUserProfile strips personal data before the model sees it", async () => {
  const caller: ToolCaller = {
    async callTool<T>(name: string): Promise<T> {
      if (name === "getUser") {
        return {
          success: true,
          name: "Ana Silva",
          email: "ana@example.com",
          preferences: { vegetariano: false, apimentado: "medio" },
        } as T;
      }
      throw new Error(`tool inesperada: ${name}`);
    },
  };

  const profile = await ifoodToolbox(caller).getUserProfile.run({});
  assert.deepEqual(profile, { success: true, preferences: { vegetariano: false, apimentado: "medio" } });
});

test("getRecommendations injects the participant location", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const caller: ToolCaller = {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      if (name === "listAddresses") return { results: [address] } as T;
      if (name === "getRecommendations") {
        calls.push(args);
        return { results: [{ itemId: "r1" }] } as T;
      }
      throw new Error(`tool inesperada: ${name}`);
    },
  };

  const output = await ifoodToolbox(caller).getRecommendations.run({ pageSize: 5 });
  assert.deepEqual(output, { results: [{ itemId: "r1" }] });
  assert.deepEqual(calls[0].userLocation, { latitude: -22.01, longitude: -47.89 });
  assert.equal(calls[0].pageSize, 5);
});
