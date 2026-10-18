# Como funciona — Party, OAuth, agente e pedido

> Atualizado em 17 de outubro de 2026. Cada seção começa com uma visão geral e depois detalha.
> Referências: [`ifood-mcp.md`](ifood-mcp.md) (fatos verificados do iFood),
> [`marcos.md`](marcos.md) (planejamento) e [`apps/api/openapi.yaml`](../apps/api/openapi.yaml)
> (contrato HTTP).

## Sumário

1. [A ideia em um minuto](#1-a-ideia-em-um-minuto)
2. [As peças do sistema](#2-as-peças-do-sistema)
3. [A jornada completa, ponta a ponta](#3-a-jornada-completa-ponta-a-ponta)
4. [Criar a Party e entrar por código](#4-criar-a-party-e-entrar-por-código)
5. [Conectar o iFood: OAuth e o link de login](#5-conectar-o-ifood-oauth-e-o-link-de-login)
6. [Falar com o iFood: o cliente MCP](#6-falar-com-o-ifood-o-cliente-mcp)
7. [O agente de opções locais](#7-o-agente-de-opções-locais)
8. [Carrinho, pedido e rastreio](#8-carrinho-pedido-e-rastreio)
9. [Modo demo e modo iFood](#9-modo-demo-e-modo-ifood)
10. [Como as etapas se relacionam](#10-como-as-etapas-se-relacionam)
11. [Segurança](#11-segurança)
12. [Configuração e como rodar](#12-configuração-e-como-rodar)
13. [Mapa de arquivos](#13-mapa-de-arquivos)
14. [Limitações conhecidas](#14-limitações-conhecidas)

---

## 1. A ideia em um minuto

### Visão geral

Amigos em lugares diferentes entram na mesma **Party**, cada um pelo próprio celular. Cada pessoa
**conecta a própria conta do iFood**. O grupo responde o questionário e **o tema sai como resultado**
das respostas — **não há pergunta de tema**. Quem escolhe é o **agente**, olhando as respostas de
**todos** os participantes (ex.: maioria pedindo comfort food → italiano). Sem LLM ou se ele falhar,
vale a regra determinística (energia "quente e confortável" → italiano; sem sinal claro, a vibe do
dia). A partir do tema, o **agente** busca, para cada pessoa, restaurantes reais perto do endereço
dela, dentro do orçamento dela. Cada um confirma o **próprio pedido**. A experiência é compartilhada;
conta, endereço, carrinho e pagamento continuam individuais.

### Em detalhe

- **Compartilhado:** a sala (Party), a lista de participantes, o andamento das etapas e o tema.
- **Individual:** a conta do iFood (tokens), o endereço, as opções, o carrinho, o consentimento
  e o pedido.
- **Ninguém age pela conta de outra pessoa.** O backend guarda os tokens de cada participante
  separados e toda chamada ao iFood usa o token do dono da ação.
- O "agente" não é uma IA negociando sozinha: é um módulo determinístico do backend que chama as
  tools do iFood em uma ordem conhecida e devolve dados estruturados.

---

## 2. As peças do sistema

### Visão geral

```text
Celular A ┐                       ┌─ Sessão MCP A ─┐
Celular B ├─► Backend da Party ───┼─ Sessão MCP B ─┼─► iFood MCP (catálogo, carrinho, pedido)
Celular C ┘   (estado + agente)   └─ Sessão MCP C ─┘
                    │
                    └─► id.ifood.com.br (login OAuth de cada pessoa)
```

São quatro peças: o **frontend** (um por pessoa), o **backend da Party**, o **servidor de login
do iFood** e o **MCP do iFood**.

### Em detalhe

| Peça | Endereço | Papel |
| --- | --- | --- |
| Frontend | `apps/web` (Otávio) | Telas; guarda o `participantToken`; consulta a Party a cada 1–2 s |
| Backend da Party | `apps/api` | Sala, participantes, estados, registro privado de tokens, agente |
| Servidor de autorização | `https://id.ifood.com.br` | Login da pessoa e emissão de tokens (OAuth 2.1 + PKCE) |
| iFood MCP | `https://consumer-mcp.ifood.com.br/marketplace` | 23 tools: usuário, endereços, busca, carrinho, pedido, rastreio |

Dentro do backend:

| Módulo | Pasta | Responsável |
| --- | --- | --- |
| Party (sala, estados, tokens de participante) | `src/party/` | Matheus |
| Fluxo OAuth genérico e registro de tokens | `src/mcp/` | Matheus |
| Provider OAuth do iFood, cliente MCP, checkout | `src/ifood/` | Maeda |
| Agente de opções e integração com o servidor | `src/agent/` | Maeda |
| Rotas HTTP | `src/server.ts` | Matheus (com as rotas do agente) |

Existem **duas credenciais diferentes**, e confundi-las é o erro mais comum:

| Credencial | Identifica | Quantas | Onde fica |
| --- | --- | --- | --- |
| `participantToken` | a pessoa **dentro da Party** | uma por participante | `sessionStorage` do celular; enviada como `Bearer` |
| Tokens do iFood (`access_token` + `refresh_token`) | a pessoa **no iFood** | um par por participante | só na memória do backend |

E uma terceira, do aplicativo: `IFOOD_CLIENT_ID` + `IFOOD_CLIENT_SECRET`, que identificam **o
nosso agente** perante o iFood e nunca dão acesso a conta nenhuma sozinhas.

---

## 3. A jornada completa, ponta a ponta

### Visão geral

```text
Criar Party → Entrar por código → Conectar iFood → Fechar grupo → Responder
→ Tema → Opções locais → Carrinho → Confirmar pedido → Acompanhar entrega
```

### Em detalhe

| # | Etapa | Quem faz | Rota | Resultado |
| --- | --- | --- | --- | --- |
| 1 | Criar Party | anfitrião | `POST /parties` | Party `OPEN`, código de 6 letras, `participantToken` do anfitrião |
| 2 | Entrar | convidados | `POST /parties/:code/join` | `participantToken` de cada um |
| 3 | Conectar iFood | cada pessoa | `POST /parties/:id/mcp-connection/authorize` → login → callback | `mcpConnectionStatus: connected` |
| 4 | Fechar grupo | anfitrião | `POST /parties/:id/close` | `COLLECTING_ANSWERS` |
| 5 | Responder | cada pessoa | `POST /parties/:id/answers` | quando todos respondem: `READY_FOR_THEME` |
| 6 | Tema | anfitrião revela; agente escolhe | `POST /parties/:id/reveal` | tema comum e `themeReason`; orçamento e restrições continuam por pessoa |
| 7 | Opções locais | cada pessoa | `POST /parties/:id/options` | até 3 restaurantes reais, dentro do orçamento |
| 8 | Carrinho | cada pessoa | `POST /parties/:id/cart` | carrinho no iFood com entrega e Pix |
| 9 | Confirmar | cada pessoa | `POST /parties/:id/order` com `userConsent: true` | `orderId` |
| 10 | Acompanhar | cada pessoa | `GET /parties/:id/order/:orderId` | status e cadência de consulta |

As etapas 3 e 4 podem ocorrer em qualquer ordem. A conexão com o iFood só é exigida a partir da
etapa 7.

O tema é **único por Party** e não muda depois do reveal. O agente recebe as respostas de cada
participante (sem nome, token ou endereço) e escolhe um tema do catálogo de `agent/themes.ts`
(`italiano`, `japones`, `hamburguer`, `mexicano`, `brasileiro`, `arabe`, `saudavel`, `doce`). Resposta
fora do catálogo, timeout ou falta de `OPENCODE_API_KEY` caem em `deriveTheme` — o reveal nunca falha
por causa do modelo.

---

## 4. Criar a Party e entrar por código

### Visão geral

O anfitrião cria a sala e recebe um **código curto** para compartilhar (ou um link do frontend que
carrega esse código). Quem entra com o código recebe um **token de participante**, que prova "eu
sou a Ana desta Party" em todas as ações privadas.

### Em detalhe

**Criação — `POST /parties`**

```json
{ "name": "Jantar de sexta", "host": { "id": "ana", "name": "Ana" } }
```

O backend (`PartyService.create`, em `src/party/service.ts`):

1. gera um `id` (UUID) e um `code` de 6 caracteres sem colisão com outras Parties;
2. cria a Party em `OPEN`, com o anfitrião como primeiro participante;
3. emite um `participantToken` aleatório (32 bytes) para o anfitrião (`ParticipantAccessStore`);
4. devolve `{ party, participantToken }`.

**O link / código de convite**

- O código vai no estado público da Party (`party.code`). O frontend monta o link de convite com
  ele; a API aceita **UUID ou código** em todas as rotas `/parties/:id`.
- O link não carrega credencial nenhuma: quem abre ainda precisa entrar e receber o próprio token.

**Entrada — `POST /parties/:code/join`**

```json
{ "participant": { "id": "bruno", "name": "Bruno" } }
```

- Recusa quando o resultado já está pronto (`READY_FOR_THEME`) ou revelado (`THEME_REVEALED`) —
  `PARTY_CLOSED` —, quando a Party está cheia — máximo de **4** — (`PARTY_FULL`) ou se o `id` já
  existir. Durante `COLLECTING_ANSWERS` ainda dá para entrar: quem chega atrasado responde como
  os outros.
- Devolve o próprio `participantToken` do convidado.

**O token de participante**

- O frontend guarda em `sessionStorage` e envia como `Authorization: Bearer <token>` nas rotas
  privadas. Nunca vai na URL nem no estado público.
- `GET /parties/:id/session` confirma se o token ainda vale (a API é em memória; reiniciar invalida
  tudo).
- `service.authorizeParticipant(partyId, token)` resolve o token para `{ partyId, participantId }`
  e recusa tokens de outra Party (`403 ACCESS_DENIED`). Todas as rotas do agente começam por aqui.

**Fechar e responder**

- Só o anfitrião fecha (`POST /parties/:id/close`), com no mínimo **2** participantes.
- Cada um envia as respostas (`POST /parties/:id/answers`); quando o último termina, a Party passa
  sozinha para `READY_FOR_THEME`.
- O frontend acompanha tudo consultando `GET /parties/:id` a cada 1–2 segundos (sem WebSocket).

---

## 5. Conectar o iFood: OAuth e o link de login

### Visão geral

Cada pessoa autoriza o nosso agente a usar a conta dela no iFood. O backend gera um **link de
login** exclusivo; a pessoa entra no site do iFood; o iFood devolve um **código de uso único** ao
nosso backend; o backend troca esse código pelos **tokens daquela pessoa** e os guarda em memória,
ligados a `Party + participante`. Antes de marcar "conectado", o backend faz uma leitura de teste
no iFood.

```text
Celular           Backend                         id.ifood.com.br        iFood MCP
   │ authorize ─────►│ gera state + PKCE               │                     │
   │◄── link ────────│                                 │                     │
   │──────── abre o link, faz login ─────────────────►│                     │
   │◄─────── redireciona para /callback?code&state ────│                     │
   │ ───────────────►│ confere state                   │                     │
   │                 │── troca code (+secret, verifier)►│                     │
   │                 │◄────────── tokens ───────────────│                     │
   │                 │── getUser com o token ───────────────────────────────►│
   │◄── redirect ────│ connected / error                                      │
```

### Em detalhe

**Passo 1 — pedir o link: `POST /parties/:id/mcp-connection/authorize` (Bearer do participante)**

`McpOAuthFlow.start` (`src/mcp/oauth-flow.ts`):

1. gera um `code_verifier` aleatório e o `code_challenge = BASE64URL(SHA256(verifier))` — isso é o
   **PKCE**;
2. gera um `state` aleatório (32 bytes) e anota, em memória, `state → { partyId, participantId,
   code_verifier, expira em 10 min }`. Uma nova tentativa da mesma pessoa invalida a anterior;
3. pede ao provider a URL de autorização e marca a pessoa como `validating`.

O provider real (`IfoodMcpOAuthProvider.createAuthorizationUrl`, `src/ifood/oauth-provider.ts`)
monta o **link de login**:

```text
https://id.ifood.com.br/authorize
  ?response_type=code
  &client_id=<IFOOD_CLIENT_ID>
  &redirect_uri=<redirect cadastrada>          ← a mesma para todas as Parties
  &code_challenge=<challenge>&code_challenge_method=S256
  &state=<state>
  &resource=https://consumer-mcp.ifood.com.br/marketplace
```

- O link não contém segredo: o `client_secret` nunca sai do backend.
- Não enviamos `scope`: o iFood concede os escopos marcados no agente (17 na nossa conta).
- Não usamos descoberta automática do servidor de autorização: o iFood declara `issuer`
  `…/3p`, diferente do anunciado, e clientes estritos abortam. As URLs vêm de
  `IFOOD_AUTH_BASE_URL`.

**Passo 2 — login no iFood**

A pessoa abre o link, entra por e-mail ou SMS (no sandbox, com os códigos gerados no portal) e
aceita as permissões. O iFood redireciona o navegador para a `redirect_uri` com `?code&state`.

**Passo 3 — callback único**

- O iFood compara a `redirect_uri` **inteira** com a cadastrada no agente. Em `localhost` só a
  porta pode variar; o caminho tem de ser idêntico. Por isso **o callback é único** para todas as
  Parties: a Party e a pessoa vêm do `state`, não do caminho.
- O servidor atende o callback no caminho da redirect configurada (`IFOOD_REDIRECT_URI` ou
  `PUBLIC_API_URL + /mcp-connection/callback`). A rota antiga
  `/parties/:id/mcp-connection/callback` continua aceita por compatibilidade.
- Não exige Bearer, porque quem chama é o redirecionamento do iFood.

**Passo 4 — troca do código por tokens**

`McpOAuthFlow.complete`:

1. procura o `state`; se não existir, expirou ou já foi usado → `OAUTH_STATE_INVALID`
   (impede reaproveitar um callback);
2. consome o `state` (uso único) e recupera `partyId`, `participantId` e `code_verifier`;
3. chama `provider.exchangeCode`, que faz:

```text
POST https://id.ifood.com.br/token
Authorization: Basic base64(client_id:client_secret)
grant_type=authorization_code&code=<code>&code_verifier=<verifier>&redirect_uri=<a mesma>
```

4. guarda no `McpSessionRegistry` (`src/mcp/session-registry.ts`), com a chave
   `partyId + participantId`: `access_token` (~1 h), `refresh_token` (~30 dias), validades e
   escopos.

O `client_secret` prova que é o nosso agente; o `code_verifier` prova que foi o nosso backend que
iniciou aquele login. Um `code` interceptado sozinho não serve para nada.

**Passo 5 — validação antes de "conectado"**

`validateConnection` (`src/ifood/validate-connection.ts`) chama `getUser` com o token recém-obtido:

- funcionou → `connected`;
- falhou → `error`.

Depois o backend redireciona o navegador para o frontend com
`?partyId=<id>&mcp=connected` (ou `mcp=error`). O estado público mostra só
`mcpConnectionStatus`; nome, e-mail e telefone devolvidos pelo `getUser` são descartados.

**Erros possíveis**

| Situação | Código | Efeito |
| --- | --- | --- |
| Pessoa cancelou no iFood | `OAUTH_ACCESS_DENIED` | status `error` |
| `state` inválido, expirado ou repetido | `OAUTH_STATE_INVALID` | nada muda |
| iFood recusou a troca | `OAUTH_EXCHANGE_FAILED` | status `error`, nenhum token guardado |
| Redirect não cadastrada | erro mostrado pelo próprio iFood (`invalid_request`) | o callback nem é chamado |

---

## 6. Falar com o iFood: o cliente MCP

### Visão geral

Com o token guardado, o backend cria um **cliente MCP por participante** sempre que precisa agir
por ele. Cada cliente carrega só o token do próprio dono e renova esse token sozinho antes de
expirar.

### Em detalhe

`IfoodMcpClient` (`src/ifood/client.ts`) implementa o protocolo **Streamable HTTP** (JSON-RPC 2.0)
com o `fetch` nativo:

1. `initialize` → o iFood devolve um `Mcp-Session-Id` (a resposta vem em SSE);
2. `notifications/initialized`;
3. `tools/call` para cada tool (`getUser`, `searchOffers`, `createCart`…), sempre com
   `Authorization: Bearer <access_token daquele participante>`.

- **Isolamento:** não há estado global; o cliente da Ana não tem como usar o token do Bruno. O
  iFood identifica o dono pelo token, então `listAddresses` com o token da Ana devolve os
  endereços da Ana.
- **Renovação:** antes de cada chamada, se faltam menos de 5 minutos para o `access_token`
  expirar (`needsRefresh`), o cliente chama `provider.refreshTokens` e avisa o backend, que
  atualiza o registro (`onSessionRefreshed`).
- **Erros:** `401` vira `AUTHENTICATION_REQUIRED` (reconectar); um envelope `errors` do iFood vira
  `TOOL_ERROR`; falha de rede vira `UNAVAILABLE`.

O spike `src/ifood/spike-sessions.ts` prova o isolamento: faz login de N contas e chama `getUser`
intercalado, conferindo que cada sessão sempre devolve o próprio dono. Rodado com duas contas
reais, as duas sessões coexistiram no mesmo processo sem vazamento.

---

## 7. O agente de opções locais

### Visão geral

Dado `tema + orçamento + restrições`, o agente descobre o endereço da pessoa, busca restaurantes
**abertos** do tema perto dela, detalha os pratos, escolhe as opções obrigatórias mais baratas e
devolve até **3 restaurantes** cujo total, **com frete**, cabe no orçamento.

```text
listAddresses → escolher endereço → searchOffers (1 por termo do tema)
→ escolher candidatos → getItem → montar opção → ordenar → até 3 opções
```

### Em detalhe

Rota: `POST /parties/:id/options` (Bearer)

```json
{ "budget": 60, "restrictions": ["vegetariano"], "addressId": "opcional" }
```

O `theme` do corpo é **opcional** (fallback): em geral o valor vem de `party.theme`, escolhido no
`reveal` (ver "Em detalhe"). Se o corpo trouxer `theme`, o da Party vence.

`resolveOptions` (`src/agent/resolve-options.ts`) segue estes passos:

1. **Endereço** (`pick-address.ts`): com um endereço salvo, usa direto. Com vários, **não
   adivinha**: responde `409 ADDRESS_SELECTION_REQUIRED` com candidatos que mostram só o alias
   ("Casa") ou bairro e cidade — nunca rua, número ou CEP. O frontend pede a escolha e repete a
   chamada com `addressId`.
2. **Tema → termos** (`themes.ts`): `italiano` vira `massa`, `pizza`, `lasanha`. Tema
   desconhecido busca o próprio nome.
3. **Restrições** (`restrictions.ts`): `vegetariano` → `VEGETARIAN`, `sem glúten` →
   `GLUTEN_FREE` etc. Restrições sem equivalente voltam em `warnings`.
4. **Busca**: um `searchOffers` por termo, em paralelo, com `resultKind: ITEM`,
   `merchantType: RESTAURANT` (evita mercados), `onlyOpen: true` e `maxItemPrice` = orçamento.
5. **Candidatos** (`selectCandidates`): só lojas abertas, sem itens repetidos, até 2 itens por
   loja, das lojas mais bem avaliadas.
6. **Detalhe** (`getItem`): traz os `optionGroups`. Grupos com `minSelections ≥ 1` são escolhas
   obrigatórias (tamanho, massa, sabor); sem elas o carrinho seria recusado.
7. **Montagem** (`build-option.ts`):
   - preço unitário = preço promocional + opções obrigatórias mais baratas;
   - abaixo do **pedido mínimo** da loja, sobe a quantidade (até 3);
   - total = subtotal + frete promocional; acima do orçamento, a opção é descartada.
8. **Ordenação**: melhor nota, depois entrega mais rápida, depois menor total; uma opção por loja,
   até 3.

Saída (`ResolveOptionsOutput`, em `src/agent/types.ts`):

```json
{
  "participantId": "ana",
  "source": "live",
  "theme": "italiano",
  "warnings": [],
  "options": [{
    "merchant": { "id": "…", "name": "Tomate Cru Pizzaria", "distanceKm": 0.31, "rating": 4.9 },
    "items": [{ "itemId": "…", "name": "22cm - Customizada", "quantity": 2, "unitPrice": 18,
                "selectedOptions": [{ "optionGroupId": "…", "optionId": "…", "name": "…", "additionalPrice": 0 }] }],
    "subtotal": 36, "deliveryFee": 0, "total": 36, "minimumOrderAmount": 29.9,
    "deliveryMethodId": "DEFAULT", "estimatedDeliveryMinutes": { "min": 44, "max": 54 }
  }]
}
```

Os `selectedOptions` são exatamente o que o carrinho precisa na etapa seguinte.

**Robustez**

- Limite de **20 s** por participante (`TIMEOUT` → `504`).
- `resolveOptionsForParty` resolve todos em paralelo; a falha de um não afeta os outros.
- **Contingência** (`fallback.ts`): se o iFood falhar, devolve opções reais capturadas em
  `fixtures/ifood-discovery-italiano.json`, marcadas com `source: "simulated"`. Erros que exigem
  ação da pessoa (escolher endereço, reconectar) não são mascarados.

Resultado real em 17/10/2026 (São Carlos, orçamento R$ 60, ~10 s): Tomate Cru (R$ 36), Cine Bar
(R$ 45,90 com frete) e Don Raffaele (R$ 52).

---

## 8. Carrinho, pedido e rastreio

### Visão geral

A pessoa escolhe uma das opções. O backend cria o **carrinho** no iFood com aquele prato e as
escolhas obrigatórias, define **entrega** e **pagamento por Pix** e mostra o total. O pedido só é
enviado quando a **própria pessoa confirma**. Depois, o backend informa o andamento seguindo o
ritmo que o iFood indica.

```text
createCart → getCartDeliveryMethods → setCartDelivery → listPaymentMethods → setCartPayment
→ getCart → [confirmação da pessoa] → submitOrder → trackOrder (repetido)
```

### Em detalhe

**Carrinho — `POST /parties/:id/cart` (Bearer)** — `prepareCart` em `src/ifood/checkout.ts`

```json
{ "option": { …uma das opções devolvidas por /options… }, "addressId": "opcional" }
```

1. resolve o endereço como no agente;
2. `createCart` com `merchantId`, `addressId` e `items[{ itemId, quantity, options[{ optionId }] }]`;
3. `getCartDeliveryMethods` e escolhe a entrega da opção (nunca retirada, se houver entrega);
4. `listPaymentMethods` e escolhe **Pix**; sem Pix → `422 PAYMENT_METHOD_UNAVAILABLE`;
5. `getCart` para o total calculado pelo iFood.

Devolve `{ cartId, merchantId, deliveryMethodId, paymentMethod, total, breakdown, simulated }`.
**Nada é cobrado e nenhum pedido é enviado.**

**O total do carrinho é o valor de verdade; o de `/options` é estimativa.** No teste real
(Italin House, 17/10/2026):

| Momento | Total |
| --- | --- |
| Estimativa do agente (preço promocional da busca) | R$ 38,17 |
| Logo após `createCart` (preço cheio + taxa de serviço de R$ 1,27) | R$ 52,17 |
| Após `setCartDelivery` (iFood aplicou R$ 25,45 de benefícios) | **R$ 26,72** |

O iFood só soma a taxa de serviço e aplica benefícios dentro do carrinho. Por isso a tela deve
mostrar o `total` de `/cart` antes de pedir a confirmação, e o `breakdown` (itens, entrega,
taxas, benefícios, cupons) explica a diferença. A resposta bruta do carrinho traz rua e número do
endereço; o backend só repassa os valores.

**Pedido — `POST /parties/:id/order` (Bearer)**

```json
{ "cartId": "…", "userConsent": true }
```

- Sem `userConsent: true` → `400 CONSENT_REQUIRED`, e o iFood **nem é chamado** (regra no
  backend, não só no frontend).
- Com consentimento → `submitOrder` → `{ orderId, simulated }`.

**Rastreio — `GET /parties/:id/order/:orderId` (Bearer)**

```json
{ "orderId": "…", "statusCode": "DISPATCHED", "description": "Merchant released order for delivery.",
  "retryAfterSeconds": 60, "terminal": false, "simulated": false }
```

- `retryAfterSeconds` vem do `agentHints.retryMessage` do iFood: consultar de novo só depois disso.
- `terminal: true` → parar de consultar.
- Mostrar `description` à pessoa; `statusCode` é só para lógica.
- `getOrder` não é usado: traz endereço e código de verificação, que não podem ir ao estado público.

Como cada chamada usa o token do próprio participante, o iFood garante que ninguém mexe no
carrinho ou pedido de outra pessoa.

---

## 9. Modo demo e modo iFood

### Visão geral

O backend roda em dois modos, escolhidos por `MCP_OAUTH_MODE`. **`demo`** permite montar e ensaiar
tudo sem contas reais; **`ifood`** conecta contas de verdade.

### Em detalhe

| Etapa | `demo` (padrão) | `ifood` |
| --- | --- | --- |
| Link de login | aponta direto para o nosso callback com um código fixo | `id.ifood.com.br/authorize` |
| Tokens | sintéticos | reais, por pessoa |
| Validação da conexão | não há (vai direto a `connected`) | `getUser` real |
| Opções | fixture real capturada, `source: simulated` | busca real, `source: live` (fixture se o iFood cair) |
| Carrinho e pedido | simulados (`simulated: true`) | reais |
| Rastreio | avança sozinho: confirmado → preparando → saiu → entregue em ~1 min | status real do iFood |
| Exige configuração | nada | `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET` e a redirect; sem eles, recusa subir |

O frontend usa as mesmas rotas nos dois modos; o campo `mode` (no authorize) e os campos
`source`/`simulated` dizem o que é real.

---

## 10. Como as etapas se relacionam

### Visão geral

Cada etapa produz exatamente o que a próxima consome. A Party produz a **identidade** da pessoa;
o OAuth transforma essa identidade em **acesso ao iFood**; o agente usa o acesso para produzir
**opções**; a opção escolhida vira **carrinho**; o carrinho, com consentimento, vira **pedido**.

```text
participantToken ──► authorize ──► state ──► callback ──► tokens no registro
       │                                                      │
       └──────────── authorizeParticipant ◄───────────────────┘
                              │
                     cliente MCP da pessoa
                              │
   tema + orçamento ──► resolveOptions ──► LocalOption (com selectedOptions)
                                                │
                                         prepareCart ──► cartId
                                                │  + userConsent
                                         submitOrder ──► orderId ──► trackOrder
```

### Em detalhe

| Etapa | Recebe | Produz | Quem consome |
| --- | --- | --- | --- |
| Criar / entrar | nome, id | `participantToken`, `partyId` | todas as rotas privadas |
| Authorize | `participantToken` | `state` (→ Party + pessoa + verifier), link | callback |
| Callback | `code`, `state` | tokens no `McpSessionRegistry`, `mcpConnectionStatus` | cliente MCP |
| `authorizeParticipant` | `participantToken` | `{ partyId, participantId }` | integração do agente |
| Cliente MCP | tokens da pessoa | chamadas autenticadas ao iFood | agente e checkout |
| Questionário e tema | respostas | `theme`, `budget`, `restrictions` | `/options` |
| `/options` | tema, orçamento, restrições, endereço | `LocalOption[]` com `selectedOptions` | `/cart` |
| `/cart` | `LocalOption` | `cartId`, total | `/order` |
| `/order` | `cartId` + `userConsent` | `orderId` | `/order/:orderId` |
| `/order/:orderId` | `orderId` | status, cadência, `terminal` | tela de acompanhamento |

Dependências que ainda dependem de outras pessoas:

- **Tema, orçamento e restrições** vêm do questionário e da regra de tema (Júlio e Matheus). Até lá,
  o frontend pode enviar valores fixos para `/options`.
- **Estados da Party depois de `READY_FOR_THEME`** (pedido, entrega) ainda não existem na máquina
  de estados; hoje as rotas devolvem o status, mas o snapshot da Party não muda.

---

## 11. Segurança

### Visão geral

Segredos e tokens ficam **só no backend e só em memória**. O estado público da Party mostra apenas
se cada pessoa está conectada. Toda ação no iFood usa o token do próprio dono, e nenhum pedido sai
sem o consentimento explícito dele.

### Em detalhe

- `client_secret`: só em variável de ambiente do backend; nunca no frontend, em logs, fixtures ou
  erros (testado: mensagens de erro não contêm secret, code nem tokens).
- Tokens do iFood: só no `McpSessionRegistry`, em memória; reiniciar a API descarta tudo.
- `PartySnapshot`: expõe só `mcpConnectionStatus`.
- PKCE + `state` de uso único com expiração de 10 minutos: um `code` ou callback interceptado não
  serve para nada.
- `participantToken` de uma Party não funciona em outra (`403`).
- Endereços: a API só devolve alias ou bairro e cidade; `getOrder` não é usado.
- `submitOrder` exige `userConsent: true` vindo da própria pessoa, verificado no backend.
- Arquivos locais com segredo (`docs/SECRET`, `opencode.json`, `.env`) estão no `.gitignore`.

---

## 12. Configuração e como rodar

### Visão geral

Sem configurar nada, a API sobe em modo `demo`. Para contas reais, defina as credenciais do agente
e a redirect cadastrada no portal do iFood.

### Em detalhe

| Variável | Obrigatória em `ifood` | Padrão / exemplo |
| --- | --- | --- |
| `MCP_OAUTH_MODE` | — | `demo` (ou `ifood`) |
| `IFOOD_CLIENT_ID` | sim | — |
| `IFOOD_CLIENT_SECRET` | sim | — |
| `PUBLIC_API_URL` | sim, se não houver `IFOOD_REDIRECT_URI` | `https://api.exemplo.com` |
| `IFOOD_REDIRECT_URI` | não | `PUBLIC_API_URL/mcp-connection/callback` |
| `IFOOD_AUTH_BASE_URL` | não | `https://id.ifood.com.br` |
| `IFOOD_MCP_URL` | não | `https://consumer-mcp.ifood.com.br/marketplace` |
| `FRONTEND_URL` | não | primeira origem de `CORS_ORIGIN` |

A redirect usada precisa estar **cadastrada no agente** (portal → Meus agentes → Redirect URL).

```bash
# demo
npm run dev:api

# iFood real, local, com a redirect hoje cadastrada (/callback na porta 8080)
PORT=8080 MCP_OAUTH_MODE=ifood PUBLIC_API_URL=http://localhost:8080 \
IFOOD_REDIRECT_URI=http://localhost:8080/callback \
IFOOD_CLIENT_ID=... IFOOD_CLIENT_SECRET=... \
npm run dev:api

# tokens para testes manuais com a sua conta (veja "opencode e testes manuais")
cp .env.example .env        # preencha IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET
npm run ifood:login         # login no navegador; grava os tokens no .env
npm run ifood:refresh       # renova o token sem novo login

# testes (inclui provider, cliente MCP, agente e checkout)
npm test

# spike de sessões (N contas, tokens só em memória)
node apps/api/dist/ifood/spike-sessions.js 2
```

---

### opencode e testes manuais

O opencode não faz parte do produto: é só uma ferramenta de exploração. O backend fala com o MCP
direto, pelo `IfoodMcpClient`.

**Login nativo do opencode.** Por padrão ele falha com `Issuer mismatch` (o iFood declara
`issuer: https://id.ifood.com.br/3p`, e o opencode exige igualdade com a URL anunciada). O campo
`auth_server_metadata_url` do opencode v2 resolve: ele passa a usar o issuer do próprio
documento. O `opencode.json` do repositório já está assim e **não contém segredo**, tudo vem de
variáveis de ambiente:

```json
"oauth": {
  "client_id": "{env:IFOOD_CLIENT_ID}",
  "client_secret": "{env:IFOOD_CLIENT_SECRET}",
  "redirect_uri": "{env:IFOOD_REDIRECT_URI}",
  "auth_server_metadata_url": "https://id.ifood.com.br/.well-known/openid-configuration"
}
```

Passos: preencher o `.env` (a partir do `.env.example`) e, no mesmo shell,
`set -a; . ./.env; set +a; opencode mcp auth ifood`. Confirmar com `opencode mcp list`.

- O `{env:...}` é resolvido pelo **serviço em segundo plano** do opencode, no ambiente em que ele
  nasceu. Se o serviço já estava rodando sem as variáveis, `client_id` fica vazio e o login falha
  com `does not support dynamic client registration`. Encerre o serviço (`opencode serve
  --service`) e rode o comando acima de um shell com o `.env` carregado.
- A redirect (`IFOOD_REDIRECT_URI`) precisa estar cadastrada no agente e ser `localhost`; só a
  porta pode variar. O padrão do opencode (`127.0.0.1:19876`) não está cadastrado.

**Tokens para scripts e testes manuais** (independentes do opencode):

| Peça | Papel |
| --- | --- |
| `.env` (ignorado pelo git, permissão 600) | `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_REDIRECT_URI` e os tokens |
| `npm run ifood:login` | abre o login, troca o code e grava `IFOOD_ACCESS_TOKEN`, `IFOOD_REFRESH_TOKEN` e a validade no `.env` |
| `npm run ifood:refresh` | renova o access token (~1 h) com o refresh token (~30 dias); `--force` renova sempre |

O refresh token dá acesso à conta por ~30 dias: o `.env` fica só na máquina de cada pessoa.

## 13. Mapa de arquivos

| Arquivo | O que faz |
| --- | --- |
| `apps/api/src/party/service.ts` | Party: criar, entrar, fechar, responder, status de conexão |
| `apps/api/src/party/access.ts` | `participantToken` |
| `apps/api/src/mcp/oauth-flow.ts` | PKCE, `state`, troca do code, gravação dos tokens |
| `apps/api/src/mcp/session-registry.ts` | tokens por `partyId + participantId`, em memória |
| `apps/api/src/mcp/demo-oauth-provider.ts` | provider do modo `demo` |
| `apps/api/src/ifood/provider.ts` | interface `McpOAuthProvider` (costura com o fluxo) |
| `apps/api/src/ifood/config.ts` | variáveis de ambiente do iFood |
| `apps/api/src/ifood/oauth-provider.ts` | link de login, troca do code e refresh no iFood |
| `apps/api/src/ifood/client.ts` | cliente MCP por participante |
| `apps/api/src/ifood/validate-connection.ts` | `getUser` → `connected` / `error` |
| `apps/api/src/ifood/checkout.ts` | carrinho, pedido e rastreio |
| `apps/api/src/ifood/spike-sessions.ts` | prova de várias sessões |
| `apps/api/src/ifood/local-login.ts` | login interativo em `localhost` (spike e CLI) |
| `apps/api/src/ifood/login-cli.ts` | `ifood:login` / `ifood:refresh`: tokens no `.env` |
| `apps/api/src/agent/resolve-options.ts` | agente de opções locais |
| `apps/api/src/agent/build-option.ts` | preço, pedido mínimo, orçamento, ordenação |
| `apps/api/src/agent/fallback.ts` | contingência com fixture |
| `apps/api/src/agent/integration.ts` | liga agente e checkout ao servidor (modos `ifood` e `demo`) |
| `apps/api/src/server.ts` | rotas HTTP |
| `fixtures/ifood-discovery-italiano.json` | respostas reais sanitizadas do iFood |
| `fixtures/options-italiano.json` | exemplo de saída de `/options` para o frontend |

---

## 14. Limitações conhecidas

- **Total estimado × total real:** o agente estima pelo preço da busca e não conhece a taxa de
  serviço nem os benefícios aplicados no carrinho. O orçamento é verificado sobre a estimativa; o
  valor final aparece em `/cart`. O formato das respostas do carrinho foi confirmado com um
  carrinho real (`fixtures/ifood-cart-italiano.json`).
- **Pedido real com Pix não pago (17/10/2026):** `submitOrder` devolveu o `orderId` e o
  `trackOrder` ficou em `PIX_CREATED`, com o Pix "copia e cola" dentro do texto do status. O
  backend separa esse código em `pixCode` e mostra "Aguardando o pagamento via Pix". Ainda não
  observamos o status de expiração do Pix nem um pedido pago.
- **Isolamento entre contas:** provado ao vivo com duas contas diferentes (spike de 17/10/2026:
  2 `sub` distintos, 3 rodadas, 0 vazamentos). Ainda não testado com três contas.
- **Redirect pública:** só `http://localhost:8080/callback` está cadastrada. A demo precisa da URL
  HTTPS da API cadastrada no agente.
- **Estados da Party** depois de `READY_FOR_THEME` ainda não existem.
- **Contrato** `ResolveOptions*` vive em `src/agent/types.ts` até ir para `packages/contracts`.
- **Tudo em memória:** reiniciar a API apaga Parties, tokens, carrinhos e pedidos simulados.
- **Latência:** ~10 s por participante para montar as opções (limite de 20 s).
