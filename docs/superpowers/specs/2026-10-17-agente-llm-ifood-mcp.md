# Agente de tema e negociação sobre o iFood MCP

## Intenção

O iFood expõe uma única superfície: um servidor MCP com 23 tools, sob OAuth 2.1
([`docs/ifood-mcp.md`](../../ifood-mcp.md)). O propósito de um MCP é ser consumido por um agente
que **descobre e escolhe tools em tempo de execução**. O recorte atual
(`apps/api/src/agent/resolve-options.ts`) chama as tools em ordem fixa e traduz um tema já
conhecido em termos por tabela (`themes.ts`), deixando ocioso exatamente o que o MCP oferece.

Esta camada adiciona um **agente LLM** que planeja e negocia sobre as tools do MCP. Com ele, o
produto deixa o tema engessado e passa a admitir: temas livres em texto, surpresa, substituição
quando o tema não existe no endereço, e itens equivalentes entre endereços diferentes. O pipeline
determinístico deixa de ser o único caminho e passa a ser o **fallback**.

Referências: [`docs/marcos.md`](../../marcos.md) (B11), [`ADR 0001`](../../adr/0001-uma-sessao-mcp-por-participante.md),
[`docs/ifood-mcp.md`](../../ifood-mcp.md), [`docs/como-funciona.md`](../../como-funciona.md).

## Princípio central (invariante)

> O agente decide **intenção**; o executor resolve **fato**.

- O LLM escolhe **quais** tools chamar, em **que ordem**, com **quais argumentos**, e pode ranquear,
  descrever e sugerir substitutos.
- IDs, preços, disponibilidade, frete, pedido mínimo, endereços e consentimento **só** saem do MCP.
  **Nenhuma saída do modelo é usada como ID.**
- Toda proposta do modelo é revalidada: a intenção vira chamada MCP (`searchOffers`/`getItem`), e
  `buildOption` refaz as contas de preço, quantidade, mínimo e orçamento.

Esse invariante é o que permite flexibilidade semântica sem arriscar alucinação de item — a regra
que [`docs/marcos.md`](../../marcos.md) já fixou no B11 ("nunca para escolher IDs") e que aqui
passa de opcional a estruturante.

## Fluxo

```text
Respostas do grupo
→ Agente propõe tema + consultas  (intenção, pode ser tema livre)
→ Por participante, loop de tools MCP:
     achou  → ranqueia e descreve
     não achou → propõe substituto e re-consulta
→ Negociação de grupo: alinhar o tema ao que existe em todos os endereços
→ Opções resolvidas (IDs reais, orçamento conferido)
→ Carrinho e pedido (determinístico, inalterado — marco D)
```

## Papéis

| Papel | Faz |
| --- | --- |
| Planner (LLM) | tema, consultas, substitutos, surpresa, ranking, descrição, decidir re-tentar |
| Executor (código + MCP) | chama a tool com o token daquele participante; valida nome de tool e args; aplica filtros e aritmética (`buildOption`); confere IDs contra o catálogo |
| Orquestrador de grupo | agrega `PartyOptionsResult[]`; decide quando negociar e quando desistir |

## Tools

- **iFood MCP (23):** `getUser`, `listAddresses`, `searchOffers`, `getRecommendations`,
  `getMerchant`, `getItem`, `createCart`, `addItemToCart`, `submitOrder`, `getOrder` e demais — ver
  [`docs/ifood-mcp.md`](../../ifood-mcp.md).
- **Próprias do sistema (novas):** `themeFromAnswers`, `proposeSubstitutes`, `describeOption`,
  `rankOptions` (hoje a heurística de `build-option.ts`).

O modelo recebe os schemas das tools. O executor impõe **allowlist**: só as tools permitidas são
executáveis, e nenhuma tool de escrita roda sem consentimento. As tools de leitura que devolvem
perfil ou endereço passam por sanitização antes de virar mensagem (ver *Privacidade e segurança*).

## Casamento (perfil × escolhas × tema × endereço)

O núcleo do agente é o **casamento** entre quatro fontes, por participante:

| Fonte | De onde vem | Como entra |
| --- | --- | --- |
| Perfil e comportamento | MCP `getUser` / `getRecommendations` | sinais de preferência, sem dados pessoais |
| Escolhas | questionário da Party | orçamento, restrições, preferências declaradas |
| Tema | grupo (livre, negociado) | consultas e filtros |
| Endereço | MCP `listAddresses` | coordenada, resolvida **pelo executor** |

O agente casa esses sinais para propor **intenções** (consultas, filtros, substitutos, ranking) que
o executor resolve no catálogo. O casamento decide *o que procurar e em que ordem*; nunca escolhe
IDs, preços ou lojas — isso continua vindo do MCP. O perfil entra como **entrada do raciocínio**, e
a saída do modelo é revalidada contra o catálogo antes de virar opção.

## Loop

- **Limite de passos** (proposto: 6) e **timeout total** por participante.
- A cada passo: o executor valida o nome da tool e os argumentos, executa no MCP com o token do
  participante e devolve o resultado **truncado e sanitizado** ao modelo.
- Sem progresso após o limite → degrada para o determinístico (ver *Configuração*).
- A falha de um participante não cancela os outros (mesma regra de `resolveOptionsForParty`).

## Temas livres, surpresa, substituição e similaridade

- **Temas livres:** o planner lê as respostas + o tema do grupo e devolve *N* consultas e filtros,
  no lugar da tabela fixa. "conforto de infância" → consultas como `feijoada`, `macarrão com
  queijo`, `bolo de vó`. Continua sendo busca real no catálogo.
- **Surpresa:** o planner entrelaça um curinga entre os candidatos **válidos** que o MCP devolveu
  (variação/novidade em vez de só preço), ou injeta uma consulta inesperada. A surpresa ocorre
  dentro do que existe e cabe no orçamento — nunca inventando item.
- **Substituição:** quando o tema não retorna nada (ou nada cabe no orçamento), o planner propõe um
  equivalente ("esfiha → kibe, pão árabe") como **nova consulta** ao MCP, e o executor refaz
  `searchOffers` + `buildOption`.
- **Similaridade:** o planner gera sinônimos/substitutos e descreve o porquê; a semelhança é do
  modelo, a existência é do catálogo.

## Negociação de grupo

O passo por-participante já devolve `PartyOptionsResult[]`
(`apps/api/src/agent/resolve-options.ts`). Quando um endereço não encontra o tema, o orquestrador
pede ao planner um plano alternativo sobre esse agregado ("neste bairro só há brasileiro; migrar
para *comida afetiva*, que casa com as respostas de todos"). A negociação acontece **dentro do
coordenador**; não há processo de agente por dispositivo.

## Configuração

- `OPENCODE_API_KEY` — chave do sistema, **uma só**, no ambiente da API; distinta dos tokens
  por-participante.
- `OPENCODE_MODEL` (padrão sugerido: `deepseek-v4.1-flash`).
- `OPENCODE_BASE_URL` (padrão `https://opencode.ai/inference`), endpoint OpenAI-compatible
  (`/openai/v1/chat/completions`).
- Leitura no padrão de `apps/api/src/ifood/config.ts` (`loadOpenCodeConfig(env = process.env)`).
- **Ausente a chave → determinístico de hoje, sem quebrar nenhum teste.** É o princípio do B11
  ("com e sem LLM o resultado é válido") levado ao fluxo inteiro.

## Privacidade e segurança

- Estende o [`ADR 0001`](../../adr/0001-uma-sessao-mcp-por-participante.md): nunca colocar
  `client_secret`, `access_token`, `refresh_token`, códigos ou a chave do modelo em prompt, log,
  `PartySnapshot`, fixture ou erro.
- Prompts usam apenas dados públicos ou sanitizados (bairro e cidade; **nunca** rua, número, CEP,
  e-mail ou telefone). `getUser` e `listAddresses` passam por `stripPersonalData` / `sanitizeAddress`
  antes de virar mensagem; o casamento usa o perfil, mas nunca os campos pessoais.
- Saída do modelo é **não confiável**: validar contra schema e contra o catálogo antes de usar.
- Allowlist de tools; escrita (carrinho/pedido) exige `userConsent: true`.

## Riscos

| Risco | Mitigação |
| --- | --- |
| Latência (MCP já é lento + round-trips do modelo) | timeout total, limite de passos, paralelismo por participante |
| Não-determinismo (mesmas respostas → tema diferente) | cache/pin do plano no ensaio e no pitch |
| Custo e disponibilidade do provedor | chave opcional; degradação automática |
| Alucinação de item/preço | invariante "nunca ID"; só o MCP fornece IDs e valores |
| MCP indisponível | `agent/fallback.ts` (fixture) permanece |

## Fora do escopo

- agente autônomo por dispositivo (segue rejeitado pela [`ADR 0001`](../../adr/0001-uma-sessao-mcp-por-participante.md));
- negociação entre processos de agente (só dentro do coordenador);
- memória ou estado persistente do agente;
- o agente executar escrita sem consentimento.

## Dependências e revisões

- Revisa o limite do `README.md` ("agentes autônomos negociando entre si").
- Amplia o B11: antes, LLM opcional só para ranquear/descrever; agora também planeja consultas e
  negocia.
- Depende da regra de tema do Júlio: esta spec entrega o **mecanismo**, o produto define o
  **conteúdo**.

## Critério de pronto

Dois participantes em endereços diferentes, com um tema em texto livre: o agente resolve opções
reais; quando um endereço não tem o tema, ele negocia um tema comum alternativo; carrinho e pedido
seguem com IDs reais. **Sem** `OPENCODE_API_KEY`, o fluxo determinístico continua verde.

## Responsabilidades

| Pessoa | Responsabilidade |
| --- | --- |
| Júlio | definir o mecanismo de tema em produto e os textos do agente |
| Otávio | exibir o andamento do agente e a troca de tema na interface |
| Maeda | expor as tools MCP ao executor e validar substituição contra o catálogo |
| Matheus | orquestrar o loop, a negociação de grupo e o invariante "nunca ID" |
