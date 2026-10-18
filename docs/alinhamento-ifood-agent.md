# Alinhamento — iFood Agent × Party Coordinator

> Mensagem do Maeda para o Matheus, em 17 de outubro de 2026. Branch: `feature/ifood-agent`.
> Visão geral do que foi construído: [`como-funciona.md`](como-funciona.md).

## 1. O que está pronto e testado

- Provider OAuth real do iFood, cliente MCP por participante (com refresh automático),
  `validateConnection` e o agente de opções locais.
- Carrinho, pedido e rastreio. Testado ao vivo: opções reais, carrinho real e um pedido real com
  Pix sem pagar (status `PIX_CREATED`).
- Rotas novas: `POST /parties/:id/options`, `/cart`, `/order` e
  `GET /parties/:id/order/:orderId`, no OpenAPI. `submitOrder` só roda com `userConsent: true`,
  verificado no backend.
- O modo `demo` responde às rotas novas com opções e pedido simulados, para o frontend montar as
  telas.

## 2. Arquivos da área do Matheus que foram alterados (revisar)

- `apps/api/src/server.ts`: `MCP_OAUTH_MODE=ifood` agora sobe (exige `IFOOD_CLIENT_ID`,
  `IFOOD_CLIENT_SECRET` e a redirect) e as rotas acima.
- `apps/api/src/mcp/oauth-flow.ts`: `complete()` com `partyId` opcional; a Party sai do `state`.
- `apps/api/src/mcp/demo-oauth-provider.ts`: aponta para o callback único.
- `apps/api/openapi.yaml`, `server.test.ts`, `openapi.test.ts` e `apps/api/package.json`
  (novos testes no script `test`).

## 3. Divergências com o plano anterior

- **Callback único.** O iFood compara a redirect URI inteira com a cadastrada, e só a porta pode
  variar em `localhost`. Com `:id` no caminho, cada Party gerava uma redirect diferente e o login
  falhou (`invalid_request`). O servidor atende no caminho da redirect configurada
  (`PUBLIC_API_URL/mcp-connection/callback` por padrão). A rota antiga continua aceita e está
  marcada como obsoleta.
- `docs/desenvolvimento.md` ainda diz que `MCP_OAUTH_MODE` só aceita `demo` e que o provider
  depende de "homologação". Já não vale: o agente do hackathon tem credenciais e funciona.
- O README coloca carrinho e pedido fora do primeiro recorte. Foram adiantados; não muda nada até
  `READY_FOR_THEME`.

## 4. Endereços

O handoff do Colucci prevê `GET/POST /parties/:id/addresses` com provider de demonstração. O
endereço real vem do `listAddresses` do iFood, que o agente já usa. Proposta: o agente expõe
`listAddresses` (só alias, ou bairro e cidade; nunca rua, número ou CEP) e o Matheus liga a rota.
A resposta da pergunta continua sendo o `addressId`, que `/options` já aceita.

## 5. O que o Maeda precisa do Matheus

- **Domínio HTTPS** da API na Oracle, para cadastrar a redirect pública no portal do iFood (hoje
  só `http://localhost:8080/callback` está cadastrada).
- **Estados da Party** depois de `READY_FOR_THEME` (pedido e entrega). As rotas devolvem o status,
  mas o snapshot não muda.
- Levar `ResolveOptions*` para `packages/contracts` (hoje vive em `apps/api/src/agent/types.ts`).
