/**
 * Tokens do iFood para uso local (opencode, testes manuais), gravados no `.env` da raiz.
 *
 *   npm run ifood:login     abre o navegador e grava IFOOD_ACCESS_TOKEN / IFOOD_REFRESH_TOKEN
 *   npm run ifood:refresh   renova o access token sem novo login (só se faltar < 5 min,
 *                           ou sempre com --force)
 *
 * O `.env` está no .gitignore e é gravado com permissão 600. Nenhum token é impresso.
 */

import { chmod, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { loadIfoodConfig } from "./config.js";
import { interactiveLogin } from "./local-login.js";
import { IfoodMcpOAuthProvider } from "./oauth-provider.js";
import type { OAuthTokenResponse } from "./provider.js";
import { needsRefresh } from "./token-refresh.js";

const ENV_FILE = new URL("../../../../.env", import.meta.url);

export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

/** Atualiza ou acrescenta chaves preservando o resto do arquivo (comentários e ordem). */
export function upsertEnv(text: string, updates: Record<string, string>): string {
  const pending = new Map(Object.entries(updates));
  const lines = text.split(/\r?\n/).map((line) => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (!key || !pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${value}`;
  });
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  for (const [key, value] of pending) lines.push(`${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

export function tokenEnv(tokens: OAuthTokenResponse, now = Date.now()): Record<string, string> {
  return {
    IFOOD_ACCESS_TOKEN: tokens.accessToken,
    IFOOD_REFRESH_TOKEN: tokens.refreshToken,
    IFOOD_ACCESS_TOKEN_EXPIRES_AT: new Date(now + tokens.expiresInSeconds * 1000).toISOString(),
  };
}

async function readEnvFile(): Promise<string> {
  try {
    return await readFile(ENV_FILE, "utf8");
  } catch {
    return "";
  }
}

async function main(command: string | undefined, force: boolean): Promise<void> {
  const text = await readEnvFile();
  const env = { ...parseEnv(text), ...process.env };
  const config = loadIfoodConfig(env);
  const provider = new IfoodMcpOAuthProvider(config);

  let tokens: OAuthTokenResponse;
  if (command === "login") {
    tokens = await interactiveLogin(config, provider);
  } else if (command === "refresh") {
    const refreshToken = env.IFOOD_REFRESH_TOKEN;
    if (!refreshToken) throw new Error("Sem IFOOD_REFRESH_TOKEN no .env: rode npm run ifood:login");
    const expiresAt = env.IFOOD_ACCESS_TOKEN_EXPIRES_AT ?? "";
    if (!force && env.IFOOD_ACCESS_TOKEN && !needsRefresh({ accessTokenExpiresAt: expiresAt })) {
      console.log(`Token ainda válido até ${expiresAt}.`);
      return;
    }
    tokens = await provider.refreshTokens(refreshToken);
  } else {
    throw new Error("Uso: login-cli.ts login | refresh [--force]");
  }

  const updates = tokenEnv(tokens);
  await writeFile(ENV_FILE, upsertEnv(text, updates), { mode: 0o600 });
  await chmod(ENV_FILE, 0o600);
  console.log(`Tokens gravados no .env (válidos até ${updates.IFOOD_ACCESS_TOKEN_EXPIRES_AT}).`);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (isEntrypoint) {
  main(process.argv[2], process.argv.includes("--force")).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Falha no login do iFood");
    process.exitCode = 1;
  });
}
