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
- Guardar o `participantToken` em `sessionStorage`; enviar `Authorization: Bearer <token>` só nas
  rotas privadas. Nunca na URL nem no estado compartilhado.

## Já funciona — pode construir agora

### 1. Lobby da Party

- `POST /parties` `{ name, host: { id, name } }` → `{ party, participantToken }`
- `POST /parties/:id/join` `{ participant: { id, name } }` → `{ party, participantToken }`
- `POST /parties/:id/close` (Bearer; "Iniciar party", só o host, exige 2–4 participantes)
- `GET /parties/:id` a cada 1–2s (polling). Traz `participants`, `hostParticipantId` (selo "Host"),
  `status` e `mcpConnectionStatus`.
- Link de convite: montado no front a partir do `code` (6 caracteres). Não há endpoint.

Estados: `OPEN` → `COLLECTING_ANSWERS` → `READY_FOR_THEME`.

### 2. Questionário (wizard "Etapa X de 8")

- `GET /questionnaire` → `{ version, title, introduction?, questions[] }`. Renderizar a partir
  daqui; não fixar campos.
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

## Ainda NÃO existe (não bloqueia)

- **Endereço (pergunta 1):** sem rota para listar/adicionar endereços ainda. Vai entrar um provider
  de demonstração + `GET /parties/:id/addresses` e `POST /parties/:id/addresses`, mesmo padrão do
  OAuth demo. **Enquanto isso, mockar a lista no front.** A questão `type: "address"` já existe; a
  resposta é uma string (`addressId`).
- Tema, votação, cardápio e pedidos: dependem das decisões do Júlio.

## Ordem sugerida

1. Corrigir o bug do `fetch`.
2. Lobby (1).
3. Questionário (2) e reconexão (3).
4. Conectar iFood (4).

Deixar o endereço mockado até as rotas subirem. Travou em algum contrato, chama que a API ajusta.
