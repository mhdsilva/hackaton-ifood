export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Renova com folga, sem esperar o `401` do MCP. */
export function needsRefresh(
  session: { accessTokenExpiresAt: string },
  now: number = Date.now(),
  marginMs: number = REFRESH_MARGIN_MS,
): boolean {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - now <= marginMs;
}
