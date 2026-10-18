/**
 * Spike do ADR 0001: várias sessões MCP do iFood no mesmo processo.
 *
 * Uso (tokens ficam só em memória; nada é gravado em disco):
 *   IFOOD_CLIENT_ID=... IFOOD_CLIENT_SECRET=... \
 *   IFOOD_REDIRECT_URI=http://localhost:8080/callback \
 *   node apps/api/dist/ifood/spike-sessions.js 2
 *
 * Para cada conta, abra a URL impressa e faça login. Use contas diferentes (janela anônima).
 * Depois o script chama `getUser` de forma intercalada e confere que cada sessão continua
 * devolvendo o próprio dono. A saída mostra só uma impressão digital do e-mail, nunca dados.
 */

import { createHash } from "node:crypto";

import { IfoodMcpClient } from "./client.js";
import { loadIfoodConfig } from "./config.js";
import { interactiveLogin } from "./local-login.js";
import { IfoodMcpOAuthProvider } from "./oauth-provider.js";

const config = loadIfoodConfig();
const provider = new IfoodMcpOAuthProvider(config);
const accounts = Number(process.argv[2] ?? 2);

function fingerprint(value: string): string {
  return createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 8);
}

/** Impressão do `sub` do JWT: identifica a conta sem depender do e-mail do `getUser`. */
function subjectFingerprint(accessToken: string): string {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    return fingerprint(String(payload.sub ?? ""));
  } catch {
    return "?";
  }
}

const clients: IfoodMcpClient[] = [];
const subjects: string[] = [];
for (let index = 1; index <= accounts; index++) {
  const tokens = await interactiveLogin(config, provider, (url) =>
    console.log(`\nConta ${index}: abra no navegador e faça login\n${url}\n`),
  );
  subjects.push(subjectFingerprint(tokens.accessToken));
  console.log(
    `Conta ${index}: tokens recebidos (escopos: ${tokens.scopes?.length ?? "?"}, sub ${subjects.at(-1)})`,
  );
  clients.push(
    new IfoodMcpClient({
      session: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
      },
      mcpUrl: config.mcpUrl,
      refreshTokens: (refreshToken) => provider.refreshTokens(refreshToken),
    }),
  );
}

const owners = new Map<number, string>();
let leaks = 0;
for (let round = 1; round <= 3; round++) {
  const results = await Promise.all(
    clients.map(async (client, index) => {
      const user = await client.callTool<{ data?: { email?: string } }>("getUser");
      return { index, owner: fingerprint(user.data?.email ?? "") };
    }),
  );
  for (const { index, owner } of results) {
    const expected = owners.get(index) ?? owner;
    owners.set(index, expected);
    if (owner !== expected) leaks++;
    console.log(`rodada ${round} · sessão ${index + 1} · dono ${owner}${owner === expected ? "" : " ✖ VAZAMENTO"}`);
  }
}

const distinct = new Set(owners.values()).size;
const distinctSubjects = new Set(subjects).size;
console.log(
  `\nResultado: ${clients.length} sessões, ${distinct} donos distintos (${distinctSubjects} sub distintos), ${leaks} vazamentos.`,
);
if (distinct < clients.length) {
  console.log("Atenção: alguma conta foi repetida; use contas diferentes para provar o isolamento.");
}
