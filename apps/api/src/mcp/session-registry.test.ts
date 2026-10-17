import assert from "node:assert/strict";
import { test } from "node:test";

import { McpSessionRegistry, type McpTokenSession } from "./session-registry.js";

function tokens(label: string): McpTokenSession {
  return {
    accessToken: `access-${label}`,
    refreshToken: `refresh-${label}`,
    accessTokenExpiresAt: "2026-10-17T13:00:00.000Z",
  };
}

test("isolates OAuth tokens by Party and participant", () => {
  const registry = new McpSessionRegistry();

  registry.set("party-a", "ana", tokens("ana"));
  registry.set("party-a", "bruno", tokens("bruno"));
  registry.set("party-b", "ana", tokens("ana-other-party"));

  assert.deepEqual(registry.get("party-a", "ana"), tokens("ana"));
  assert.deepEqual(registry.get("party-a", "bruno"), tokens("bruno"));
  assert.deepEqual(registry.get("party-b", "ana"), tokens("ana-other-party"));
});

test("returns a copy so callers cannot mutate stored tokens", () => {
  const registry = new McpSessionRegistry();
  registry.set("party-a", "ana", tokens("ana"));

  const retrieved = registry.get("party-a", "ana");
  assert.ok(retrieved);
  retrieved.accessToken = "tampered";

  assert.equal(registry.get("party-a", "ana")?.accessToken, "access-ana");
});

test("deletes every participant token from one Party", () => {
  const registry = new McpSessionRegistry();
  registry.set("party-a", "ana", tokens("ana"));
  registry.set("party-a", "bruno", tokens("bruno"));
  registry.set("party-b", "caio", tokens("caio"));

  registry.deleteParty("party-a");

  assert.equal(registry.get("party-a", "ana"), undefined);
  assert.equal(registry.get("party-a", "bruno"), undefined);
  assert.deepEqual(registry.get("party-b", "caio"), tokens("caio"));
});

test("rejects incomplete OAuth token sets", () => {
  const registry = new McpSessionRegistry();
  assert.throws(
    () =>
      registry.set("party-a", "ana", {
        accessToken: "",
        refreshToken: "refresh",
        accessTokenExpiresAt: "2026-10-17T13:00:00.000Z",
      }),
    /OAuth token set is incomplete/,
  );
});
