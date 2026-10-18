import { loadIfoodConfig } from "./config.js";
import { IfoodMcpOAuthProvider } from "./oauth-provider.js";

export { IfoodConfigError, loadIfoodConfig, MCP_CALLBACK_PATH } from "./config.js";
export type { IfoodConfig } from "./config.js";
export { IfoodOAuthError } from "./oauth-errors.js";
export { IfoodMcpOAuthProvider } from "./oauth-provider.js";
export { needsRefresh } from "./token-refresh.js";

/** Ponto único que o `server.ts` usa para `MCP_OAUTH_MODE=ifood`. */
export function createIfoodProvider(
  env: Record<string, string | undefined> = process.env,
): IfoodMcpOAuthProvider {
  return new IfoodMcpOAuthProvider(loadIfoodConfig(env));
}
