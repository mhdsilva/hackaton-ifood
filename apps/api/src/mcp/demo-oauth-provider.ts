import { randomBytes } from "node:crypto";

import type {
  McpOAuthProvider,
  OAuthAuthorizationInput,
  OAuthExchangeInput,
  OAuthTokenResponse,
} from "../ifood/provider.js";

export class DemoMcpOAuthProvider implements McpOAuthProvider {
  readonly mode = "demo" as const;

  constructor(private readonly publicApiUrl: string) {}

  createAuthorizationUrl(input: OAuthAuthorizationInput): string {
    const url = new URL(
      `/parties/${encodeURIComponent(input.partyId)}/mcp-connection/callback`,
      this.publicApiUrl,
    );
    url.searchParams.set("code", "demo-approved");
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  async exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenResponse> {
    if (input.code !== "demo-approved") {
      throw new Error("Demo authorization code was rejected");
    }

    return {
      accessToken: `demo-access-${randomBytes(24).toString("base64url")}`,
      refreshToken: `demo-refresh-${randomBytes(24).toString("base64url")}`,
      expiresInSeconds: 3600,
      refreshTokenExpiresInSeconds: 30 * 24 * 60 * 60,
      scopes: ["demo"],
    };
  }
}
