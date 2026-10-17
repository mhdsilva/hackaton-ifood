import assert from "node:assert/strict";
import { test } from "node:test";

import { parseEnv, tokenEnv, upsertEnv } from "./login-cli.js";

test("parses .env values, ignoring comments and quotes", () => {
  assert.deepEqual(parseEnv("# comentário\nA=1\nB = \"dois\"\n\nC='três'\n"), {
    A: "1",
    B: "dois",
    C: "três",
  });
});

test("updates existing keys and appends new ones, preserving the rest", () => {
  const before = "# credenciais\nIFOOD_CLIENT_ID=abc\nIFOOD_ACCESS_TOKEN=old\n";
  const after = upsertEnv(before, { IFOOD_ACCESS_TOKEN: "new", IFOOD_REFRESH_TOKEN: "r" });

  assert.equal(
    after,
    "# credenciais\nIFOOD_CLIENT_ID=abc\nIFOOD_ACCESS_TOKEN=new\nIFOOD_REFRESH_TOKEN=r\n",
  );
});

test("token env carries the absolute expiry", () => {
  const env = tokenEnv(
    { accessToken: "a", refreshToken: "r", expiresInSeconds: 3600 },
    Date.parse("2026-10-17T12:00:00Z"),
  );
  assert.deepEqual(env, {
    IFOOD_ACCESS_TOKEN: "a",
    IFOOD_REFRESH_TOKEN: "r",
    IFOOD_ACCESS_TOKEN_EXPIRES_AT: "2026-10-17T13:00:00.000Z",
  });
});
