import type { IfoodConfig } from "./config.js";
import { IfoodOAuthError, classifyTokenError } from "./oauth-errors.js";
import type {
  McpOAuthProvider,
  OAuthAuthorizationInput,
  OAuthExchangeInput,
  OAuthTokenResponse,
} from "./provider.js";

type Fetch = typeof globalThis.fetch;

interface TokenEndpointBody {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  refresh_expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
}

export class IfoodMcpOAuthProvider implements McpOAuthProvider {
  readonly mode = "ifood" as const;

  constructor(
    private readonly config: IfoodConfig,
    private readonly fetchImpl: Fetch = globalThis.fetch.bind(globalThis),
  ) {}

  createAuthorizationUrl(input: OAuthAuthorizationInput): string {
    const url = new URL(this.config.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", input.codeChallengeMethod);
    url.searchParams.set("state", input.state);
    url.searchParams.set("resource", this.config.mcpUrl);
    return url.toString();
  }

  async exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenResponse> {
    const tokens = await this.requestTokens({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: this.config.redirectUri,
    });
    if (!tokens.refreshToken) {
      throw new IfoodOAuthError(
        "INVALID_RESPONSE",
        "O iFood não devolveu refresh token na troca do código",
      );
    }
    return { ...tokens, refreshToken: tokens.refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
    const tokens = await this.requestTokens({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    // Sem rotação, o refresh token anterior continua válido.
    return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
  }

  private async requestTokens(
    params: Record<string, string>,
  ): Promise<Omit<OAuthTokenResponse, "refreshToken"> & { refreshToken?: string }> {
    const credentials = Buffer.from(
      `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`,
    ).toString("base64");

    let response: Response;
    try {
      response = await this.fetchImpl(this.config.tokenUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
      });
    } catch {
      throw new IfoodOAuthError(
        "UNAVAILABLE",
        "Não foi possível alcançar o servidor de autorização do iFood",
      );
    }

    const body = (await response.json().catch(() => ({}))) as TokenEndpointBody;
    if (!response.ok) throw classifyTokenError(response.status, body.error);

    if (typeof body.access_token !== "string" || body.access_token.length === 0) {
      throw new IfoodOAuthError(
        "INVALID_RESPONSE",
        "O iFood não devolveu access token",
        response.status,
      );
    }

    const expiresIn = Number(body.expires_in);
    const refreshExpiresIn = Number(body.refresh_expires_in);
    return {
      accessToken: body.access_token,
      ...(typeof body.refresh_token === "string" && body.refresh_token.length > 0
        ? { refreshToken: body.refresh_token }
        : {}),
      expiresInSeconds: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
      ...(Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0
        ? { refreshTokenExpiresInSeconds: refreshExpiresIn }
        : {}),
      ...(typeof body.scope === "string" && body.scope.trim().length > 0
        ? { scopes: body.scope.trim().split(/\s+/) }
        : {}),
    };
  }
}
