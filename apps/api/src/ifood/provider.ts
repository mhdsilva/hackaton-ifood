/**
 * Contrato entre o fluxo OAuth genérico (apps/api/src/mcp) e o provider real do
 * iFood (apps/api/src/ifood). O Maeda implementa esta interface; o fluxo e as
 * rotas dependem apenas dela. Ver docs/coordenacao-maeda.md.
 */

export type McpOAuthMode = "demo" | "ifood";

export interface OAuthAuthorizationInput {
  partyId: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface OAuthExchangeInput {
  code: string;
  codeVerifier: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshTokenExpiresInSeconds?: number;
  scopes?: string[];
}

export interface McpOAuthProvider {
  readonly mode: McpOAuthMode;
  createAuthorizationUrl(input: OAuthAuthorizationInput): string;
  exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenResponse>;
}
