/**
 * Erros do servidor de autorização do iFood, classificados sem carregar segredos.
 * A mensagem nunca inclui client secret, code, code_verifier ou tokens.
 */

export type IfoodOAuthErrorCode =
  | "INVALID_CLIENT"
  | "INVALID_GRANT"
  | "INVALID_RESPONSE"
  | "UNAVAILABLE";

export class IfoodOAuthError extends Error {
  constructor(
    readonly code: IfoodOAuthErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "IfoodOAuthError";
  }
}

export function classifyTokenError(status: number, oauthError: unknown): IfoodOAuthError {
  if (oauthError === "invalid_client" || status === 401) {
    return new IfoodOAuthError(
      "INVALID_CLIENT",
      "O iFood recusou as credenciais do agente (client id ou secret)",
      status,
    );
  }
  if (oauthError === "invalid_grant") {
    return new IfoodOAuthError(
      "INVALID_GRANT",
      "O código ou refresh token é inválido, expirou ou não confere com a redirect URI",
      status,
    );
  }
  if (status >= 500) {
    return new IfoodOAuthError(
      "UNAVAILABLE",
      "O servidor de autorização do iFood está indisponível",
      status,
    );
  }
  return new IfoodOAuthError(
    "INVALID_RESPONSE",
    `O servidor de autorização do iFood recusou o pedido (HTTP ${status})`,
    status,
  );
}
