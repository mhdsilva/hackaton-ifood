/**
 * Configuração do provider real do iFood, lida somente do ambiente.
 *
 * O provider não faz descoberta automática (`/.well-known/openid-configuration`): o iFood declara
 * `issuer` como `https://id.ifood.com.br/3p`, mas o MCP anuncia `https://id.ifood.com.br`, e
 * clientes estritos abortam nessa comparação. Por isso as URLs são montadas a partir de
 * `IFOOD_AUTH_BASE_URL`. Ver docs/ifood-mcp.md.
 */

export const DEFAULT_IFOOD_AUTH_BASE_URL = "https://id.ifood.com.br";
export const DEFAULT_IFOOD_MCP_URL = "https://consumer-mcp.ifood.com.br/marketplace";
export const MCP_CALLBACK_PATH = "/mcp-connection/callback";

export interface IfoodConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  mcpUrl: string;
  redirectUri: string;
}

export class IfoodConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Configuração do iFood incompleta: defina ${missing.join(", ")}`);
    this.name = "IfoodConfigError";
  }
}

type Env = Record<string, string | undefined>;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadIfoodConfig(env: Env = process.env): IfoodConfig {
  const clientId = read(env, "IFOOD_CLIENT_ID");
  const clientSecret = read(env, "IFOOD_CLIENT_SECRET");
  const explicitRedirect = read(env, "IFOOD_REDIRECT_URI");
  const publicApiUrl = read(env, "PUBLIC_API_URL");

  const missing: string[] = [];
  if (!clientId) missing.push("IFOOD_CLIENT_ID");
  if (!clientSecret) missing.push("IFOOD_CLIENT_SECRET");
  if (!explicitRedirect && !publicApiUrl) {
    missing.push("IFOOD_REDIRECT_URI ou PUBLIC_API_URL");
  }
  if (missing.length > 0) throw new IfoodConfigError(missing);

  const authBaseUrl = withoutTrailingSlash(
    read(env, "IFOOD_AUTH_BASE_URL") ?? DEFAULT_IFOOD_AUTH_BASE_URL,
  );

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    authorizeUrl: `${authBaseUrl}/authorize`,
    tokenUrl: `${authBaseUrl}/token`,
    mcpUrl: read(env, "IFOOD_MCP_URL") ?? DEFAULT_IFOOD_MCP_URL,
    redirectUri:
      explicitRedirect ?? `${withoutTrailingSlash(publicApiUrl!)}${MCP_CALLBACK_PATH}`,
  };
}
