# iFood MCP — autenticação e integração

> Versão pesquisada em 17 de outubro de 2026, contra o Portal do Desenvolvedor do iFood MCP
> (`https://mcp-developer.ifood.com.br`). Este documento é a referência de como conectar a
> Party ao iFood MCP. Ele substitui o modelo antigo de "cada participante cola uma chave".

## Verificado na prática (17/10/2026)

Os valores abaixo foram confirmados com o agente do time e com uma conta real, pelo provider de
`apps/api/src/ifood/`. **Quando divergirem do restante deste documento, valem estes.**

| Item | Valor real |
| --- | --- |
| Endpoint MCP | `https://consumer-mcp.ifood.com.br/marketplace` — um único endpoint com as 23 tools (User, Discovery, Cart, Order) |
| Servidor de autorização | `https://id.ifood.com.br`: `/authorize`, `/token`, `/revoke`, `/introspect`, `/userinfo` |
| Grants aceitos | `authorization_code` e `refresh_token` (não há `client_credentials` nem device code no metadata) |
| PKCE | obrigatório, `S256` |
| Parâmetro extra | `resource=https://consumer-mcp.ifood.com.br/marketplace` no authorize |
| Autenticação do cliente | `client_secret_basic` (usado pelo provider) ou `client_secret_post` |
| `scope` | não precisa ser enviado: o iFood concede os escopos marcados no agente (17 na nossa conta) |
| Escopos concedidos | `mcp.user`, `mcp.user.basic.read`, `mcp.user.advanced.read`, `mcp.user.behavior.read`, `mcp.user.addresses.read`, `mcp.user.addresses.write`, `mcp.discovery`, `mcp.discovery.search.read`, `mcp.discovery.browse.read`, `mcp.discovery.recommendation.read`, `mcp.discovery.details.read`, `mcp.cart`, `mcp.cart.read`, `mcp.cart.write`, `mcp.cart.checkout`, `mcp.cart.payment`, `mcp.orders.read` |
| Redirect URI | precisa estar cadastrada no agente. Em `localhost`, só a **porta** pode variar; o **caminho** tem de ser idêntico (`/mcp-connection/callback` foi recusado com `invalid_request` enquanto só `/callback` estava cadastrado). Cadastrar `http://localhost:8080/mcp-connection/callback` para dev e `https://<api>/mcp-connection/callback` para a demo |
| Callback da Party | **único**: `PUBLIC_API_URL/mcp-connection/callback`. A Party e o participante vêm do `state`, nunca do caminho |
| Homologação | não foi bloqueio: o agente do time já tem Client ID e Secret e funciona |
| Transporte MCP | Streamable HTTP (JSON-RPC 2.0); `initialize` responde em SSE e devolve `Mcp-Session-Id` |

### Inconsistência de `issuer`

`https://consumer-mcp.ifood.com.br/.well-known/oauth-protected-resource/marketplace` anuncia o
servidor `https://id.ifood.com.br`, mas `https://id.ifood.com.br/.well-known/openid-configuration`
declara `issuer: https://id.ifood.com.br/3p`, e `/.well-known/oauth-authorization-server`
responde `400`. Clientes que fazem descoberta estrita (RFC 8414 §3.3) abortam com
`Issuer mismatch` — foi o que aconteceu com o opencode. O nosso provider **não faz descoberta**:
monta `<IFOOD_AUTH_BASE_URL>/authorize` e `/token` a partir da configuração.

### Configuração do provider

| Variável | Obrigatória | Padrão |
| --- | --- | --- |
| `IFOOD_CLIENT_ID` | sim | — |
| `IFOOD_CLIENT_SECRET` | sim | — |
| `PUBLIC_API_URL` ou `IFOOD_REDIRECT_URI` | um dos dois | redirect = `PUBLIC_API_URL/mcp-connection/callback` |
| `IFOOD_AUTH_BASE_URL` | não | `https://id.ifood.com.br` |
| `IFOOD_MCP_URL` | não | `https://consumer-mcp.ifood.com.br/marketplace` |

### Spike de sessões (ADR 0001)

`apps/api/src/ifood/spike-sessions.ts` faz o login de N contas e chama `getUser` intercalado.
Resultado em 17/10/2026 com **uma** conta: tokens obtidos pelo nosso provider, três rodadas,
mesmo dono, zero vazamentos. **Falta repetir com duas contas** para provar o isolamento.

## Resumo em uma frase

O iFood MCP não usa chave colada por pessoa. Ele usa **OAuth 2.1 com PKCE**: o time registra
**um agente** (o backend da Party) e recebe **um `client_id` + `client_secret`**; cada
participante autoriza o agente e recebe o **próprio par de tokens** (`access_token` +
`refresh_token`). O `client_id`/`client_secret` identifica o aplicativo, **nunca** dá acesso à
conta, ao carrinho ou ao pedido de um usuário.

## Dois níveis de credencial

| Nível | O que é | Quantos | Onde vive |
| --- | --- | --- | --- |
| Agente (aplicativo) | `client_id` + `client_secret` | um por time | somente no backend |
| Participante (usuário) | `access_token` (~1 h) + `refresh_token` (~30 dias) | um por participante | registro privado em memória, indexado por `partyId + participantId` |

Consequências:

- **Não existe** fluxo em que o participante cole uma chave (`apiKey`) na tela. O que ele faz é
  **autorizar** o agente por OAuth.
- **Com um `client_id`/`client_secret` sozinho não é possível** pedir na conta de ninguém. O
  `client_credentials` só identifica o aplicativo; a identidade do usuário vem do consentimento
  OAuth de cada pessoa.
- O gateway do iFood injeta a identidade (`userId` e escopos) por header a cada chamada MCP. O
  agente nunca manipula o `userId` diretamente.

## Pré-requisitos no portal (uma vez, pelo time)

> Texto do portal, mantido como referência. Na prática, o item 3 não bloqueou: ver a seção
> "Verificado na prática".

1. Criar conta de desenvolvedor em `https://mcp-developer.ifood.com.br/sign-up`. O perfil
   **Personal** libera o sandbox na hora; o **Professional** passa por validação (24–48 h).
2. **Criar o agente** com:
   - nome, descrição, logo (quadrado, até 1 MB);
   - **Redirect URL (Callback URL)** — recebe o `authorization_code` no fluxo OAuth 2.1;
   - Termos de Uso e Política de Privacidade (URLs públicas);
   - **escopos de acesso** (seleção em cascata): *User data* → *Content discovery* → *Order creation*.
3. O agente entra em **revisão de segurança do iFood**. **As credenciais só são liberadas após a
   aprovação** (a aprovação não gera e-mail; acompanhar em *My agents*).
4. Com o agente homologado, aparece a seção **Access credentials**:
   - **Client ID** — exibido direto;
   - **Client Secret** — gerado sob demanda, mostrado **uma única vez**. Guardar no cofre do backend.
5. Criar uma **test account** no sandbox — valida a integração de ponta a ponta **sem número de
   telefone real**. Pagamentos são **simulados**.

> Ponto a confirmar com os organizadores do hackathon: se eles já entregam um agente homologado
> (e um conjunto de test accounts) ou se cada time passa pela revisão de segurança do iFood. Sem
> agente homologado não há `client_secret` e o fluxo não fecha.

## Métodos de autenticação

A doc oficial descreve três caminhos. Todos terminam com `access_token` + `refresh_token` do
usuário:

| Método | Indicado para | Como o usuário aprova | Sucesso relatado |
| --- | --- | --- | --- |
| **Web Login** | Web / SPA (o nosso caso) | Redireciona para `dev-auth.ifood.com/authorize`, loga (2FA por SMS/e-mail/app) e volta com `code` | 80–90% |
| **Pending Action** (device code) | Servidor, CLI, agente, IoT | O backend mostra QR/código; o usuário aprova no app do iFood no celular | 60–70% |
| **Any2App** | App nativo iOS/Android | Deep link direto para o app do iFood (`ifood://auth/callback`) | 70–80% |

A própria doc recomenda **Pending Action** para "AI Agent / Bot" e "Server / CLI" — que é
exatamente o papel do backend da Party. **Web Login** é o encaixe mais natural no fluxo
"entrar na Party pelo navegador do celular".

## Fluxo OAuth 2.1 + PKCE (como o provider faz)

```
1. Backend gera, por tentativa de conexão:
     code_verifier  = string aleatória (43–128 chars)
     code_challenge = BASE64URL( SHA256(code_verifier) )
     state          = string aleatória vinculada a partyId + participantId

2. Backend redireciona o navegador do participante para:
     GET https://id.ifood.com.br/authorize
       ?response_type=code
       &client_id=<client_id>
       &redirect_uri=<PUBLIC_API_URL>/mcp-connection/callback
       &code_challenge=<code_challenge>
       &code_challenge_method=S256
       &state=<state>
       &resource=https://consumer-mcp.ifood.com.br/marketplace

3. O participante autentica no iFood e consente com os escopos.

4. iFood redireciona para o callback com:
     <callback>?code=<authorization_code>&state=<state>

5. Backend valida o state, então troca o code por tokens:
     POST https://id.ifood.com.br/token
       Authorization: Basic base64(client_id:client_secret)   # só no backend
       Content-Type: application/x-www-form-urlencoded
       grant_type=authorization_code
       code=<authorization_code>
       code_verifier=<code_verifier>
       redirect_uri=<o mesmo do passo 2>

6. Resposta: { access_token, refresh_token, expires_in, ... }
     Backend guarda os tokens no registro privado (partyId + participantId)
     e marca mcpConnectionStatus = connected.

7. Toda chamada MCP usa: Authorization: Bearer <access_token>
```

O `client_secret` **não** entra no navegador: o frontend só recebe a URL de `authorize`; a troca
de `code` por token acontece no backend (cliente confidencial). Como usamos PKCE além disso,
um `code` interceptado não serve sem o `code_verifier`.

## Escopos

Base OpenID Connect: `openid` (obrigatório), `profile`, `email`, `phone`, `address`.

Escopos MCP relevantes para a Party:

| Escopo | Permite |
| --- | --- |
| `user:read` | Identificar usuário, ler perfil e endereços |
| `discovery:read` | Buscar restaurantes, itens, recomendações |
| `cart:read` / `cart:write` | Ler e montar o carrinho |
| `cart:checkout` | Fechar o pedido |
| `cart:payment` | Consultar formas de pagamento |
| `order:read` | Consultar pedidos e status |

Os nomes acima são os da documentação geral. Os nomes **reais** concedidos ao agente são os
`mcp.*` listados em "Verificado na prática"; o `scope` não precisa ser enviado no authorize.

## MCPs e ferramentas (ponta a ponta de um pedido)

Na prática, as quatro famílias abaixo ficam **no mesmo endpoint**,
`https://consumer-mcp.ifood.com.br/marketplace`. As bases `/v3/*` são da documentação geral:

| MCP | Base | Ferramentas principais |
| --- | --- | --- |
| User | `/v3/user` | `getUser`, `listAddresses`, `createAddress` |
| Offer Discovery | `/v3/discovery` | `searchOffers`, `browseOffers`, `getRecommendations`, `getMerchant`, `getItem` |
| Cart | `/v3/cart` | `createCart`, `addItemToCart`, `getCartDeliveryMethods`, `setCartDelivery`, `listPaymentMethods`, `setCartPayment`, `submitOrder` |
| Order Tracking | `/v3/order` | `trackOrder`, `getOrder` |

**Ordem obrigatória do pedido:**

```
createCart → addItemToCart → getCartDeliveryMethods → setCartDelivery
           → listPaymentMethods → setCartPayment → (listVouchers → setVoucher) → submitOrder
```

`submitOrder` exige `userConsent: true` e devolve o `orderId`, que alimenta `trackOrder` e
`getOrder`. Cada chamada é feita com o token **daquele** participante.

## Ambientes

| Uso | Servidor de autenticação | MCP |
| --- | --- | --- |
| **Verificado (usado pelo provider)** | `https://id.ifood.com.br` | `https://consumer-mcp.ifood.com.br/marketplace` |
| Citado na doc geral, não verificado | `https://dev-auth.ifood.com`, `https://auth.ifood.com` | `https://dev-api-mcp.ifood.com`, `https://api-mcp.ifood.com` |

Endpoints de autenticação verificados: `GET /authorize`, `POST /token`, `GET /userinfo`,
`POST /introspect`, `POST /revoke`. O metadata não anuncia device code.

## Tokens: validade, refresh e revogação

- `access_token`: ~1 hora. `refresh_token`: ~30 dias (no portal do iFood MCP; a API de lojista
  usa outros valores).
- **Renovar com 5 minutos de folga**, sem esperar o `401`.
  ```
  POST /token
    Authorization: Basic base64(client_id:client_secret)
    grant_type=refresh_token
    refresh_token=<refresh_token>
  ```
  Se o iFood não devolver um `refresh_token` novo, o anterior continua valendo.
- Logout/revogação: `POST /revoke` com o token → invalida; depois apagar o token do registro.
- Guardar tokens em memória no backend, nunca em `localStorage`; o estado público
  (`PartySnapshot`) só expõe `mcpConnectionStatus`.

## Como a Party deve implementar (mapa para o backend)

O desenho do [ADR 0001](adr/0001-uma-sessao-mcp-por-participante.md) continua válido — uma sessão
isolada por participante sob um coordenador central. Só muda o que é armazenado: **tokens OAuth
por participante**, não chaves coladas.

Fluxo pretendido, no lugar de `POST /parties/:id/mcp-connection { apiKey }`:

1. `POST /parties/:id/mcp-connection/authorize` (Bearer `participantToken`)
   → backend gera `state` + PKCE e responde `{ authorizationUrl, status: "validating" }`.
2. Frontend abre `authorizationUrl` no navegador do participante.
3. `GET /mcp-connection/callback?code&state` — **callback único**, sem `:id` no caminho, porque
   o iFood compara a `redirect_uri` inteira. Sem Bearer; o `state` carrega
   `partyId + participantId` → backend valida `state`, troca `code` por tokens, guarda no
   registro privado, marca `connected` e redireciona o navegador de volta ao frontend.
   (Hoje a rota ainda é `/parties/:id/mcp-connection/callback`; a troca é do Matheus.)
4. `GET /parties/:id` mostra `mcpConnectionStatus` apenas como `not_connected` | `validating` |
   `connected` | `error`.

Peças prontas em `apps/api/src/ifood/`:

| Arquivo | Papel |
| --- | --- |
| `index.ts` | `createIfoodProvider(env)` — o que o `server.ts` usa em `MCP_OAUTH_MODE=ifood` |
| `oauth-provider.ts` | authorize, troca do code e refresh (`IfoodMcpOAuthProvider`) |
| `client.ts` | `IfoodMcpClient` — um por participante, Bearer por instância, refresh automático |
| `validate-connection.ts` | `getUser` → `connected` ou `error`, sem expor dados pessoais |
| `spike-sessions.ts` | prova de várias sessões no mesmo processo |

## O que NÃO fazer

- Não pedir chave (`apiKey`) ao participante nem aceitar `client_credentials` para pedir na
  conta dele — isso não existe no iFood MCP de consumidor.
- Não colocar `client_secret`, `access_token` ou `refresh_token` em `PartySnapshot`, logs,
  fixtures, prompts ou erros.
- Não usar o `client_secret` no frontend; PKCE existe justamente para não precisar dele ali.
- Não compartilhar token entre participantes: cada chamada MCP usa o token do seu dono.
- Não submeter pedido sem `userConsent: true` explícito do participante.
- Preferir a **test account** (pagamento simulado). Em conta real, nunca chamar `submitOrder`
  sem decisão explícita do grupo e do dono da conta.

## Referências

- Portal (visão geral): <https://mcp-developer.ifood.com.br/en-US/docs/guides>
- Índice completo em texto: <https://mcp-developer.ifood.com.br/llms.txt>
- Criar agente e credenciais: <https://mcp-developer.ifood.com.br/en-US/docs/guides/first-steps/agent>
- Autenticação (OAuth 2.1 + PKCE): <https://mcp-developer.ifood.com.br/en-US/docs/guides/authentication>
- Escopos: <https://mcp-developer.ifood.com.br/en-US/docs/guides/authentication/escopos>
- API de lojista (referência de OAuth, não do consumidor):
  <https://developer.ifood.com.br/en-US/docs/guides/modules/authentication/intro>
