# Handoff para o Colucci — API + front juntos

> Estado da API para o frontend avançar junto. Fonte de verdade: `apps/api/openapi.yaml`,
> tipos em `packages/contracts` e a seção "Handoff para o frontend" em
> [`docs/desenvolvimento.md`](desenvolvimento.md). Pull do `main`.

## Antes de tudo

Corrigir o bug do cliente de referência documentado em
[`docs/pendencias-frontend.md`](pendencias-frontend.md): `fetch` desvinculado → `Illegal
invocation` no navegador (passa nos testes do Node).

## Ambiente

- Base local: `http://localhost:3333`.
- CORS aceita lista separada por vírgula:
  `CORS_ORIGIN=http://localhost:5173,http://SEU_IP:5173 npm run dev:api` (testa do celular na rede).
  ⚠️ No **prod**, hoje o CORS libera **só** `https://ifood-party.matheushenrique2773.workers.dev`
  (origem do front no Workers). Para testar do `localhost:5173` contra a API de prod, é preciso
  **adicionar `http://localhost:5173` ao `CORS_ORIGIN` no Coolify**; senão o navegador bloqueia.
- Guardar o `participantToken` em `sessionStorage`; enviar `Authorization: Bearer <token>` só nas
  rotas privadas. Nunca na URL nem no estado compartilhado.

## Já funciona — pode construir agora

### 1. Lobby da Party

**Regra do produto (decidida em 17/10/2026): abrir a rota base sem `?code` cria a Party.**

São dois links, e o front decide pelo `?code`:

| Link | Quem abre | O que a tela faz |
| --- | --- | --- |
| Base (`https://<front>/`) | a 1ª pessoa | **cria** a Party (`POST /parties`) e mostra o link de convite |
| `…/?code=XXXXXX` | o resto do grupo | **entra** (`POST /parties/:code/join`) e cai no lobby |

- `POST /parties` (**sem autenticação**) `{ name, host: { id, name } }` → `{ party, participantToken }`
- `POST /parties/:code/join` `{ participant: { id, name } }` → `{ party, participantToken }`.
  Aceita **o `code`** (não só o `id`) — use o `code` do link.
- `POST /parties/:code/close` (Bearer; "Iniciar party", só o host, exige 2–4 participantes)
- `GET /parties/:code` a cada 1–2s (polling). Traz `participants`, `hostParticipantId` (selo "Host"),
  `status` e `mcpConnectionStatus`.
- Link de convite: montado no front a partir do `code` (6 caracteres, sem `0/O/1/I`). Não há endpoint.

**Cuidado com idempotência:** "criar ao abrir" **não é idempotente**. Reload, double-render (React
StrictMode) ou voltar para a tela pode criar **duas** Parties. Crie só quando não houver uma Party
válida na sessão — guarde `party.id` + `participantToken` e valide com `GET /parties/:id/session`
antes de criar de novo. Nunca deixe `POST /parties` num efeito/`useEffect` que roda duas vezes.

Estados: `OPEN` → `COLLECTING_ANSWERS` → `READY_FOR_THEME` → `THEME_REVEALED`.

### 1b. Revelar resultado (Etapa 8)

- `POST /parties/:id/reveal` (Bearer; só o host, só a partir de `READY_FOR_THEME`) →
  `party.status = THEME_REVEALED` e `party.theme` (**derivado**, não fixo — ver §5). Use para o botão
  "Revelar resultado" e para trocar a tela de resultado. Segundo `reveal` ou fora de
  `READY_FOR_THEME` retorna `409 NOT_READY_FOR_REVEAL`; outro participante recebe `403 HOST_ONLY`.
- Depois do reveal, **não** mande mais o tema no corpo: o `POST /parties/:id/options` usa
  `party.theme` sozinho. O campo `theme` do corpo virou **opcional** (fallback; `required: [budget]`),
  e o valor da Party vence.

### 1c. Progresso do pedido (pós-revelação)

Depois da revelação, o snapshot mostra o avanço de cada participante:

- `participant.orderStage`: `none` → `options_ready` → `cart_created` → `order_submitted` →
  `delivered` (marcado pelo servidor a cada rota bem-sucedida: `/options`, `/cart`, `/order`,
  `GET /order/:orderId`).
- `participant.orderId` e `participant.orderStatus` (último `status.code` do rastreio).

Os três campos são opcionais (não quebram mocks). Use pelo polling para mostrar quem já escolheu
opções, quem montou o carrinho e quem recebeu.

### 2. Questionário (wizard "Etapa X de 8")

- `GET /questionnaire` → `{ version, title, introduction?, questions[] }`. Renderizar a partir
  daqui; não fixar campos. A versão vigente é **`v2`** (7 perguntas); `v1` continua registrada
  (`GET /questionnaire?v=1`) para clientes antigos.
- Cada questão: `id`, `type` (`text`, `address`, `single_choice`, `multi_choice`, `scale`),
  `label`, `required` e, quando couber, `options` / `min` / `max` / `helpText` / `maxSelections` /
  `allowOther` + `otherOptionId` + `otherInput` (campo "Outro") / `customInput` ("Outro valor").
- Convenções do "Outro": texto em `answers["<questionId>__other"]`; valor digitado em
  `answers["<questionId>__value"]`.
- `POST /parties/:id/answers` (Bearer) `{ questionnaireVersion, answers, completed }`. `completed:
  false` salva um rascunho (progresso incremental por etapa); `true` conclui.
- Erros: `QUESTIONNAIRE_VERSION_UNKNOWN` e `INVALID_ANSWERS`
  (`details.issues = [{ questionId, reason }]`; `reason`: `required`, `invalid_option`,
  `too_many_selections`, `other_required`, `custom_value_required`, `out_of_range`, ...).
- A definição é provisória; as perguntas finais são do Júlio.
- Cada participante tem `questionnaireResponse` (ou `null`) e `answeredCount` no snapshot — usa
  para a tela "Etapa X de 8" e para o host ver `Pronto`/`Aguardando`.
- Quando todos enviam `completed: true`, a Party vira `READY_FOR_THEME` sozinha.

### 3. Reconexão

- `GET /parties/:id/session` (Bearer) → `{ participant }`. Usar no load para detectar sessão
  expirada (o estado é em memória; reiniciar a API invalida os tokens).

### 4. Conectar iFood (OAuth, em modo demo)

- `POST /parties/:id/mcp-connection/authorize` (Bearer) →
  `{ authorizationUrl, status: "validating", mode }`.
- Abrir `authorizationUrl`; o callback volta para o front; depois é só ler `mcpConnectionStatus`
  no polling (`not_connected`/`validating`/`connected`/`error`).
- `mode` vem `"demo"` hoje (tokens fictícios, sem iFood real até a homologação) — dá para marcar a
  UI como demonstração.

### 5. Tema derivado (como sai o `party.theme`)

**Não existe pergunta de tema** — o tema é **resultado** das respostas, em 3 níveis (nesta ordem):

1. **Explícito** — se alguma resposta já traz o tema.
2. **Sinais das Etapas 4–7** — tabela provisória em `apps/api/src/party/theme.ts`
   (`SIGNAL_THEME_RULES`); os sinais finais ainda são do Júlio.
3. **Vibe do dia** — fallback quando nada bate, pelo relógio do servidor:
   `"sabadou a distancia"` (sáb) / `"sextou a distancia"` (sex).

O valor gravado é um **slug** minúsculo sem acento (ex.: `sabadou a distancia`) e é usado também
como chave de busca no iFood. O front só **exibe** `party.theme`; não precisa conhecer a regra.

### 6. Mapa das telas existentes → chamadas

As telas já existem em `apps/web` (hoje com mock). Para integrar, cada uma troca o mock por:

| Tela (`apps/web`) | Hoje | Chamada da API |
| --- | --- | --- |
| `app/(party)/page.tsx` (`LobbyScreen`) | mock do host | `POST /parties` **ou** `POST /parties/:code/join` + `GET /parties/:code` (polling 1–2s) + `POST /parties/:code/close` + `POST /parties/:id/mcp-connection/authorize` |
| `party/address/page.tsx` (`AddressScreen`) | lista mock | questão `address` do `GET /questionnaire`; responder em `POST /parties/:id/answers`. **Lista de endereços ainda não tem rota** → mockar (§"Ainda NÃO existe") |
| `party/restrictions/page.tsx` (`RestrictionsScreen`) | `RestrictionId` local | questão `restrictions` do `GET /questionnaire` |
| `party/budget/page.tsx` (`BudgetScreen`) | `BudgetOptionId` local | questão `budget` do `GET /questionnaire` |
| `party/pending/[screen]` (`invite`, `new-address`, `next-question`) | placeholder | — (`invite` some com a regra de criar ao abrir) |

⚠️ **Os ids do mock do front não batem com os da API.** Ex.: restrições `vegetarian`/`peanut` no
mock vs. `vegetarianismo`/`alergia-amendoim` na v2; orçamento `"50"` vs. `ate-50`. Ao integrar,
**renderize a partir de `GET /questionnaire`** e pare de usar `lib/mock-questionnaire.ts` como
fonte de ids — senão o `POST /answers` volta `INVALID_ANSWERS`.

Falta criar (não existe em `apps/web`): a tela de **resultado** (`READY_FOR_THEME` →
`POST /parties/:id/reveal` → `THEME_REVEALED` com `party.theme`).

**Referência executável (teste):** `apps/web/app/test/` (rota `/test`) — integração mínima que já
funciona contra a API: cria/entra pela regra do `?code`, faz polling, baixa o questionário de
`GET /questionnaire` (sem ids fixos), conecta o iFood, revela o tema e busca opções. Serve para
validar o backend pelo navegador e como referência para ligar as telas de verdade — **não é a tela
final** (visual é do Otávio).

## Ainda NÃO existe (não bloqueia)

- **Endereço (pergunta 1):** sem rota para listar/adicionar endereços ainda. Vai entrar um provider
  de demonstração + `GET /parties/:id/addresses` e `POST /parties/:id/addresses`, mesmo padrão do
  OAuth demo. **Enquanto isso, mockar a lista no front.** A questão `type: "address"` já existe; a
  resposta é uma string (`addressId`).
- Votação, cardápio e pedidos: dependem das decisões do Júlio. (**Tema já não é pendência** — ver §5.)

## Ordem sugerida

1. Corrigir o bug do `fetch`.
2. Decidir pelo `?code` e **criar a Party ao abrir** a base (§1) — com a guarda de idempotência.
3. Lobby (1): polling, `close` e "Conectar iFood" (4).
4. Questionário (2) a partir de `GET /questionnaire` e reconexão (3) — trocando os ids do mock.
5. Resultado: `reveal` → `THEME_REVEALED` → `party.theme` (§5).

Deixar o endereço mockado até as rotas subirem. Travou em algum contrato, chama que a API ajusta.
