/**
 * Login OAuth interativo para uso local (CLI, spike, opencode): abre um servidor na redirect
 * `localhost` cadastrada, espera o navegador voltar e troca o code por tokens.
 * Nada é impresso além da URL de login.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

import type { IfoodConfig } from "./config.js";
import type { IfoodMcpOAuthProvider } from "./oauth-provider.js";
import type { OAuthTokenResponse } from "./provider.js";

export async function interactiveLogin(
  config: IfoodConfig,
  provider: IfoodMcpOAuthProvider,
  onUrl: (url: string) => void = (url) => console.log(`\nAbra no navegador e faça login:\n${url}\n`),
): Promise<OAuthTokenResponse> {
  const callback = new URL(config.redirectUri);
  if (!["localhost", "127.0.0.1"].includes(callback.hostname)) {
    throw new Error("O login local precisa de uma IFOOD_REDIRECT_URI em localhost");
  }

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", config.redirectUri);
      if (url.pathname !== callback.pathname) {
        response.writeHead(404).end();
        return;
      }
      if (url.searchParams.get("state") !== state) {
        response.writeHead(400).end("state inválido");
        return;
      }
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Login recebido. Pode voltar ao terminal.");
      server.close();
      const received = url.searchParams.get("code");
      if (received) resolve(received);
      else reject(new Error(`Login recusado: ${url.searchParams.get("error") ?? "sem code"}`));
    });
    server.on("error", reject);
    server.listen(Number(callback.port || 80), callback.hostname, () =>
      onUrl(
        provider.createAuthorizationUrl({
          partyId: "local",
          state,
          codeChallenge,
          codeChallengeMethod: "S256",
        }),
      ),
    );
  });

  return provider.exchangeCode({ code, codeVerifier });
}
