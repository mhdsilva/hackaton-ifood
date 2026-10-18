# Plano — tema é consenso do grupo; regra individual vai só no pedido da pessoa

## Contexto

O tema da Party hoje pode ser contaminado por uma pessoa só. Se um participante é vegano e os outros não, o agente pode batizar o tema "refeição vegana da tarde", e as `queries` do tema (que valem para **todos**) já nascem filtradas. Causas no código:

- `apps/api/src/agent/theme-planner.ts:123-126`: o prompt diz "Restrições valem como veto". Além disso entrega ao modelo as respostas **de cada pessoa** (`themePlannerMessages` → `themeAnswers`), incluindo restrições, exclusões, texto livre e orçamento.
- `apps/api/src/party/service.ts:70` `mergedAnswers` (fallback sem LLM): `Object.assign` por chave, "a última vence". A energia/formato/desejo de **uma** pessoa decide o tema de todos.
- Do outro lado, o que é pessoal quase não chega ao pedido da pessoa: `POST /parties/:id/options` (`server.ts:174-205`) só repassa `restrictions` (enviadas pelo front). Desejos (`cravings`), exclusões (`exclusions`) e os textos "outro" **não entram** no pedido de ninguém.

Decisões confirmadas com o Maeda: consenso = **todos** os participantes com respostas; desejos/exclusões individuais passam a entrar no pedido da própria pessoa; o fallback sem LLM segue a mesma regra.

## Mudanças

### 1. Helper de consenso (novo) — `apps/api/src/party/consensus.ts`
`groupConsensus(answersByParticipant: Answers[]): Answers`, só para as chaves que podem virar tema:
- chaves escalares (`energy`, `order-style`): entram só se **todos** responderam e o valor é idêntico;
- chaves de lista (`cravings`): entram os itens que **todos** marcaram (interseção); sem itens em comum, a chave some;
- ficam de fora, sempre: `restrictions`, `exclusions`, `restrictions__other`, `exclusions__other`, `budget`, `address`, `*__value` (são individuais). `surpreenda` continua sem decidir nada.
- sem respostas, devolve `{}`. Reusa o tipo `Answers` de `party/theme-plan.ts`.

### 2. Planner de tema com LLM — `apps/api/src/agent/theme-planner.ts`
- `createLlmThemePlanner` calcula `groupConsensus(answersByParticipant)` e só isso vai ao modelo; `hasSignal` passa a olhar o consenso (sem consenso → lança, e o `PartyService` cai no `deriveTheme`/vibe do dia, como já funciona).
- `themePlannerMessages` envia o objeto de consenso + número de participantes, não mais "uma entrada por participante".
- `systemPrompt`: remover "Restrições valem como veto"; incluir a regra explícita: *o tema é o consenso do grupo; restrição ou preferência de uma pessoa só (ou de parte do grupo) nunca aparece no título, no `reason` nem nas `queries` — vale apenas para o pedido dessa pessoa.*
- `THEME_ANSWER_KEYS` encolhe para as chaves do consenso (tirar `restrictions*`, `exclusions*`, `budget`).

### 3. Fallback sem LLM — `apps/api/src/party/service.ts`
Linha 263: `deriveTheme(mergedAnswers(snapshot), …)` → `deriveTheme(groupConsensus(answersByParticipant(snapshot)), …)`. Remover `mergedAnswers` (fica sem uso). `party/theme.ts` não muda: com consenso, as regras só disparam quando o grupo concorda; senão cai em `vibeTheme`.

### 4. Preferências individuais no pedido da própria pessoa
- Contrato (aditivo/opcional) em `packages/contracts/src/index.ts`: `ResolveOptionsInput.preferences?: { cravings?: string[]; avoid?: string[]; notes?: string[] }`. Área do Matheus — mudança pequena e opcional, avisar no commit.
- `server.ts` (rota `/options`): preencher `preferences` a partir das **respostas salvas do próprio participante** (`service.get(partyId)` → `questionnaireResponse.answers` do `actor`), nunca do corpo da requisição. Traduzir ids para rótulos com `getQuestionnaire` (ex.: `picante` → "Picante", `fritura` → "Fritura") e anexar os textos livres `restrictions__other`/`exclusions__other`. Ignorar `surpreenda`/`outro`.
- `planner-context.ts` (`userPrompt`): novas linhas *"Preferências só deste participante (não são tema; aplique só no pedido dele): desejos …; evitar …; observações …"* e reforço no `systemPrompt` de que isso nunca muda o tema/buscas obrigatórias. O caminho determinístico (`resolve-options.ts`, sem LLM) continua só com `restrictions` do iFood — fica registrado como limite.
- O fluxo `planner-options.ts` repassa `input.preferences` para o contexto (já repassa `restrictions` nas linhas ~104/135).

### 5. Frontend
Nenhuma mudança (regra do `AGENTS.md`: não mexer em textos sem autorização). O front continua enviando `restrictions`; o servidor completa o resto.

## Testes (node:test, já listados em `apps/api/package.json`)
- novo `party/consensus.test.ts` (adicionar ao script `test`): interseção de listas; escalar divergente some; um único vegano não vira consenso; `surpreenda`/`budget`/`exclusions` nunca aparecem.
- `agent/theme-planner.test.ts`: o prompt não contém restrição/exclusão/orçamento individuais; sem consenso o modelo não é chamado; prompt traz a regra de consenso. Ajustar os testes existentes que esperavam "uma entrada por participante" (linhas 52, 75, 85, 124, 134).
- `party/service.test.ts`: fallback com respostas divergentes cai na vibe do dia (e com todos iguais em `energy` usa a regra); o planner recebe as respostas por participante (teste da linha ~409 continua válido porque o consenso é calculado dentro do planner, não no service).
- `agent/planner-context.test.ts`: preferências individuais aparecem no prompt do pedido e não no tema.
- `http/server.test.ts`: `/options` preenche `preferences` com as respostas do ator, ignora qualquer `preferences` do corpo.

## Verificação
- `cd apps/api && npm test` (rebuild de `packages/contracts` antes: `npm run build --workspace @sidequest/contracts`).
- Manual local: Party de 3 com 1 vegano e 2 não → tema sem "vegano", e o pedido do vegano com filtro/preferência; Party onde todos escolhem "picante" → tema pode refletir picante.
- Conferir `git grep -n "mergedAnswers"` sem ocorrências e que nenhum texto de `apps/web/**` foi alterado.
