import assert from "node:assert/strict";
import { test } from "node:test";

import { McpSessionRegistry } from "./session-registry.js";

test("isolates keys by Party and participant", () => {
  const registry = new McpSessionRegistry();

  registry.set("party-a", "ana", "key-ana");
  registry.set("party-a", "bruno", "key-bruno");
  registry.set("party-b", "ana", "key-ana-other-party");

  assert.equal(registry.get("party-a", "ana"), "key-ana");
  assert.equal(registry.get("party-a", "bruno"), "key-bruno");
  assert.equal(registry.get("party-b", "ana"), "key-ana-other-party");
});

test("replaces only the key owned by the selected participant", () => {
  const registry = new McpSessionRegistry();
  registry.set("party-a", "ana", "old-key");
  registry.set("party-a", "bruno", "key-bruno");

  registry.set("party-a", "ana", "new-key");

  assert.equal(registry.get("party-a", "ana"), "new-key");
  assert.equal(registry.get("party-a", "bruno"), "key-bruno");
});

test("deletes all keys from one Party without affecting another", () => {
  const registry = new McpSessionRegistry();
  registry.set("party-a", "ana", "key-ana");
  registry.set("party-a", "bruno", "key-bruno");
  registry.set("party-b", "caio", "key-caio");

  registry.deleteParty("party-a");

  assert.equal(registry.get("party-a", "ana"), undefined);
  assert.equal(registry.get("party-a", "bruno"), undefined);
  assert.equal(registry.get("party-b", "caio"), "key-caio");
});

test("rejects blank keys", () => {
  const registry = new McpSessionRegistry();
  assert.throws(() => registry.set("party-a", "ana", "  "), /API key is required/);
});
