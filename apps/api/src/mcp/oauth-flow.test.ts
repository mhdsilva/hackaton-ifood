import assert from "node:assert/strict";
import { test } from "node:test";

import {
  McpOAuthError,
  McpOAuthFlow,
  type McpOAuthProvider,
  type OAuthAuthorizationInput,
  type OAuthExchangeInput,
} from "./oauth-flow.js";
import { McpSessionRegistry } from "./session-registry.js";

class RecordingProvider implements McpOAuthProvider {
  readonly mode = "demo" as const;
  authorization?: OAuthAuthorizationInput;
  exchange?: OAuthExchangeInput;

  createAuthorizationUrl(input: OAuthAuthorizationInput): string {
    this.authorization = input;
    return `https://auth.example/authorize?state=${encodeURIComponent(input.state)}`;
  }

  async exchangeCode(input: OAuthExchangeInput) {
    this.exchange = input;
    return {
      accessToken: "private-access-token",
      refreshToken: "private-refresh-token",
      expiresInSeconds: 3600,
    };
  }
}

test("creates a PKCE authorization and stores tokens only after callback", async () => {
  const provider = new RecordingProvider();
  const sessions = new McpSessionRegistry();
  const flow = new McpOAuthFlow(provider, sessions);

  const started = flow.start({ partyId: "party-a", participantId: "ana" });

  assert.equal(started.status, "validating");
  assert.equal(started.mode, "demo");
  assert.equal(flow.mode, "demo");
  assert.match(started.authorizationUrl, /^https:\/\/auth\.example\/authorize/);
  assert.ok(provider.authorization);
  assert.equal(provider.authorization.codeChallengeMethod, "S256");
  assert.match(provider.authorization.codeChallenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sessions.get("party-a", "ana"), undefined);

  const completed = await flow.complete({
    partyId: "party-a",
    state: provider.authorization.state,
    code: "authorization-code",
  });

  assert.deepEqual(completed, { partyId: "party-a", participantId: "ana" });
  assert.equal(provider.exchange?.code, "authorization-code");
  assert.match(provider.exchange?.codeVerifier ?? "", /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sessions.get("party-a", "ana")?.accessToken, "private-access-token");
  assert.equal(sessions.get("party-a", "ana")?.refreshToken, "private-refresh-token");
});

test("consumes state once to prevent callback replay", async () => {
  const provider = new RecordingProvider();
  const flow = new McpOAuthFlow(provider, new McpSessionRegistry());
  flow.start({ partyId: "party-a", participantId: "ana" });
  assert.ok(provider.authorization);

  await flow.complete({
    partyId: "party-a",
    state: provider.authorization.state,
    code: "first-code",
  });

  await assert.rejects(
    () =>
      flow.complete({
        partyId: "party-a",
        state: provider.authorization!.state,
        code: "replayed-code",
      }),
    (error: unknown) =>
      error instanceof McpOAuthError && error.code === "OAUTH_STATE_INVALID",
  );
});

test("rejects an expired state without calling the provider", async () => {
  let now = Date.parse("2026-10-17T12:00:00.000Z");
  const provider = new RecordingProvider();
  const sessions = new McpSessionRegistry();
  const flow = new McpOAuthFlow(provider, sessions, () => now, 1_000);
  flow.start({ partyId: "party-a", participantId: "ana" });
  assert.ok(provider.authorization);
  now += 1_001;

  await assert.rejects(
    () =>
      flow.complete({
        partyId: "party-a",
        state: provider.authorization!.state,
        code: "late-code",
      }),
    (error: unknown) =>
      error instanceof McpOAuthError && error.code === "OAUTH_STATE_INVALID",
  );
  assert.equal(provider.exchange, undefined);
  assert.equal(sessions.get("party-a", "ana"), undefined);
});

test("a new authorization invalidates the previous attempt for the same participant", async () => {
  const provider = new RecordingProvider();
  const flow = new McpOAuthFlow(provider, new McpSessionRegistry());
  flow.start({ partyId: "party-a", participantId: "ana" });
  const firstState = provider.authorization?.state;
  flow.start({ partyId: "party-a", participantId: "ana" });
  assert.ok(firstState);

  await assert.rejects(
    () =>
      flow.complete({
        partyId: "party-a",
        state: firstState,
        code: "old-code",
      }),
    (error: unknown) =>
      error instanceof McpOAuthError && error.code === "OAUTH_STATE_INVALID",
  );
});

test("wraps provider failures without exposing their message and identifies the participant", async () => {
  const provider = new RecordingProvider();
  provider.exchangeCode = async () => {
    throw new Error("response contained secret-token-value");
  };
  const flow = new McpOAuthFlow(provider, new McpSessionRegistry());
  flow.start({ partyId: "party-a", participantId: "ana" });
  assert.ok(provider.authorization);

  await assert.rejects(
    () =>
      flow.complete({
        partyId: "party-a",
        state: provider.authorization!.state,
        code: "failed-code",
      }),
    (error: unknown) => {
      assert.ok(error instanceof McpOAuthError);
      assert.equal(error.code, "OAUTH_EXCHANGE_FAILED");
      assert.deepEqual(error.actor, { partyId: "party-a", participantId: "ana" });
      assert.equal(error.message.includes("secret-token-value"), false);
      return true;
    },
  );
});

test("turns provider cancellation into a sanitized one-time error", async () => {
  const provider = new RecordingProvider();
  const flow = new McpOAuthFlow(provider, new McpSessionRegistry());
  flow.start({ partyId: "party-a", participantId: "ana" });
  assert.ok(provider.authorization);
  const state = provider.authorization.state;

  await assert.rejects(
    () =>
      flow.complete({
        partyId: "party-a",
        state,
        providerError: "access_denied_with_private_details",
      }),
    (error: unknown) => {
      assert.ok(error instanceof McpOAuthError);
      assert.equal(error.code, "OAUTH_ACCESS_DENIED");
      assert.deepEqual(error.actor, { partyId: "party-a", participantId: "ana" });
      assert.equal(error.message.includes("private_details"), false);
      return true;
    },
  );
  await assert.rejects(
    () =>
      flow.complete({
        partyId: "party-a",
        state,
        code: "late-code",
      }),
    (error: unknown) =>
      error instanceof McpOAuthError && error.code === "OAUTH_STATE_INVALID",
  );
});
