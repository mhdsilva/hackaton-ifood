# Marcos do projeto — SideQuest Party

> Atualizado em 17 de outubro de 2026. Escopo vigente: o do [README](../README.md) (tema comum +
> opções locais por participante). O [Sprint 0](tarefas-iniciais.md), com missões, papéis e jogo,
> está **superado**.

## Como ler este documento

- Os **marcos** cobrem o projeto inteiro e foram desenhados para **não conflitar**: cada um tem um
  dono, uma área de arquivos própria e uma interface de entrada e de saída.
- As **tasks pequenas** existem apenas para o **Maeda** (agente e iFood MCP). Os marcos dos outros
  ficam em alto nível; cada pessoa quebra os seus.

## Regras para não haver conflito

1. **Um arquivo, um dono.** Ninguém edita arquivo de outra área. A tabela abaixo é a fonte da verdade.
2. **Contrato primeiro.** Tipos compartilhados são fechados no marco C antes de qualquer código que
   os use. Depois disso só mudam por pedido ao Matheus.
3. **Costura, não mistura.** O Maeda entrega módulos com interface estável; quem liga ao servidor é
   o Matheus (tasks de integração, marcadas `→ Matheus`).
4. **Cada marco roda sozinho.** Entradas vêm de fixtures ou de um tema fixo, então ninguém espera
   outro para demonstrar o seu.

### Áreas de propriedade

| Área | Dono |
| --- | --- |
| `apps/web/**` | Otávio |
| `apps/api/src/party/**`, `apps/api/src/server.ts`, `apps/api/openapi.yaml`, `packages/contracts/**`, `compose.yaml`, `Dockerfile`, `Caddyfile` | Matheus |
| `apps/api/src/mcp/**` (OAuth e registro de sessões já existentes) | Matheus |
| `apps/api/src/ifood/**`, `apps/api/src/agent/**`, `fixtures/ifood-*.json`, `fixtures/options-*.json`, `docs/ifood-mcp.md`, `docs/ifood-user-mcp-tools.md` | **Maeda** |
| Questionário, textos, fluxo, roteiro (Figma e docs de produto) | Júlio |
| `docs/marcos.md`, `README.md` | quem pedir a mudança avisa o grupo |

## Visão geral dos marcos

```text
C Contratos ──► A Conexão iFood ──► B Opções locais ──► D Pedido ──► E Demo
(Matheus+Maeda)  (Maeda)            (Maeda)            (Maeda)      (todos)
      │
      ├──► T Tema e questionário (Júlio, Matheus) ── alimenta B com dados reais
      └──► W Frontend multiusuário (Otávio) ── usa fixtures até A e B existirem
```

| Marco | Resultado demonstrável | Dono | Depende de |
| --- | --- | --- | --- |
| F | Três dispositivos chegam a `READY_FOR_THEME` | Matheus, Otávio | feito |
| C | Tipos do agente fechados e versionados | Matheus (aprova), Maeda (propõe) | F |
| A | Cada participante conecta a própria conta iFood por OAuth real | Maeda | C |
| B | Cada participante recebe opções reais do tema, perto do endereço | Maeda | C (A só para rodar em rede) |
| T | O grupo recebe e confirma um tema; respostas viram `tema + orçamento + restrições` | Júlio, Matheus | F |
| W | A tela mostra conexão, opções e andamento por participante | Otávio | C (usa fixtures) |
| D | Cada participante confirma e o carrinho/pedido individual é criado | Maeda, Matheus | A, B, T |
| E | Demo de ponta a ponta ensaiada, com plano B por etapa | todos | tudo |

**Por que não conflitam:** A e B são paralelos (B roda com um token manual ou fixture), T e W
dependem só de C e F, e D é o único ponto onde as áreas se encontram, por isso vem depois.

---

## Marco F — Fundação (feito)

Party, código de entrada, anfitrião fecha o grupo, questionário genérico, registro privado de
tokens e fluxo OAuth com PKCE no modo `demo`.

## Marco C — Contratos do agente (Matheus aprova, Maeda propõe)

Fechar **antes** de A e B para eliminar disputa de tipos.

```ts
// proposta; entra em packages/contracts por aprovação do Matheus
type ResolveOptionsInput = {
  partyId: string
  participantId: string
  theme: string
  budget: number
  restrictions: string[]
  addressId: string
  maxOptions: number
}

type ResolveOptionsOutput = {
  source: "live" | "simulated"
  options: Array<{
    merchant: { id: string; name: string; distanceKm: number; rating?: number }
    items: Array<{ itemId: string; name: string; price: number }>
    total: number
    deliveryFee: number
    estimatedDeliveryMinutes: { min: number; max: number }
  }>
}
```

Pronto quando: o Matheus publica os tipos em `packages/contracts`, e Otávio, Júlio e Maeda
confirmam que conseguem codar contra eles.

## Marco T — Tema e questionário (Júlio, Matheus)

Perguntas, regra de sugestão de tema, votação (se houver) e estados depois de `READY_FOR_THEME`.
Saída fixa para os outros marcos: `{ theme, budget, restrictions }` por participante.

◐ **Forma pronta, conteúdo pendente (17/10/2026):** o questionário `v2` — as 7 etapas do Figma — já
está em `apps/api/src/party/questionnaire.ts`; a `v1` segue registrada para compatibilidade. A
derivação do tema (`party/theme.ts`) já funciona em três níveis: **tema explícito → sinais das
Etapas 4–7** (tabela **provisória**) **→ vibe do dia** (`sabadou`/`sextou à distância`), que o agente
busca em qualquer endereço (`agent/themes.ts`, `VIBE_QUERIES`). Falta o Júlio fixar a regra
sinais → tema; trocá-la não mexe em nenhuma interface.

## Marco W — Frontend (Otávio)

Tela de conexão iFood, escolha de endereço, lista de opções e andamento, usando
`fixtures/options-*.json` do Maeda até a API real existir. Inclui o bug de `fetch` em
[`pendencias-frontend.md`](pendencias-frontend.md).

**Regra do produto (17/10/2026):** abrir a rota base **sem** `?code` **cria** a Party
(`POST /parties`, sem autenticação) e mostra o link de convite; abrir com `?code` **entra**
(`POST /parties/:code/join`). Cuidar da idempotência (não criar duas Parties em reload/StrictMode).
Detalhes e o mapa das telas → chamadas em [`handoff-colucci.md`](handoff-colucci.md) §1 e §6.

## Marco E — Demonstração (todos)

Três dispositivos, roteiro de 90 segundos, backend com HTTPS, contingência por etapa e checklist
de segurança. Detalhado ao final deste documento.

---

# Marcos do Maeda, em tasks pequenas

Cada task tem: **ID**, **arquivos que toca** (sempre dentro da minha área), **depende de**,
**tamanho** (P ≤ 1 h, M ≤ 3 h) e **pronto quando**. Nenhuma task edita arquivo de outro dono; onde
é preciso ligar ao servidor, a task termina com `→ Matheus`.

## Marco A — Conexão real com o iFood MCP

### Fatos verificados em 17/10/2026

| Item | Valor observado |
| --- | --- |
| Endpoint MCP | `https://consumer-mcp.ifood.com.br/marketplace` (único, 23 tools) |
| Autorização | `https://id.ifood.com.br` (`/authorize`, `/token`, `/revoke`) |
| Fluxo | authorization code + PKCE `S256` + parâmetro `resource` |
| Cliente | `client_secret_basic` ou `client_secret_post` |
| Grants | `authorization_code` e `refresh_token` |
| Redirect | qualquer porta em `localhost` aceita; URL pública precisa estar cadastrada |
| Escopos | `mcp.user.*`, `mcp.discovery.*`, `mcp.cart.*`, `mcp.orders.read` |
| Problema | `issuer` do metadata é `…/3p`; o MCP anuncia `…br`. Clientes estritos abortam. Nosso backend não compara |

### Acordos com o Matheus (alinhados em 17/10/2026)

Mudam código dele, então ficam fora das minhas tasks. Eu só dependo deles em A9.

| # | Acordo | Quem faz |
| --- | --- | --- |
| 1 | **Callback único**: `GET /mcp-connection/callback`, sem `:id` no caminho. A Party é descoberta pelo `state`, que já guarda `partyId + participantId`. O iFood compara a `redirect_uri` inteira, então ela não pode variar por Party | Matheus (`server.ts`, `oauth-flow.ts`, `openapi.yaml`, testes) |
| 2 | A `redirect_uri` usada no authorize **e** no exchange é sempre `PUBLIC_API_URL + /mcp-connection/callback` | provider (eu) lê de config |
| 3 | O provider é construído por `createIfoodProvider(env)`, exportado de `ifood/index.ts`; o Matheus liga com uma linha em `server.ts` | eu exporto, Matheus liga |
| 4 | `IFOOD_AUTH_BASE_URL` tem padrão `https://id.ifood.com.br`; `IFOOD_REDIRECT_URI` é opcional e sobrescreve o derivado de `PUBLIC_API_URL` | eu |

A interface `McpOAuthProvider` **não muda**: a `redirect_uri` fica na configuração do provider
(como o provider `demo` já faz), então não há dependência entre as nossas tasks.

| ID | Task | Arquivos | Depende | Tam. | Pronto quando |
| --- | --- | --- | --- | --- | --- |
| A1 ✅ | Ler config do ambiente: `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_AUTH_BASE_URL` (padrão `id.ifood.com.br`), `IFOOD_REDIRECT_URI` ou `PUBLIC_API_URL`; falhar com mensagem clara se faltar | `ifood/config.ts` | — | P | teste cobre variável ausente, presente e redirect derivado |
| A2 ✅ | Montar a URL de autorização (PKCE, `state`, `resource`, escopos MCP) | `ifood/oauth-provider.ts` | A1 | P | teste confere cada parâmetro da URL |
| A3 ✅ | Trocar `code` por tokens com `client_secret_basic` | `ifood/oauth-provider.ts` | A2 | M | teste com servidor falso devolve `OAuthTokenResponse` |
| A4 ✅ | Renovar token com `refresh_token` | `ifood/token-refresh.ts` | A3 | P | teste: token a menos de 5 min do fim é renovado |
| A5 ✅ | Classificar erros do `/token` (`invalid_client`, `invalid_grant`) sem vazar secret | `ifood/oauth-errors.ts` | A3 | P | teste: nenhuma mensagem contém o secret |
| A6 ✅ | Cliente MCP por participante com `Authorization: Bearer` por instância | `ifood/client.ts` | A4 | M | `getUser` real devolve o dono do token |
| A7 ✅ | Validar conexão com `getUser` antes de marcar `connected` | `ifood/validate-connection.ts` | A6 | P | token inválido resulta em `error`, válido em `connected` |
| A8 ◐ | Spike de múltiplas sessões: 2 a 3 clientes, chamadas intercaladas, sem vazamento | `ifood/spike-sessions.ts` (script) | A6 + 2ª conta | M | feito em 17/10/2026 com 2 contas: 2 `sub` distintos, 0 vazamentos. Falta só tentar com 3 |
| A9 ✅ | Exportar `createIfoodProvider(env)`; `→ Matheus` liga `MCP_OAUTH_MODE=ifood` em `server.ts` (após o callback único) | `ifood/index.ts` | A3, A7 | P | modo `ifood` sobe e `demo` continua funcionando |
| A10 ✅ | Corrigir `docs/ifood-mcp.md` com os fatos acima | `docs/ifood-mcp.md` | — | P | tabela do documento bate com a observada |

Legenda: ✅ feito, ◐ parcial (falta o item descrito em "pronto quando"), sem marca = aberto.

Pronto quando o marco fecha: dois dispositivos conectam contas diferentes e `getUser` devolve o
dono certo em chamadas alternadas (A6 + A8).

**Riscos:** só há uma conta autenticada hoje; o secret circulou em texto puro e deve ser
regenerado; a redirect pública exige HTTPS.

## Marco B — Opções locais por participante

Roda com **token manual** da minha conta até A9 existir, então não espera o marco A.

| ID | Task | Arquivos | Depende | Tam. | Pronto quando |
| --- | --- | --- | --- | --- | --- |
| B1 ◐ | Capturar e **sanitizar** respostas reais (endereços só com cidade e bairro; sem rua, CEP, `addressId`, e-mail, telefone) | `fixtures/ifood-addresses.json`, `fixtures/ifood-discovery-results.json` | A6 ou token manual | P | já existem `fixtures/ifood-discovery-italiano.json` e `ifood-cart-italiano.json`, sanitizados; faltam os dois arquivos nomeados (endereços e discovery genérico) |
| B2 ✅ | Escolher endereço: um salvo, usar; vários, exigir `addressId` vindo da Party (não inferir em silêncio) | `agent/pick-address.ts` | C | P | testes para 0, 1 e N endereços |
| B3 ✅ | Buscar itens do tema: `searchOffers` com `onlyOpen`, `itemRestrictions` (orçamento é referência, não filtro) | `agent/resolve-options.ts` (não há `search-theme.ts` separado) | B1, C | M | devolve itens abertos para `italiano` |
| B4 ✅ | Mapear restrições da Party (`vegetarian`, etc.) para `itemRestrictions` do iFood | `agent/restrictions.ts` | C | P | tabela de mapeamento testada |
| B5 ✅ | Agrupar por estabelecimento e detalhar com `getMerchant` e `getItem` | `agent/resolve-options.ts` (consolidado, sem `merchant-detail.ts`) | B3 | M | cada opção traz `optionGroups` e prazo |
| B6 ✅ | Montar combinação com frete e pedido mínimo; orçamento como referência de ordenação | `agent/build-option.ts` | B5 | M | testes: orçamento justo, estourado (opção mantida e rebaixada), abaixo do mínimo |
| B7 ✅ | `resolveOptions(input)` compondo B2 a B6, com paralelismo e limite de tempo | `agent/resolve-options.ts` | B2, B4, B6 | M | retorna `ResolveOptionsOutput` com `source: "live"` |
| B8 ✅ | Falha isolada: erro de um participante não derruba os outros; nova tentativa individual | `agent/resolve-options.ts` | B7 | P | `resolveOptionsForParty` isola a falha de cada participante |
| B9 ✅ | Contingência: usar fixture quando o MCP falhar, com `source: "simulated"` | `agent/fallback.ts`, `fixtures/options-italiano.json` | B7 | P | desligar a rede devolve opções simuladas |
| B10 ✅ | Entregar `resolveOptions` ao servidor: `→ Matheus` expõe a rota | `apps/api/src/server.ts` (`POST /parties/:id/options`) | B7 | P | rota responde para dois participantes |
| B11 ✅ | (opcional) LLM só para ranquear ou descrever opções, nunca para escolher IDs | absorvido pelo planner (`agent/planner*.ts`, [ADR 0003](adr/0003-planner-llm-sobre-ifood-mcp.md)); não há `rank.ts` | B7 | M | com e sem `OPENCODE_API_KEY` o resultado é válido |

Pronto quando o marco fecha: para dois participantes com endereços diferentes e o mesmo tema, a
API devolve opções reais e distintas, priorizando o orçamento de cada um, em poucos segundos.

**Riscos:** catálogo vazio fora de horário ou cidade; itens com opções obrigatórias; latência de
várias chamadas por participante.

## Marco D — Confirmação e pedido

Só começa com A, B e T prontos. Cada task usa o token do **próprio** participante.

| ID | Task | Arquivos | Depende | Tam. | Pronto quando |
| --- | --- | --- | --- | --- | --- |
| D1 ✅ | `createCart` e `addItemToCart` a partir de uma opção escolhida | `ifood/checkout.ts` | B7 | M | carrinho criado na conta de teste |
| D2 ✅ | Entrega e pagamento: `getCartDeliveryMethods`, `setCartDelivery`, `listPaymentMethods`, `setCartPayment` | `ifood/checkout.ts` | D1 | M | carrinho com entrega e pagamento definidos |
| D3 | Vouchers opcionais: `listVouchers`, `setVoucher` | `ifood/checkout.ts` | D2 | P | cupom aplicado quando existir |
| D4 ✅ | `submitOrder` **só** com `userConsent: true` do próprio participante | `ifood/checkout.ts` | D2 | M | teste recusa sem consentimento |
| D5 ✅ | `trackOrder` com a cadência de `agentHints.retryMessage` e parada em `pollingStop` | `ifood/checkout.ts` | D4 | M | estado resumido sem dados pessoais |
| D6 ✅ | Expor retrospectiva factual agregada, sem feedback | `GET /parties/:id/retrospective` | D5, T | feito — libera tema, participantes, unidades, estabelecimentos e maior distância aproximada entre endereços depois de todos os pedidos `CONCLUDED` |
| D7 | Decidir o modo da demo: pedido real com Pix não pago, só carrinho ou simulado | `docs/marcos.md` | grupo | P | decisão registrada |

> D1, D2, D4 e D5 foram consolidados em **`ifood/checkout.ts`** (não há `cart.ts`, `cart-checkout.ts`,
> `submit-order.ts` nem `track-order.ts` separados). D3 só lê `voucherTotalAmount` do breakdown; não
> aplica cupom. D6 usa uma rota autenticada própria e não acrescenta endereços ou coordenadas ao `PartySnapshot`.

**Risco:** pedido real em conta pessoal pode gerar cobrança; preferir a test account.

## Marco E — Parte do Maeda na demonstração

| ID | Task | Arquivos | Depende | Tam. | Pronto quando |
| --- | --- | --- | --- | --- | --- |
| E1 ✅ | Cadastrar a redirect URL pública da Oracle no agente | portal iFood | domínio HTTPS | P | feito (18/10) — `https://api-ifood.kairootech.com.br/mcp-connection/callback` cadastrada e logando de verdade em produção |
| E2 ✅ | Regenerar o Client Secret e atualizar os ambientes | portal, `.env` | E1 | P | feito (18/10) — secret novo gerado e confirmado funcionando na Coolify (`OAUTH_EXCHANGE_FAILED` resolvido) |
| E3 | Ensaio com três contas ou duas reais e uma simulada | — | A, B, D | M | fluxo roda duas vezes seguidas |
| E4 | Checklist: sem tokens em logs, fixtures ou erros; `.env`, `docs/SECRET` e `opencode.json` fora do git | — | E3 | P | `git grep` não acha segredo |

---

## Plano de execução do Maeda

O checkpoint atual do Matheus termina em `READY_FOR_THEME`. Dele, só o **Marco A** me é exigido.
Os marcos **B e D vêm depois** desse checkpoint e não bloqueiam ninguém.

### Etapa 1 — Provider real do iFood (checkpoint atual)

Tudo dentro de `apps/api/src/ifood/`, testável sem servidor e sem a rede do iFood.

1. **A1** config do ambiente.
2. **A2** URL de autorização (PKCE, `state`, `resource`, escopos MCP).
3. **A3** troca do `code` por tokens, com `client_secret_basic`.
4. **A4** refresh do token.
5. **A5** erros do `/token` sem vazar o secret.
6. **A9** `createIfoodProvider(env)` — termina com a nota ao Matheus.

Saída: `npm test` cobre o provider com um servidor de token falso; `MCP_OAUTH_MODE=ifood` pronto
para ser ligado.

### Etapa 2 — Prova com o iFood de verdade

7. **A6** cliente MCP com Bearer por instância.
8. **A7** validação com `getUser` antes de `connected`.
9. **A8** spike de sessões — só quando houver uma segunda conta.
10. **A10** corrigir `docs/ifood-mcp.md` com os fatos verificados.

Saída: dois dispositivos conectam contas diferentes e `getUser` devolve o dono certo.

### Etapa 3 — Rede e segurança (antes de qualquer ensaio em rede)

11. **E1** cadastrar `PUBLIC_API_URL/mcp-connection/callback` no agente (depende do acordo 1 e do domínio).
12. **E2** regenerar o Client Secret.

### Etapa 4 — Agente (depois do checkpoint)

13. **B1** fixtures sanitizadas, **B2** e **B4** endereço e restrições.
14. **B3 → B7** busca, detalhe, orçamento e `resolveOptions`.
15. **B8 → B10** falha isolada, contingência e entrega ao Matheus.

### Etapa 5 — Pedido e demo (depois do tema)

16. **D1 → D7** carrinho, consentimento e rastreio.
17. **E3, E4** ensaio e checklist.

### Dependências externas, em ordem de urgência

| Para destravar | Preciso de | De quem |
| --- | --- | --- |
| A9 e E1 | callback único (acordo 1) | Matheus |
| E1 | domínio HTTPS da Oracle | Matheus |
| A8 | segunda conta autenticada | Maeda |
| Etapa 4 com dados reais | tema, orçamento e restrições por participante | Júlio |

## Fora do radar anterior (chegou depois de 17/10)

Não estava neste documento; registrando pra não sumir:

- **Endereço real do participante**: `GET/POST /parties/:id/addresses` e
  `POST /parties/:id/addresses/resolve` já existem no backend (commit "add participant address
  flow"). O front (`/party/address`) ainda usa a lista mock — é a próxima integração óbvia.
- **Planner LLM**: absorveu o B11 por inteiro (`agent/planner.ts`, `negotiate.ts`, `sanitize.ts`,
  `llm/client.ts`). Com `OPENCODE_API_KEY` configurado usa o modelo para montar/negociar as
  opções; sem a chave, cai no determinístico. `OPENCODE_BASE_URL` aponta pro endpoint
  `/inference/go` da própria opencode (Zen/Go), não um servidor nosso.

## Decisões pendentes

| Decisão | Quem decide | Bloqueia |
| --- | --- | --- |
| Quantas contas de teste o portal permite | Maeda | A8 (3ª conta) |
| Perguntas, tema e votação | Júlio | T, B com dados reais |
| Demo com pedido real, carrinho ou simulado | grupo | D7, E3 |
| ~~Aprovar `ResolveOptions*` em `contracts`~~ ✅ feito (tipos já em `packages/contracts`) | Matheus | — |
| ~~Domínio HTTPS e redirect URL pública~~ ✅ feito (E1) | Matheus, Maeda | — |
