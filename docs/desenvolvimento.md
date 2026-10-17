# Desenvolvimento — Sprint 0

## Início rápido

Requisitos: Node.js 22 e npm 10.

```bash
npm install
npm run dev:api
```

A API fica disponível em `http://localhost:3333`. Para conferir que o processo está no ar:

```bash
curl http://localhost:3333/health
```

O contrato HTTP está em [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) e os tipos compartilhados estão em [`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts).

A estratégia para múltiplas chaves e sessões está registrada em [`docs/adr/0001-uma-sessao-mcp-por-participante.md`](adr/0001-uma-sessao-mcp-por-participante.md).

## Fronteiras de trabalho

| Pessoa | Pode editar agora | Contrato que consome |
| --- | --- | --- |
| Otávio | `apps/web/**` | `PartySnapshot` ou `fixtures/party.json` |
| Maeda | `apps/api/src/ifood/**`, `apps/api/src/agent/**`, fixtures do iFood | `ResolveKitInput` e `ResolveKitOutput` |
| Matheus | `apps/api/src/party/**`, `packages/contracts/**`, integração | Todos os contratos |
| Júlio | Figma, fluxo, textos e roteiro | estados de `PartyStatus` |

Até o checkpoint, mudanças nos tipos compartilhados passam pelo Matheus. Implementações de frontend e MCP não devem alterar `apps/api/src/party/**`.

## Fluxo da API

```text
POST /parties
POST /parties/:id/join
POST /parties/:id/advance          LOBBY → COLLECTING_ANSWERS
POST /parties/:id/answers          uma vez por participante
POST /parties/:id/advance          COLLECTING_ANSWERS → PLANNING
POST /parties/:id/plan             PLANNING → REVIEWING_CARTS
POST /parties/:id/ready            uma vez por participante
POST /parties/:id/advance          REVIEWING_CARTS → ORDERING
POST /parties/:id/order-status     uma vez por participante
POST /parties/:id/advance          ORDERING → WAITING_DELIVERIES
POST /parties/:id/order-status     atualizar até delivered
POST /parties/:id/advance          WAITING_DELIVERIES → READY_TO_PLAY
POST /parties/:id/advance          READY_TO_PLAY → PLAYING
POST /parties/:id/advance          PLAYING → COMPLETED
```

`advance` move apenas para o próximo estado e valida as condições coletivas. Quando algo ainda falta, a resposta `409` inclui os participantes pendentes em `error.details.participantIds`.

## Handoff para o Otávio

Começar com a fixture:

```ts
import demoParty from "../../../fixtures/party.json"
```

Depois trocar por:

```ts
const response = await fetch(`${API_URL}/parties/${partyId}`)
const party = response.ok ? await response.json() : demoParty
```

O backend habilita CORS no Sprint 0. Não há WebSocket; a tela de acompanhamento pode consultar `GET /parties/:id` periodicamente.

## Handoff para o Maeda

O adaptador do agente deve expor esta fronteira:

```ts
import type { ResolveKitInput, ResolveKitOutput } from "@sidequest/contracts"

export async function resolveKit(input: ResolveKitInput): Promise<ResolveKitOutput> {
  // Implementação isolada em apps/api/src/agent/**
}
```

Cada item devolvido precisa cumprir um `role` da missão. O `POST /plan` aceita um kit por participante e valida se todos os papéis foram atendidos.

## Decisões congeladas até o checkpoint

- A API guarda dados apenas em memória; reiniciar o processo apaga as Parties.
- Cada participante usa um único estabelecimento e um único carrinho.
- O MCP não é chamado pelo Party Coordinator neste sprint.
- Cada participante confirma seu carrinho e seu pedido individualmente.
- O frontend pode usar a fixture como fallback durante toda a demo.
- `POST /advance` controla a máquina de estados; não existe transição em segundo plano.

## Bloqueios a validar no checkpoint

- quantidade de sessões simultâneas permitidas pelo iFood MCP;
- formato real das estimativas de entrega retornadas pelo MCP;
- estratégia da demo para participantes sem sessão autenticada;
- quais campos precisam ser sanitizados nas fixtures reais.
