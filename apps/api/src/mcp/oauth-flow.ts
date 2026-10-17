import { createHash, randomBytes } from "node:crypto";

import { McpSessionRegistry } from "./session-registry.js";

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

export type McpOAuthMode = "demo" | "ifood";

export interface McpOAuthProvider {
  readonly mode: McpOAuthMode;
  createAuthorizationUrl(input: OAuthAuthorizationInput): string;
  exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenResponse>;
}

export interface OAuthActor {
  partyId: string;
  participantId: string;
}

interface PendingAuthorization extends OAuthActor {
  codeVerifier: string;
  expiresAt: number;
}

export class McpOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly actor?: OAuthActor,
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}

export class McpOAuthFlow {
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly pendingStateByActor = new Map<string, string>();

  constructor(
    private readonly provider: McpOAuthProvider,
    private readonly sessions: McpSessionRegistry,
    private readonly now: () => number = Date.now,
    private readonly pendingTtlMs = 10 * 60 * 1000,
  ) {}

  get mode(): McpOAuthMode {
    return this.provider.mode;
  }

  start(actor: OAuthActor): { authorizationUrl: string; status: "validating"; mode: McpOAuthMode } {
    this.deleteExpiredAttempts();
    const actorKey = this.actorKey(actor);
    const previousState = this.pendingStateByActor.get(actorKey);
    if (previousState) this.pending.delete(previousState);
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    this.pending.set(state, {
      ...actor,
      codeVerifier,
      expiresAt: this.now() + this.pendingTtlMs,
    });
    this.pendingStateByActor.set(actorKey, state);

    return {
      authorizationUrl: this.provider.createAuthorizationUrl({
        partyId: actor.partyId,
        state,
        codeChallenge,
        codeChallengeMethod: "S256",
      }),
      status: "validating",
      mode: this.provider.mode,
    };
  }

  async complete(input: {
    partyId: string;
    state: string;
    code?: string;
    providerError?: string;
  }): Promise<OAuthActor> {
    const state = input.state?.trim();
    if (!state) {
      throw new McpOAuthError(
        "OAUTH_CALLBACK_INVALID",
        "OAuth callback requires state",
      );
    }

    const attempt = this.pending.get(state);
    if (!attempt || attempt.expiresAt <= this.now()) {
      this.pending.delete(state);
      if (attempt) this.pendingStateByActor.delete(this.actorKey(attempt));
      throw new McpOAuthError(
        "OAUTH_STATE_INVALID",
        "OAuth state is invalid, expired, or already used",
      );
    }
    if (attempt.partyId !== input.partyId) {
      throw new McpOAuthError(
        "OAUTH_STATE_INVALID",
        "OAuth state does not belong to this Party",
      );
    }
    this.pending.delete(state);
    this.pendingStateByActor.delete(this.actorKey(attempt));
    const actor = {
      partyId: attempt.partyId,
      participantId: attempt.participantId,
    };
    if (input.providerError) {
      throw new McpOAuthError(
        "OAUTH_ACCESS_DENIED",
        "The iFood authorization was cancelled or denied",
        actor,
      );
    }
    const code = input.code?.trim();
    if (!code) {
      throw new McpOAuthError(
        "OAUTH_CALLBACK_INVALID",
        "OAuth callback requires an authorization code",
        actor,
      );
    }

    try {
      const tokens = await this.provider.exchangeCode({
        code,
        codeVerifier: attempt.codeVerifier,
      });
      const issuedAt = this.now();
      this.sessions.set(attempt.partyId, attempt.participantId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: new Date(
          issuedAt + tokens.expiresInSeconds * 1000,
        ).toISOString(),
        ...(tokens.refreshTokenExpiresInSeconds
          ? {
              refreshTokenExpiresAt: new Date(
                issuedAt + tokens.refreshTokenExpiresInSeconds * 1000,
              ).toISOString(),
            }
          : {}),
        ...(tokens.scopes ? { scopes: [...tokens.scopes] } : {}),
      });
    } catch {
      throw new McpOAuthError(
        "OAUTH_EXCHANGE_FAILED",
        "The iFood authorization could not be completed",
        actor,
      );
    }

    return actor;
  }

  private deleteExpiredAttempts(): void {
    const now = this.now();
    for (const [state, attempt] of this.pending) {
      if (attempt.expiresAt <= now) {
        this.pending.delete(state);
        this.pendingStateByActor.delete(this.actorKey(attempt));
      }
    }
  }

  private actorKey(actor: OAuthActor): string {
    return `${actor.partyId}\u0000${actor.participantId}`;
  }
}
