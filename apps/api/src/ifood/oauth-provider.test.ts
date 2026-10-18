import assert from "node:assert/strict";
import { test } from "node:test";

import { loadIfoodConfig } from "./config.js";
import { IfoodOAuthError } from "./oauth-errors.js";
import { IfoodMcpOAuthProvider } from "./oauth-provider.js";
import { needsRefresh } from "./token-refresh.js";

const SECRET = "super-secret-value";
const config = loadIfoodConfig({
  IFOOD_CLIENT_ID: "client-id",
  IFOOD_CLIENT_SECRET: SECRET,
  PUBLIC_API_URL: "https://api.example",
});

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
  form: URLSearchParams;
}

function fakeFetch(status: number, body: unknown) {
  const requests: RecordedRequest[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      form: new URLSearchParams(String(init?.body)),
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return { fetchImpl, requests };
}

test("builds the iFood authorize URL with PKCE, state, resource and the single callback", () => {
  const provider = new IfoodMcpOAuthProvider(config);
  const url = new URL(
    provider.createAuthorizationUrl({
      partyId: "party-a",
      state: "state-123",
      codeChallenge: "challenge-abc",
      codeChallengeMethod: "S256",
    }),
  );

  assert.equal(url.origin + url.pathname, "https://id.ifood.com.br/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://api.example/mcp-connection/callback",
  );
  assert.equal(url.searchParams.get("code_challenge"), "challenge-abc");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(
    url.searchParams.get("resource"),
    "https://consumer-mcp.ifood.com.br/marketplace",
  );
  assert.equal(url.searchParams.has("client_secret"), false);
});

test("exchanges the code with Basic auth and maps the token response", async () => {
  const { fetchImpl, requests } = fakeFetch(200, {
    access_token: "access-1",
    refresh_token: "refresh-1",
    expires_in: 3600,
    refresh_expires_in: 2592000,
    scope: "mcp.user mcp.cart",
  });
  const provider = new IfoodMcpOAuthProvider(config, fetchImpl);

  const tokens = await provider.exchangeCode({ code: "code-1", codeVerifier: "verifier-1" });

  assert.deepEqual(tokens, {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresInSeconds: 3600,
    refreshTokenExpiresInSeconds: 2592000,
    scopes: ["mcp.user", "mcp.cart"],
  });
  const [request] = requests;
  assert.equal(request.url, "https://id.ifood.com.br/token");
  assert.equal(
    request.headers.Authorization,
    `Basic ${Buffer.from(`client-id:${SECRET}`).toString("base64")}`,
  );
  assert.equal(request.form.get("grant_type"), "authorization_code");
  assert.equal(request.form.get("code"), "code-1");
  assert.equal(request.form.get("code_verifier"), "verifier-1");
  assert.equal(request.form.get("redirect_uri"), "https://api.example/mcp-connection/callback");
  assert.equal(request.form.has("client_secret"), false);
});

test("refresh keeps the previous refresh token when the server does not rotate it", async () => {
  const { fetchImpl, requests } = fakeFetch(200, { access_token: "access-2", expires_in: 1800 });
  const provider = new IfoodMcpOAuthProvider(config, fetchImpl);

  const tokens = await provider.refreshTokens("refresh-1");

  assert.equal(tokens.accessToken, "access-2");
  assert.equal(tokens.refreshToken, "refresh-1");
  assert.equal(tokens.expiresInSeconds, 1800);
  assert.equal(requests[0].form.get("grant_type"), "refresh_token");
  assert.equal(requests[0].form.get("refresh_token"), "refresh-1");
});

for (const [status, oauthError, expected] of [
  [401, "invalid_client", "INVALID_CLIENT"],
  [400, "invalid_grant", "INVALID_GRANT"],
  [503, undefined, "UNAVAILABLE"],
] as const) {
  test(`classifies HTTP ${status} as ${expected} without leaking secrets`, async () => {
    const { fetchImpl } = fakeFetch(status, oauthError ? { error: oauthError } : {});
    const provider = new IfoodMcpOAuthProvider(config, fetchImpl);

    await assert.rejects(
      provider.exchangeCode({ code: "code-secret-1", codeVerifier: "verifier-secret-1" }),
      (error: unknown) => {
        assert.ok(error instanceof IfoodOAuthError);
        assert.equal(error.code, expected);
        assert.doesNotMatch(error.message, /super-secret-value|code-secret-1|verifier-secret-1/);
        return true;
      },
    );
  });
}

test("network failure becomes UNAVAILABLE", async () => {
  const provider = new IfoodMcpOAuthProvider(config, (async () => {
    throw new TypeError("fetch failed");
  }) as typeof globalThis.fetch);

  await assert.rejects(
    provider.exchangeCode({ code: "c", codeVerifier: "v" }),
    (error: unknown) => error instanceof IfoodOAuthError && error.code === "UNAVAILABLE",
  );
});

test("code exchange without refresh token is rejected", async () => {
  const { fetchImpl } = fakeFetch(200, { access_token: "access-1", expires_in: 3600 });
  const provider = new IfoodMcpOAuthProvider(config, fetchImpl);

  await assert.rejects(
    provider.exchangeCode({ code: "c", codeVerifier: "v" }),
    (error: unknown) => error instanceof IfoodOAuthError && error.code === "INVALID_RESPONSE",
  );
});

test("needsRefresh triggers within five minutes of expiry", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  assert.equal(needsRefresh({ accessTokenExpiresAt: "2026-10-17T12:10:00Z" }, now), false);
  assert.equal(needsRefresh({ accessTokenExpiresAt: "2026-10-17T12:04:00Z" }, now), true);
  assert.equal(needsRefresh({ accessTokenExpiresAt: "invalid" }, now), true);
});
