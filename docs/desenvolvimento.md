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

**Renderizar o formulário dinamicamente:** `GET /questionnaire` devolve a definição atual (`{ version, title, introduction?, questions[] }`). Cada questão tem `id`, `type` (`text`, `single_choice`, `multi_choice`, `scale`), `label`, `required` e, quando couber, `options`/`min`/`max`. As perguntas ainda são provisórias; a tela não deve fixar campos. Envie as respostas neste envelope, usando o `version` recebido:

```ts
type SubmitAnswersRequest = {
  questionnaireVersion: string
  answers: Record<string, unknown>
  completed: true
}
```

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

O que falta para produção:

- trocar `DemoMcpOAuthProvider` pelo provedor real do iFood quando o agente for homologado
  (`MCP_OAUTH_MODE` só aceita `demo`; qualquer outro valor recusa subir de propósito);
- renovar o `access_token` com o `refresh_token` antes de expirar (hoje os tokens são apenas
  guardados);
- executar o spike do [ADR de sessões](adr/0001-uma-sessao-mcp-por-participante.md). A interface
  pública da Party não depende de a biblioteca usar clientes no mesmo processo ou processos
  trabalhadores.

Detalhes do modelo real em [`docs/ifood-mcp.md`](ifood-mcp.md).

## Publicação na Oracle (Coolify/Traefik)

O servidor Oracle já roda o Coolify, que opera o Traefik nas portas 80 e 443. Não há proxy no `compose.yaml`: o Coolify gera as labels de roteamento e o certificado TLS.

Aponte o DNS do domínio para o IP da instância e, no Coolify, crie um recurso **Application** com build pack Docker Compose apontando para este repositório:

- Docker Compose Location: `/compose.yaml`;
- Domínio no serviço `api`: `https://api.exemplo.com`, porta interna `3333`;
- Variáveis de ambiente:
  - `PUBLIC_API_URL=https://api.exemplo.com`;
  - `CORS_ORIGIN=https://party.exemplo.com`;
  - `MCP_OAUTH_MODE=demo` (padrão).

`PUBLIC_API_URL` é obrigatório no deploy: é a base do callback OAuth e precisa ser a URL HTTPS
pública da API (não `localhost`), alcançável pelo navegador do participante. `MCP_OAUTH_MODE`
tem padrão `demo`; qualquer outro valor recusa subir até o provedor real existir.

A porta 3333 não é publicada no host. O proxy do Coolify alcança o contêiner `api` pela rede do recurso.

Verifique:

```bash
curl https://api.exemplo.com/health
```

Esperado: `{"status":"ok"}`. Status, logs e o domínio concreto ficam no painel do Coolify, fora do Git.

## Decisões deste recorte

- estado e tokens ficam em memória;
- a conexão MCP usa OAuth 2.1 por participante, em modo de demonstração até a homologação;
- duas pessoas no mínimo e quatro no máximo;
- somente o anfitrião fecha o grupo;
- depois do fechamento, o último participante a concluir causa a transição automática;
- polling substitui WebSocket;
- o recorte termina em `READY_FOR_THEME`.
