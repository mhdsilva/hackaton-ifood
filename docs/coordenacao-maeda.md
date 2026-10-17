# Coordenação — Coordenador (Matheus) × Provider MCP (Maeda)

> Objetivo: os dois trabalharem em paralelo sem colisão de arquivos. A costura entre o
> fluxo OAuth genérico e o provider real do iFood está congelada abaixo.

## Fronteira de arquivos

| Área | Dono | Arquivos |
| --- | --- | --- |
| Fluxo OAuth, PKCE/state, rotas, registro privado, Party, contrato | Matheus | `apps/api/src/mcp/**`, `apps/api/src/party/**`, `apps/api/src/server.ts`, `packages/contracts/**`, `apps/api/openapi.yaml` |
| Provider real do iFood, refresh, config, tools, fixtures | Maeda | `apps/api/src/ifood/**`, `apps/api/src/agent/**`, `fixtures/*ifood*.json` |

`apps/api/src/mcp/**` é o **fluxo genérico** (não conhece o iFood); o **provider real** mora em
`apps/api/src/ifood/**`.

## Costura congelada

`McpOAuthProvider` é o único ponto de contato. Fica em `apps/api/src/ifood/provider.ts`
(área do Maeda) e o fluxo o importa:

```ts
type McpOAuthMode = "demo" | "ifood"
interface McpOAuthProvider {
  readonly mode: McpOAuthMode
  createAuthorizationUrl(input: OAuthAuthorizationInput): string
  exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenResponse>
}
```

Maeda implementa o provider real atrás dessa interface; o fluxo e as rotas não mudam.

## Pontos que ficam com o Maeda

1. **`redirectUri` no authorize e no exchange** — a interface hoje não carrega a `redirect_uri`
   (o demo embute a URL do callback no construtor); o provider real precisa dela nos dois passos.
2. **Refresh do `access_token`** com o `refresh_token`, feito pelo provider.
3. **Config do provider** — `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_AUTH_BASE_URL` no
   ambiente; `MCP_OAUTH_MODE=ifood` passa a exigir essa config.

Ponto de atenção resolvido: como os itens 1 e 3 tocam a interface, ela foi movida para
`apps/api/src/ifood/provider.ts` (área do Maeda), junto com `OAuthAuthorizationInput`,
`OAuthExchangeInput`, `OAuthTokenResponse` e `McpOAuthMode`. O `oauth-flow.ts` (Matheus) importa
esses tipos; assim o Maeda altera o contrato no arquivo dele e o fluxo só repassa mais contexto.

## Já pronto para plugar (Maeda não precisa refazer)

- `oauth-flow.ts`: PKCE S256, `state` de uso único com TTL, vínculo `state → partyId + participantId`.
- `session-registry.ts`: tokens isolados por `partyId + participantId`.
- Rotas `POST /parties/:id/mcp-connection/authorize` e `GET /parties/:id/mcp-connection/callback`.
- Status público só como `mcpConnectionStatus` (`not_connected`/`validating`/`connected`/`error`).
- `DemoMcpOAuthProvider` como referência de implementação.
- Seleção em `server.ts`: `MCP_OAUTH_MODE=demo` usa o demo; `ifood` hoje **recusa subir**. Maeda
  troca por `IFoodMcpOAuthProvider` lendo a config do item 3.

## Contrato HTTP (para os dois)

- `POST /parties/:id/mcp-connection/authorize` (Bearer) → `{ authorizationUrl, status, mode }`.
- `GET /parties/:id/mcp-connection/callback?code&state` → 302 para o frontend; tokens nunca no corpo.

## Regra de ouro

Nenhum `client_secret`, `access_token` ou `refresh_token` fora do registro privado (nunca em
`PartySnapshot`, logs, fixtures ou erros). Qualquer mudança na interface é combinada antes.
