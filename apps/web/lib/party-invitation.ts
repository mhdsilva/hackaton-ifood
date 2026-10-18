export function buildPartyInviteUrl(code: string, origin: string): string {
  const url = new URL("/", origin);
  url.searchParams.set("code", code);
  return url.toString();
}
