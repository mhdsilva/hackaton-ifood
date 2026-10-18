# Handoff — integração real do front com o backend

> De: Maeda. 18/10/2026. Para: Otávio (dono de `apps/web`) e quem pegar o próximo ajuste.
> Resumo de alto nível em [`como-funciona.md`](como-funciona.md); status de marcos em
> [`marcos.md`](marcos.md).

## O que entrou

Troquei o `MockPartyProvider` por um novo `LivePartyProvider`
(`apps/web/components/party/live-party-provider.tsx`), que fala com a API de verdade. O
`mock-party-provider.tsx` continua intacto, sem uso — serve de referência/fallback.

- **Lobby**: criar/entrar vira `POST /parties` ou `POST /parties/:code/join` de verdade (tela
  de entrada provisória, sem desenho do Júlio — só o nome da Party). O nome da pessoa **não é
  pedido**: até o OAuth, o servidor usa "Anfitrião"/"Convidado N" e o `getUser` da conexão MCP
  troca pelo `fullName` da conta. Sessão persiste em `sessionStorage`
  (`ifood-party-live-session`); `GET /parties/:id` em polling a cada 1,5s; "Iniciar party" chama
  `POST /parties/:id/close`.
- **Questionário**: busca `GET /questionnaire` uma vez por sessão. Se der certo, as telas de
  restrições/orçamento/energia/formato do pedido/desejos/exclusões passam a mostrar as opções
  **reais** da API; se falhar, caem pro catálogo fixo do Figma (`usingLiveCatalog: false`) e
  ficam assim a sessão inteira — nunca troca de catálogo no meio. O envio final vira
  `POST /parties/:id/answers`.
- **Revelar resultado**: chama `POST /parties/:id/reveal` antes de navegar pra
  `/party/preparing` (a tela de animação do Otávio). A preparação usa os participantes reais e
  uma bola em órbita por pessoa. Depois dela, `/party/countdown` → `/party/reveal` mostram
  `party.theme` e `party.themeReason`; como só existe a arte italiana, todos os temas usam
  `theme-italian.png` por enquanto. O pedido em `/party/order` agora é real: `resolveOrderOptions`
  chama `POST /parties/:id/options` com o token do participante, e a API resolve via agente/MCP
  usando o tema da Party + orçamento, restrições e endereço das respostas dele. A tela tem
  carregamento, erro com “Conectar iFood”/“Tentar de novo” e até três opções (“Gerar outra
  opção” alterna); sem loja que caiba, não cai para um menu fictício. O checkout segue em
  `/party/pending/checkout`; o modo mock continua com o cenário de `lib/mock-reveal.ts`.
- **Orçamento “Outro valor”**: o front valida a faixa de `budget.customInput` da API (1–999)
  antes de continuar. Fora dela, o envio falhava com `INVALID_ANSWERS`/`custom_value_required`;
  agora o botão fica bloqueado e a tela mostra a faixa.
- **Conectar iFood**: botão novo, provisório, no lobby (sem desenho — ver bug abaixo).

Arquivos novos: `live-party-provider.tsx`, `lib/live-answers.ts` (tradução dos ids do catálogo
mock pros ids reais, só usada quando `usingLiveCatalog` é falso), `lib/api-client.ts` (promovido
de `app/test/live-api.ts`, agora compartilhado).

## ✅ Corrigido — "Conectar iFood" não fazia nada

**Sintoma:** clicar no botão não abria login nenhum, sem erro visível.

**Causa:** `connectMcp` (em `live-party-provider.tsx`) chamava `liveApi.authorizeMcp(...)` (uma
requisição `await`) e só depois chamava `window.open(url, "_blank")`. Navegador bloqueia popup
aberto fora do gesto síncrono do clique — como o `window.open` rodava só depois do `await`, o
bloqueio era silencioso. Era bug de popup-blocker, não da API.

**Correção aplicada:** a própria aba navega para a URL de autorização.

```ts
const result = await liveApi.authorizeMcp(session.partyId, session.token);
window.location.assign(result.authorizationUrl);
```

Isso combina com o fluxo desenhado: depois do login o backend redireciona para `FRONTEND_URL`
(hoje a raiz do Workers) e a sessão volta do `sessionStorage`, então o app reabre no mesmo
lobby sozinho. Os parâmetros `?partyId=...&mcp=connected` continuam ignorados; o status chega
pelo polling de `GET /parties/:id`.

## Endereço real (entrou depois deste handoff)

`/party/address` deixou de ser 100% mock:

- `GET /parties/:id/addresses` alimenta a lista quando a conta do iFood está conectada. O
  polling só refaz a busca quando o `mcpConnectionStatus` muda (`session` + status formam a
  chave da requisição).
- Sem conexão a API responde `409 MCP_NOT_CONNECTED`; a tela mantém os **endereços de
  exemplo** e avisa explicitamente que não vêm do iFood (nunca simula sucesso).
- O item escolhido guarda o `addressId` real (`ParticipantAddress.addressId`), que é o que
  `POST /parties/:id/options` espera em `addressId`.
- "Adicionar novo endereço" (`/party/pending/new-address`) agora funciona de verdade, com
  apresentação provisória: `POST /addresses/resolve` → escolher candidato → `POST /addresses`
  → volta para `/party/address` com o endereço novo selecionado.

Ainda falta o desenho do Júlio para essa tela e para o detalhe do endereço (complemento,
apelido, referência). O envio ficou só com `address` + `candidateId` + `neighborhood`.

## Fluxo coletivo (sem socket)

Não existe webhook nem WebSocket: cada navegador já consulta `GET /parties/:id` a cada 1,5 s.
O que faltava era **reagir** ao estado. `lib/party-flow.ts` (`partyFlowTarget`) decide o destino
automático a cada snapshot e o provider chama `router.replace`:

| Estado da Party | Quem está no lobby | Quem está numa tela de pergunta | Quem está na espera |
| --- | --- | --- | --- |
| `OPEN` | fica | fica | fica |
| `COLLECTING_ANSWERS` | vai para `/party/address` | fica (ou vai para a espera se já concluiu) | fica |
| `READY_FOR_THEME` | vai para `/party/waiting` | vai para `/party/waiting` | fica |
| `THEME_REVEALED` | vai para `/party/preparing` | vai para `/party/preparing` | vai para `/party/preparing` |

Telas `/party/pending/*`, `/party/preparing` e a própria espera nunca são interrompidas. Assim,
quando o anfitrião aperta "Iniciar party", os convidados saem do lobby sem clique; quando ele
revela o tema, todos entram na preparação juntos. O polling continua sendo a única fonte de
verdade — abas em segundo plano podem atrasar a transição até o navegador liberar os timers.

## Sessão antiga × link novo

A sessão em `sessionStorage` é restaurada ao abrir o app. Se a URL trouxer `?code=...` de uma
Party diferente da sessão guardada, a sessão antiga é descartada e a pessoa entra na Party do
link. Sem isso, quem já tinha testado antes abria o convite novo e continuava no lobby da Party
antiga — o anfitrião nunca via a pessoa entrar.


## O que ainda fica fora (sem desenho do Júlio)

- **Detalhe do endereço**: a tela de adicionar endereço funciona, mas só envia `address`,
  `candidateId` e `neighborhood`; complemento, apelido e referência ainda não têm campo.
- **Opções, carrinho, pedido**: não existem telas. `POST /parties/:id/options`,
  `/cart`, `/order`, `/order/:id`, `GET /parties/:id/retrospective` já existem no backend.
- **Vouchers**: backend só lê o total com cupom, não aplica (`D3` em `marcos.md`).

## Verificação

Depois da correção do botão e da ligação do endereço: `typecheck:web`, `lint:web`, `build:web`
(produção, 18 rotas) e `npm test` na raiz limpos. O clique do "Conectar iFood" ainda precisa ser
conferido no navegador de verdade — redirecionamento de aba não aparece em tipo, lint ou build.
