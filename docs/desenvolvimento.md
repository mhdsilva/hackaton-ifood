# Desenvolvimento — fundação da Party

## Início rápido

Requisitos: Node.js 22 e npm 10.

```bash
npm install
npm test
npm run dev:api
```

A API local usa `http://localhost:3333` e aceita por padrão o frontend em `http://localhost:5173`. `CORS_ORIGIN` aceita uma lista separada por vírgula, útil para testar de portas diferentes e de celulares na mesma rede:

```bash
CORS_ORIGIN=http://localhost:5173,http://192.168.0.10:5173 npm run dev:api
```

## Fontes de verdade

- [especificação deste recorte](superpowers/specs/2026-10-17-party-foundation-design.md);
- [plano de implementação](superpowers/plans/2026-10-17-party-foundation.md);
- [OpenAPI](../apps/api/openapi.yaml);
- [autenticação do iFood MCP](ifood-mcp.md);
- [decisão de sessões MCP](adr/0001-uma-sessao-mcp-por-participante.md);
- [ensaio em três dispositivos](rehearsal-party-foundation.md).

## Handoff para o frontend

Ao criar ou entrar, salvar `participantToken` em `sessionStorage`. Enviar o valor como `Authorization: Bearer <token>` somente nas rotas privadas. Nunca colocar o token na URL ou no estado compartilhado.

Consultar `GET /parties/:id` a cada 1–2 segundos. Parar o polling ao desmontar a tela e tratar `404` como Party indisponível.

**Validar a sessão ao carregar:** `GET /parties/:id/session` (Bearer) devolve `{ participant }`. Como o estado é em memória, um restart da API invalida os tokens; use esta rota para tratar "sessão expirada, entrar de novo" antes de montar a tela.

**Listar endereços do próprio participante:** `GET /parties/:id/addresses` (Bearer) devolve `{ addresses: [{ addressId, label, isLastUsedAddress }] }`. `label` usa o alias ou, sem alias, bairro e cidade. Não devolve rua, número, CEP ou coordenadas. O modo demo retorna um endereço sintético de São Carlos. Sem OAuth ativo no modo real, retorna `409 MCP_NOT_CONNECTED`.

**Adicionar endereço:** primeiro chame `POST /parties/:id/addresses/resolve` com `{ address }`. A resposta `{ matchConfidence, candidates, simulated }` contém candidatos sem coordenadas; a pessoa escolhe um, confirma o endereço formatado e informa bairro se estiver vazio. Depois chame `POST /parties/:id/addresses` com `{ address, candidateId, neighborhood?, alias?, complement?, reference? }`. A chamada de confirmação é a única que persiste no iFood; pode ser repetida com segurança: primeira criação `201`, retry idempotente `200` com `alreadyExists: true`. Ambas as rotas usam o token e a sessão iFood do participante. O modo demo marca `simulated: true` e mantém endereços sintéticos somente em memória.

Exemplo resumido:

```http
POST /parties/party-123/addresses/resolve
Authorization: Bearer <participantToken>
Content-Type: application/json

{"address":"Rua Episcopal, 123, São Carlos, SP"}
```

```json
{"matchConfidence":"SINGLE","candidates":[{"candidateId":"candidate-abc","formattedAddress":"Rua Episcopal, 123, Centro, São Carlos, SP","neighborhood":"Centro","city":"São Carlos","state":"SP"}],"simulated":false}
```

Depois de a pessoa confirmar o candidato, persista-o:

```http
POST /parties/party-123/addresses
Authorization: Bearer <participantToken>
Content-Type: application/json

{"address":"Rua Episcopal, 123, São Carlos, SP","candidateId":"candidate-abc","neighborhood":"Centro","alias":"Casa"}
```

A resposta expõe somente o identificador e um rótulo seguro; rua completa, CEP e coordenadas não são devolvidos pela API.

**Renderizar o formulário dinamicamente:** `GET /questionnaire` devolve a definição atual (`{ version, title, introduction?, questions[] }`). Cada questão tem `id`, `type` (`text`, `address`, `single_choice`, `multi_choice`, `scale`), `label`, `required` e, quando couber, `options`/`min`/`max`/`helpText`. Questões de múltipla escolha podem ter `maxSelections` (ex.: "até 2"); opções podem ter `value` (número, ex.: faixa de orçamento); e uma questão pode ter `allowOther`/`otherOptionId`/`otherInput` (campo "Outro") ou `customInput` ("Outro valor" digitado). A questão `address` não tem `options` — as opções vêm do iFood (`listAddresses`). As perguntas ainda são provisórias; a tela não deve fixar campos.

Envie cada etapa incrementalmente (rascunho) ou tudo no fim, usando o `version` recebido:

```ts
type SubmitAnswersRequest = {
  questionnaireVersion: string
  answers: Record<string, unknown>
  completed: boolean   // false = rascunho; true = conclui a Etapa 8
}
```

Convenções do "Outro": o texto livre vai em `answers["<questionId>__other"]` (string) e o valor digitado do "Outro valor" em `answers["<questionId>__value"]` (number).

O backend valida as respostas contra a definição (`requireComplete` só quando `completed: true`). Erros em `POST /parties/:id/answers`: `QUESTIONNAIRE_VERSION_UNKNOWN` e `INVALID_ANSWERS` (com `details.issues = [{ questionId, reason }]`; `reason` pode ser `required`, `invalid_option`, `too_many_selections`, `other_required`, `custom_value_required`, `out_of_range`, `invalid_text`/`invalid_address`).

Cada `participant` no snapshot traz `answeredCount` (quantas perguntas já respondeu) e `questionnaireResponse.completed` — use para a tela "Etapa X de 8" e para o host ver `Pronto`/`Aguardando`. A Party vira `READY_FOR_THEME` quando **todos** enviam `completed: true`.

**Revelar resultado (host):** `POST /parties/:id/reveal` (Bearer; só o host, só em `READY_FOR_THEME`) leva a Party a `THEME_REVEALED` e grava `party.theme` **derivado das respostas** (explícito → sinais das Etapas 4–7 → vibe do dia, ex.: `sabadou a distancia`; a regra vive em `apps/api/src/party/theme.ts` e a tabela de sinais será refinada pelo Júlio). Erros: `403 HOST_ONLY`, `409 NOT_READY_FOR_REVEAL`. Depois disso, o front lê `party.theme` e **não** precisa mais mandá-lo: `POST /parties/:id/options` usa o tema da Party (o `theme` do corpo virou opcional/fallback); todos veem pelo polling.

**Retrospectiva v1 (sem feedback):** após cada participante acompanhar o pedido por `GET /parties/:id/order/:orderId`, qualquer integrante autenticado pode consultar `GET /parties/:id/retrospective`. Enquanto a Party ainda não revelou o tema ou algum pedido não chegou a `CONCLUDED`, a resposta é `{ state: "waiting_for_deliveries", pendingDeliveryCount }`. Quando todos concluírem, `state` vira `ready` e `summary` contém nome/tema, número de participantes e pedidos, quantidade de unidades nas opções enviadas aos carrinhos, número de estabelecimentos distintos e a maior distância entre endereços escolhidos, aproximada em linha reta. A distância usa somente coordenadas mantidas no backend e a resposta expõe apenas o resultado agregado; se faltar coordenada, `maxDistanceKm` é omitida (como no modo demo, que não inventa localizações). A interface deve informar que o grupo verá essa distância agregada, sem revelar os endereços individuais. Não há feedback nem duração nesta versão. Os dados agregados ficam em memória, como o restante do MVP.

O indicador de conclusão vem do status `CONCLUDED`, não apenas de `pollingStop`. Na integração demo, esse status significa entrega simulada concluída. No iFood real, `CONCLUDED` é um estado final, mas pode ser emitido pela confirmação da entrega/retirada ou por timeout automático; portanto, não é prova de entrega física em mãos ([documentação de ciclo de vida do pedido](https://developer.ifood.com.br/pt-BR/docs/guides/order/)).

## Conexão MCP (OAuth por participante)

O fluxo OAuth 2.1 com PKCE já está implementado atrás de duas rotas:

1. `POST /parties/:id/mcp-connection/authorize` (Bearer do participante) → gera `state` e PKCE,
   devolve `{ authorizationUrl, status: "validating", mode }`;
2. `GET /parties/:id/mcp-connection/callback?code&state` (sem Bearer; o `state` identifica
   `partyId + participantId`) → troca o `code` por tokens, guarda no registro privado e
   redireciona o navegador de volta ao frontend.

`McpOAuthFlow` (`apps/api/src/mcp/oauth-flow.ts`) mantém `state` de uso único com expiração e o
`code_verifier`; `McpSessionRegistry` guarda os tokens isolados por Party e participante. O
estado público só expõe `mcpConnectionStatus` (`validating`, `connected` ou `error`); nunca
`client_secret`, `access_token`, `refresh_token` ou codes.

O provedor real do iFood já existe (`IfoodMcpOAuthProvider`, em `apps/api/src/ifood/`).
`MCP_OAUTH_MODE=ifood` sobe quando `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET` e a redirect estão
definidos; sem essa config, recusa subir de propósito. O `MCP_OAUTH_MODE` aceita `demo` ou `ifood`
— qualquer outro valor recusa subir. O `IfoodMcpClient` renova o `access_token` com o
`refresh_token` antes de expirar.

O modo de checkout é independente da conexão MCP. Para uma apresentação com dados reais, use
`MCP_OAUTH_MODE=ifood` e `CHECKOUT_MODE=simulated`: perfil, recomendações e buscas continuam usando
o MCP real; carrinho, confirmação e rastreio são simulados localmente, sem chamar as tools de
carrinho nem `submitOrder` no iFood. O rastreio avança em 12 segundos até liberar a retrospectiva.
`CHECKOUT_MODE=ifood` mantém o envio real, que exige consentimento explícito do participante. O
padrão é `ifood` quando o MCP está em modo real.

O que ainda falta para produção:

- cadastrar a redirect pública HTTPS (`PUBLIC_API_URL/mcp-connection/callback`) no agente do iFood
  (hoje só `http://localhost:8080/callback` está cadastrada);
- repetir o spike do [ADR de sessões](adr/0001-uma-sessao-mcp-por-participante.md) com três contas
  (feito com duas);
- os estados da Party depois de `READY_FOR_THEME` e as rotas de tema, que são dos outros marcos.

Detalhes do modelo real em [`docs/ifood-mcp.md`](ifood-mcp.md).

## Publicação na Oracle (Coolify/Traefik)

O servidor Oracle já roda o Coolify, que opera o Traefik nas portas 80 e 443. Não há proxy no `compose.yaml`: o Coolify gera as labels de roteamento e o certificado TLS.

Aponte o DNS do domínio para o IP da instância e, no Coolify, crie um recurso **Application** com build pack Docker Compose apontando para este repositório:

- Docker Compose Location: `/compose.yaml`;
- Domínio no serviço `api`: `https://api.exemplo.com`, porta interna `3333`;
- Variáveis de ambiente:
  - `PUBLIC_API_URL=https://api.exemplo.com`;
  - `CORS_ORIGIN=https://party.exemplo.com`;
  - `MCP_OAUTH_MODE=demo` (padrão) ou `ifood` (conexão real);
  - `CHECKOUT_MODE=simulated` para a apresentação sem envio ou cobrança; `ifood` para checkout real;
  - em `ifood`: `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET` e, se a redirect não for derivada de
    `PUBLIC_API_URL`, `IFOOD_REDIRECT_URI`.

`PUBLIC_API_URL` é obrigatório no deploy: é a base do callback OAuth e precisa ser a URL HTTPS
pública da API (não `localhost`), alcançável pelo navegador do participante. `MCP_OAUTH_MODE` tem
padrão `demo`; em `ifood`, o container precisa das credenciais do agente e a redirect usada deve
estar cadastrada no portal do iFood. O `compose.yaml` repassa `IFOOD_CLIENT_ID`,
`IFOOD_CLIENT_SECRET` e `IFOOD_REDIRECT_URI` (opcional) ao serviço `api`; cadastre os valores como
variáveis/segredos no Coolify, nunca no arquivo.

A porta 3333 não é publicada no host. O proxy do Coolify alcança o contêiner `api` pela rede do recurso.

Verifique:

```bash
curl https://api.exemplo.com/health
```

Esperado: `{"status":"ok"}`. Status, logs e o domínio concreto ficam no painel do Coolify, fora do Git.

## Decisões deste recorte

- estado e tokens ficam em memória;
- a conexão MCP usa OAuth 2.1 por participante; o modo `demo` (padrão) serve para ensaiar sem contas reais e `ifood` conecta contas de verdade;
- duas pessoas no mínimo e quatro no máximo;
- somente o anfitrião fecha o grupo;
- depois do fechamento, o último participante a concluir causa a transição automática;
- polling substitui WebSocket;
- o host revela o resultado (`POST /parties/:id/reveal`); o recorte avança até `THEME_REVEALED`.
