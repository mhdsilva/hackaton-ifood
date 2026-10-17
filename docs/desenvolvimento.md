# Desenvolvimento — fundação da Party

## Início rápido

Requisitos: Node.js 22 e npm 10.

```bash
npm install
npm test
npm run dev:api
```

A API local usa `http://localhost:3333` e aceita por padrão o frontend em `http://localhost:5173`. Para outra origem:

```bash
CORS_ORIGIN=https://party.exemplo.com npm run dev:api
```

## Fontes de verdade

- [especificação deste recorte](superpowers/specs/2026-10-17-party-foundation-design.md);
- [plano de implementação](superpowers/plans/2026-10-17-party-foundation.md);
- [OpenAPI](../apps/api/openapi.yaml);
- [decisão de sessões MCP](adr/0001-uma-sessao-mcp-por-participante.md);
- [ensaio em três dispositivos](rehearsal-party-foundation.md).

## Handoff para o Otávio

Ao criar ou entrar, salvar `participantToken` em `sessionStorage`. Enviar o valor como `Authorization: Bearer <token>` somente nas rotas privadas. Nunca colocar o token na URL ou no estado compartilhado.

Consultar `GET /parties/:id` a cada 1–2 segundos. Parar o polling ao desmontar a tela e tratar `404` como Party indisponível.

O questionário deve produzir este envelope sem fixar suas perguntas no cliente de API:

```ts
type SubmitAnswersRequest = {
  questionnaireVersion: string
  answers: Record<string, unknown>
  completed: true
}
```

## Handoff para o Maeda

O endpoint `POST /parties/:id/mcp-connection` já recebe e isola a chave por Party e participante. Hoje ele responde `validating` sem chamar o MCP.

Implementar a validação real por trás do registro privado e atualizar somente `mcpConnectionStatus` para `connected` ou `error`. Não adicionar a chave a `PartySnapshot`, prompts, fixtures, logs ou erros.

Executar primeiro o spike do [ADR de sessões](adr/0001-uma-sessao-mcp-por-participante.md). A interface pública da Party não depende de a biblioteca usar clientes no mesmo processo ou processos trabalhadores.

## Publicação na Oracle

No servidor, configure DNS para o IP da instância e execute:

```bash
API_HOST=api.exemplo.com \
CORS_ORIGIN=https://party.exemplo.com \
docker compose up -d --build
```

Caddy publica somente as portas 80 e 443 e encaminha para a API dentro da rede do Compose. A porta 3333 não é publicada no host.

Verifique:

```bash
curl https://api.exemplo.com/health
docker compose ps
docker compose logs --tail=100 api caddy
```

O domínio concreto e qualquer credencial ficam no ambiente do servidor, fora do Git.

## Decisões deste recorte

- estado, tokens e chaves ficam em memória;
- duas pessoas no mínimo e quatro no máximo;
- somente o anfitrião fecha o grupo;
- depois do fechamento, o último participante a concluir causa a transição automática;
- polling substitui WebSocket;
- o recorte termina em `READY_FOR_THEME`.
