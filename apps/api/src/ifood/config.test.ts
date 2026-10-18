import assert from "node:assert/strict";
import { test } from "node:test";

import { IfoodConfigError, loadIfoodConfig } from "./config.js";

const base = {
  IFOOD_CLIENT_ID: "client-id",
  IFOOD_CLIENT_SECRET: "super-secret-value",
};

test("derives authorize, token and a single callback from PUBLIC_API_URL", () => {
  const config = loadIfoodConfig({ ...base, PUBLIC_API_URL: "https://api.example/" });

  assert.equal(config.authorizeUrl, "https://id.ifood.com.br/authorize");
  assert.equal(config.tokenUrl, "https://id.ifood.com.br/token");
  assert.equal(config.mcpUrl, "https://consumer-mcp.ifood.com.br/marketplace");
  assert.equal(config.redirectUri, "https://api.example/mcp-connection/callback");
});

test("explicit redirect and auth base override the defaults", () => {
  const config = loadIfoodConfig({
    ...base,
    PUBLIC_API_URL: "https://api.example",
    IFOOD_REDIRECT_URI: "http://localhost:8080/callback",
    IFOOD_AUTH_BASE_URL: "https://auth.example/",
  });

  assert.equal(config.redirectUri, "http://localhost:8080/callback");
  assert.equal(config.authorizeUrl, "https://auth.example/authorize");
  assert.equal(config.tokenUrl, "https://auth.example/token");
});

test("lists every missing variable without leaking provided values", () => {
  assert.throws(
    () => loadIfoodConfig({ IFOOD_CLIENT_SECRET: "super-secret-value", IFOOD_CLIENT_ID: "  " }),
    (error: unknown) => {
      assert.ok(error instanceof IfoodConfigError);
      assert.deepEqual(error.missing, [
        "IFOOD_CLIENT_ID",
        "IFOOD_REDIRECT_URI ou PUBLIC_API_URL",
      ]);
      assert.doesNotMatch(error.message, /super-secret-value/);
      return true;
    },
  );
});
