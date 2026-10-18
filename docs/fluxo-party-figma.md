# Fluxo da Party no Figma — 8 etapas

> Documentação de referência do fluxo desenhado no Figma ("Ifood Party"), extraído do PDF
> `Ifood Party.pdf`. O objetivo deste documento é fixar **o que a tela pede** para que a API
> evolua na mesma linha. Os textos e a ordem das perguntas ainda são decisão do Júlio; a
> estrutura das telas, não.

## Coordenação entre sessões (leia antes de editar)

Este documento é **insumo**, não implementação. Ele nasceu numa sessão que só documenta o fluxo.

| Sessão | Papel | Pode editar |
| --- | --- | --- |
| "Pedidos iFood sandbox: auth party e chaves" (sessão da API) | implementa o fluxo na API, passo a passo | `apps/api/**`, `packages/contracts/**`, `apps/api/openapi.yaml`, `README.md`, `docs/marcos.md` |
| Sessão do Maeda | provider/iFood e agente | `apps/api/src/ifood/**`, `apps/api/src/agent/**`, `fixtures/ifood-*.json` |
| Esta documentação | só `docs/fluxo-party-figma.md` | nada de código |

Regra: **nenhuma outra sessão edita `apps/api`, `packages/contracts` ou `openapi.yaml`.** O que
este documento aponta como lacuna é executado pela sessão da API (ou pelo Maeda, na área dele),
respeitando a fronteira de [`coordenacao-maeda.md`](coordenacao-maeda.md).

A sessão da API já tinha lido apenas *prints* do Figma (endereço e restrições); este documento
traz as **8 etapas completas com os textos e opções exatos**, que é o que faltava para seguir
etapa por etapa sem adivinhar.

> **Alinhado em 17/10/2026.** A sessão da API confirmou a fronteira e assumiu a implementação; as
> decisões de forma estão na seção 8.1. O conteúdo das perguntas (rótulos, ordem, faixas) segue
> com o Júlio.

Fontes relacionadas:

- [`superpowers/specs/2026-10-17-party-foundation-design.md`](superpowers/specs/2026-10-17-party-foundation-design.md) — recorte atual, que termina em `READY_FOR_THEME`.
- [`apps/api/src/party/questionnaire.ts`](../apps/api/src/party/questionnaire.ts) — definição provisória do questionário (`v1`, 2 perguntas).
- [`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts) — tipos compartilhados do questionário.
- [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) — contrato HTTP.
- [`como-funciona.md`](como-funciona.md) — visão ponta a ponta.

## 1. O que o fluxo desenha

```text
Party (lobby)
→ anfitrião inicia a party
→ Etapa 1 de 8: endereço
→ Etapa 2 de 8: restrições
→ Etapa 3 de 8: orçamento
→ Etapa 4 de 8: energia / clima
→ Etapa 5 de 8: formato do pedido
→ Etapa 6 de 8: desejos (até dois)
→ Etapa 7 de 8: exclusões
→ Etapa 8 de 8: tudo pronto, aguardar os outros
→ host "Revelar resultado"
```

A promessa textual do produto, repetida no lobby, é: *"Cada um no seu canto. Todo mundo na mesma
vibe. Vocês respondem juntos e descobrem uma temática. Cada pessoa recebe opções locais, adaptadas
ao próprio endereço."* Ou seja, o questionário é o **insumo da sugestão de tema**, e o endereço é
o insumo das **opções locais**.

## 2. Lobby da Party

Três telas de lobby, antes do questionário.

| Tela | Conteúdo | Significado |
| --- | --- | --- |
| Convidado | Título "Sabadou à distância", "Júlio chamou você pra uma party", lista de participantes (Júlio = Host, Lucas = você) e "Aguardando Júlio começar…" | Participante entrou (`OPEN`), aguardando o host. |
| Anfitrião | "Envie para seus amigos participarem!" + "Copiar link", lista de participantes (Júlio = você, Host) e botão **"Iniciar party"** | Host fecha o grupo. |
| Endereço novo | "Cadastrar endereço novo" | Sobe um endereço que não estava salvo no iFood. |

Observações para a API:

- "Iniciar party" é o gatilho do host que hoje chamamos `POST /parties/:id/close`
  (`OPEN → COLLECTING_ANSWERS`).
- O lobby já mostra a lista de participantes e o papel de host: o `PartySnapshot` atual cobre isso
  (`participants[].name`, `party.hostParticipantId`).
- O fluxo do Figma **não mostra a tela de conexão OAuth do iFood**, embora a Etapa 1 leia
  "Seus endereços salvos". Isso pressupõe a conta conectada. Ver decisão pendente na seção 8.

## 3. As 8 etapas, tela a tela

Cada etapa tem: título, texto de apoio, tipo de seleção e as opções exatas do Figma.

### Etapa 1 de 8 — Endereço

- **Pergunta:** "Onde você vai curtir a party hoje?"
- **Apoio:** "Usaremos a região para encontrar opções da mesma temática perto de você, mesmo longe
  dos amigos."
- **Seleção:** um endereço, entre os salvos + "Adicionar novo endereço".
- **Opções (exemplo do Figma):** `Casa — Rua das Figueiras, 120 · ap. 42 — Vila Aurora · São Paulo, SP`,
  `Trabalho — Av. Horizonte, 850 · sala 12 — Bela Vista · São Paulo, SP`.
- **Individual.** As opções **vêm do iFood**, não da definição do questionário.

### Etapa 2 de 8 — Restrições

- **Pergunta:** "Antes, você possui alguma restrição?"
- **Apoio:** "Restrições vêm antes das preferências. A restrição é individual, e não do grupo."
- **Seleção:** múltipla. `Vegetarianismo`, `Veganismo`, `Sem lactose`, `Sem glúten`,
  `Alergia a amendoim`, `Outro`.
- **Variante "Outro":** campo "Conte outras restrições ou alergias" com placeholder "Digite aqui…".
- **Individual.**

### Etapa 3 de 8 — Orçamento

- **Pergunta:** "Até quanto você pretende gastar?"
- **Apoio:** "Esse valor é individual e inclui uma estimativa das taxas. O orçamento é individual, e
  não do grupo." + "Vamos buscar opções que caibam no seu bolso. Você revisa o total antes de
  realizar o pedido."
- **Seleção:** única. `Até R$25`, `Até R$50`, `Até R$75`, `Outro valor`.
- **Variante "Outro valor":** "Selecione sua faixa de valor" com entrada "Até R$ 50,00".
- **Individual.** Precisa virar um **número** para `/options` (`budget`).

### Etapa 4 de 8 — Energia / clima

- **Pergunta:** "Qual energia combina mais com você hoje?"
- **Apoio:** "Vamos usar o clima escolhido para encontrar opções que combinem com o momento."
- **Seleção:** única. `Leve e refrescante`, `Quente e confortável`, `Crocante e descontraída`,
  `Intensa e marcante`, `Tanto faz, me surpreenda!`
- **Individual**, mas é sinal para o tema comum.

### Etapa 5 de 8 — Formato do pedido

- **Pergunta:** "Como você quer curtir seu pedido?"
- **Apoio:** "Isso ajuda a definir o tipo e a variedade de itens para o pedido." + "Vamos buscar
  opções que se encaixam com o orçamento, e podem haver variações."
- **Seleção:** única. `Uma refeição completa`, `Várias coisas para experimentar`,
  `Um lanche sem complicação`, `Uma sobremesa ou bebida especial`, `Tanto faz, me surpreenda!`
- **Individual.**

### Etapa 6 de 8 — Desejos

- **Pergunta:** "Escolha até dois desejos para hoje."
- **Apoio:** "Vamos priorizar opções que tenham os sabores e texturas escolhidos."
- **Seleção:** múltipla, **no máximo dois**. `Crocante`, `Cremoso`, `Fresco`, `Bem temperado`,
  `Picante`, `Agridoce`, `Tanto faz, me surpreenda!`
- **Individual.**

### Etapa 7 de 8 — Exclusões

- **Pergunta:** "Tem alguma coisa que você definitivamente não quer hoje?"
- **Apoio:** "Marque tudo o que devemos deixar de fora das recomendações."
- **Seleção:** múltipla. `Fritura`, `Comida crua`, `Muito picante`, `Bebida`, `Sobremesa`, `Outro`.
- **Variante "Outro":** "Conte o que você não deseja hoje" com placeholder "Digite aqui…".
- **Individual.**

### Etapa 8 de 8 — Tudo pronto

- **Título:** "Tudo pronto! Aguarde os outros participantes…"
- **Lista de participantes** com status por pessoa: `Pronto` ou `Aguardando…`.
- **Botão do host:** **"Revelar resultado"** (aparece quando todos ficam `Pronto`).
- **Compartilhado.** É o ponto onde o grupo converge — hoje `READY_FOR_THEME`.

## 4. O que já existe na API

O recorte atual cobre o lobby e a entrada, e só as duas primeiras perguntas do Figma.

| Peça | Onde | Cobre |
| --- | --- | --- |
| Criar Party | `POST /parties` | Lobby, código, `OPEN`, token do host |
| Entrar | `POST /parties/:id/join` | Convidado no lobby |
| Fechar grupo | `POST /parties/:id/close` | "Iniciar party" (`OPEN → COLLECTING_ANSWERS`) |
| Definição do questionário | `GET /questionnaire` | `v1`: `address` + `restrictions` |
| Responder | `POST /parties/:id/answers` | Submissão única com `completed: true` |
| Estado pronto | `PartyStatus` | `READY_FOR_THEME` |

A definição `v1` (`apps/api/src/party/questionnaire.ts`) já tem:

- `address` (`type: address`, obrigatória) — Etapa 1;
- `restrictions` (`multi_choice`) com `vegetariano`, `sem-lactose`, `sem-gluten`, `sem-acucar`,
  `outro` — Etapa 2, mas com **rótulos e opções diferentes** do Figma (falta `Veganismo` e
  `Alergia a amendoim`; sobra `Sem açúcar`).

O tipo `QuestionnaireQuestion` (`packages/contracts/src/index.ts`) suporta `text`, `address`,
`single_choice`, `multi_choice` e `scale`, com `options`, `min` e `max`.

## 5. Lacunas entre o Figma e a API

### 5.1 Faltam etapas 3 a 8

Nada no contrato cobre orçamento, energia, formato, desejos, exclusões nem o estado "tudo pronto".

### 5.2 Falta limite de seleção (`maxSelections`)

A Etapa 6 é "até dois". Hoje `multi_choice` valida apenas que cada item existe; não limita a
quantidade. `validateAnswers` precisa de um teto por pergunta.

### 5.3 Falta o "Outro" com texto livre

Etapas 2 e 7 têm uma opção `Outro` que abre um campo de texto. O contrato não prevê um campo
companheiro por pergunta, e `validateAnswers` só conhece o id da opção — o texto do "Outro" fica
órfão.

### 5.4 Orçamento não é opção pura

A Etapa 3 tem valores fixos **e** "Outro valor" digitado. O agente precisa de um `number`; a
definição atual não expressa "opção com valor próprio" nem entrada monetária.

### 5.5 Progresso: 8 telas, uma submissão

O Figma mostra "Etapa X de 8" com "Continuar" a cada passo, mas `POST /answers` exige
`completed: true` de uma vez. Não há como o servidor saber em que etapa cada pessoa está, nem
salvar respostas parciais — o que impede a tela de retomar e o host de ver progresso real.

### 5.6 Endereço vem do iFood, não do questionário

`address` é validada hoje como uma string. No Figma a Etapa 1 lista os endereços salvos da conta;
a definição estática do questionário não pode fornecer essas opções. Elas saem de
`listAddresses` (iFood) — que o fluxo OAuth já usa, mas nenhuma rota expõe para a tela.

### 5.7 "Revelar resultado" não existe como estado

Etapa 8 termina em `READY_FOR_THEME`, mas o Figma tem um passo explícito do host depois que todos
ficam `Pronto`. Falta um estado/ação de revelação (o tema ainda será decidido pelo Júlio).

### 5.8 Onde a conexão OAuth aparece

O Figma não tem tela de conexão. A Etapa 1 pressupõe conta conectada. É preciso decidir se a
conexão é automática no `join` ou se continua uma etapa explícita do fluxo atual.

## 6. Proposta de evolução do contrato

Sem fixar conteúdo (isso é do Júlio), o **formato** precisa acomodar o fluxo do Figma.

### 6.1 `QuestionnaireQuestion` ganha campos de configuração

```ts
export interface QuestionnaireQuestion {
  id: string;
  type: QuestionnaireQuestionType;
  label: string;
  required: boolean;
  helpText?: string;
  options?: QuestionnaireQuestionOption[];
  min?: number;
  max?: number;

  // novos, para o fluxo do Figma:
  maxSelections?: number;              // Etapa 6: até 2
  allowOther?: boolean;               // Etapas 2 e 7: opção "Outro" abre texto
  otherOptionId?: string;             // padrão "outro"
  otherInput?: {                      // rótulo e placeholder do campo de texto
    label: string;
    placeholder: string;
  };
  customInput?: {                     // Etapa 3: "Outro valor"
    label: string;
    placeholder: string;
    min: number;
    max: number;
  };
}
```

`QuestionnaireQuestionOption` ganha `value?: number` (Etapa 3: `ate-25 → 25`).

A validação (`validateAnswers`) passa a:

- recusar `multi_choice` acima de `maxSelections`;
- exigir o texto companheiro quando a opção `otherOptionId` for escolhida e `allowOther` for `true`;
- aceitar a entrada custom da Etapa 3 e normalizá-la para número.

Convenção de chaves das respostas (mantém `answers` como mapa plano):

- `answers["<questionId>__other"]` — texto livre do "Outro" (Etapas 2 e 7);
- `answers["<questionId>__value"]` — valor digitado no "Outro valor" (Etapa 3).

### 6.2 Respostas por etapa (progresso parcial)

Duas opções, ambas compatíveis com o estado atual do frontend:

1. **Submissão final única** (mínimo esforço): a tela acumula as 7 respostas e envia uma vez na
   Etapa 8 com `completed: true`. Nenhuma mudança de contrato; o servidor não conhece progresso.
2. **Submissão incremental** (fiel ao "Etapa X de 8"): `POST /answers` aceita envios parciais,
   com `completed: false` enquanto a pessoa não termina. O servidor devolve quantas etapas cada
   participante concluiu, e o host vê progresso real na Etapa 8.

Para o Figma, a opção 2 é a que corresponde à tela. **Decidido: opção 2** (ver 8.1). Sugere
`completed: boolean` (hoje é `const: true`) e um `answeredCount` derivado no `Participant`.

### 6.3 Rascunho do questionário `v2` (só a forma)

```json
{
  "version": "v2",
  "title": "Antes de montar a party",
  "questions": [
    { "id": "address", "type": "address", "required": true,
      "label": "Onde você vai curtir a party hoje?" },

    { "id": "restrictions", "type": "multi_choice", "required": false,
      "label": "Antes, você possui alguma restrição?",
      "allowOther": true, "otherOptionId": "outro",
      "otherInput": { "label": "Conte outras restrições ou alergias", "placeholder": "Digite aqui…" },
      "options": ["vegetarianismo", "veganismo", "sem-lactose", "sem-gluten", "alergia-amendoim", "outro"] },

    { "id": "budget", "type": "single_choice", "required": true,
      "label": "Até quanto você pretende gastar?",
      "customInput": { "label": "Selecione sua faixa de valor", "placeholder": "Até R$ 50,00", "min": 1, "max": 999 },
      "options": ["ate-25", "ate-50", "ate-75", "outro"] },

    { "id": "energy", "type": "single_choice", "required": true,
      "label": "Qual energia combina mais com você hoje?",
      "options": ["leve-refrescante", "quente-confortavel", "crocante-descontraida", "intensa-marcante", "surpreenda"] },

    { "id": "order-style", "type": "single_choice", "required": true,
      "label": "Como você quer curtir seu pedido?",
      "options": ["refeicao-completa", "varias-experimentar", "lanche-simples", "sobremesa-bebida", "surpreenda"] },

    { "id": "cravings", "type": "multi_choice", "required": false, "maxSelections": 2,
      "label": "Escolha até dois desejos para hoje.",
      "options": ["crocante", "cremoso", "fresco", "bem-temperado", "picante", "agridoce", "surpreenda"] },

    { "id": "exclusions", "type": "multi_choice", "required": false,
      "label": "Tem alguma coisa que você definitivamente não quer hoje?",
      "allowOther": true, "otherOptionId": "outro",
      "otherInput": { "label": "Conte o que você não deseja hoje", "placeholder": "Digite aqui…" },
      "options": ["fritura", "comida-crua", "muito-picante", "bebida", "sobremesa", "outro"] }
  ]
}
```

Os ids e rótulos acima são **proposta de forma**, não decisão de produto. O Júlio define o
conteúdo; a API define o formato.

### 6.4 Como as respostas alimentam o agente

O `/options` de hoje recebe `theme + budget + restrictions + addressId`. O Figma produz:

| Resposta | Vira | Consumidor |
| --- | --- | --- |
| `address` | `addressId` | `pick-address.ts` / `listAddresses` |
| `budget` | `budget` (número BRL) | `resolve-options.ts` |
| `restrictions` | entrada de `restrictions.ts` (códigos do iFood) | `resolve-options.ts` |
| `energy`, `order-style`, `cravings`, `exclusions` | sinal para **sugerir o tema** e ranquear itens | Marco T (Júlio + Matheus) |

Ou seja, o Figma confirma que o "menu" que falta (`theme`) é **derivado** das Etapas 4 a 7, e que
essas respostas não são só decoração.

## 7. Estados propostos da Party

```text
OPEN
→ POST /parties/:id/close          (host "Iniciar party")
COLLECTING_ANSWERS
→ todos enviam respostas completas (Etapa 8, todos "Pronto")
READY_FOR_THEME
→ POST /parties/:id/reveal         (host "Revelar resultado")   ← novo
THEME_REVEALED
→ (tema escolhido — a definir pelo Júlio)
```

`THEME_REVEALED` é só um nome de trabalho; o que importa é que o Figma tem uma ação explícita do
host depois de `READY_FOR_THEME`, e o snapshot precisa refletir isso para a tela de revelação. A
decisão de estado e rota está em [`adr/0002-revelacao-do-resultado-da-party.md`](adr/0002-revelacao-do-resultado-da-party.md).

## 8. Decisões

### 8.1 Acordadas com a sessão da API (17/10/2026)

Decididas pela sessão que implementa (`apps/api/**`, `packages/contracts/**`, `openapi.yaml`).

| Tema | Decisão |
| --- | --- |
| Teto de seleção | `multi_choice` respeita `maxSelections` no `validateAnswers` (Etapa 6 = 2). |
| "Outro" com texto | `allowOther` + `otherOptionId` + `otherInput`; o texto vai em `answers["<questionId>__other"]` (string plana), exigido não vazio quando a opção `otherOptionId` está marcada. |
| Opção com valor | `QuestionnaireQuestionOption` ganha `value?: number` (`ate-25 → 25`); o "Outro valor" digitado vai em `answers["<questionId>__value"]`. Assim `/options` lê o número direto, sem tabela paralela. |
| Progresso | **Submissão incremental.** `SubmitAnswersRequest.completed` deixa de ser `const: true` e vira `boolean`; o servidor guarda respostas parciais e expõe um derivado no `Participant` (ex.: `answeredCount`). Vira `READY_FOR_THEME` só quando **todos** enviam `completed: true`. |
| Endereço (Etapa 1) | Resposta continua sendo o `addressId`. A lista vem de `listAddresses` (Maeda, sanitizado: alias/bairro/cidade, nunca rua/número/CEP); a sessão da API liga a rota `GET /parties/:id/addresses` (com provider de demonstração até o real plugar). |
| Revelar resultado | Ação do host + estado, `THEME_REVEALED` como nome de trabalho, host-only a partir de `READY_FOR_THEME`. O *o quê* é revelado é decisão do Júlio; a transição e o snapshot ficam garantidos. |
| Conexão OAuth | Mantida como **etapa explícita** (rota `.../mcp-connection/authorize`); não automática no `join`. O front encaixa o botão antes/junto da Etapa 1. |

Ação de contrato do Maeda: expor `listAddresses` sanitizado. Depois a sessão da API liga a rota.

**Status:** itens 1–4 (teto, "Outro", valor, progresso) implementados no worktree
`feature/frontend-reference`, commit `17b92fb` — *feat(api): support incremental questionnaire and
question config* (`npm test` 87/87 e build limpo). Detalhes da implementação:

- `Participant.answeredCount` ficou **opcional** no contrato, para não quebrar os mocks de
  `apps/web/lib/mock-party.ts`; o servidor sempre envia. Torná-lo obrigatório exige ajustar os mocks.
- Erros novos de `validateAnswers`: `too_many_selections`, `other_required`, `custom_value_required`.

Item 6 (`THEME_REVEALED`) implementado no commit `87c8766` — *feat(api): reveal the party result
from READY_FOR_THEME* (estado + `POST /parties/:id/reveal`, `403 HOST_ONLY` / `409
NOT_READY_FOR_REVEAL`), conforme o [ADR 0002](adr/0002-revelacao-do-resultado-da-party.md).

Pendentes: item 3 (`GET /parties/:id/addresses`, depende do `listAddresses` sanitizado do Maeda);
item 4 (mover `ResolveOptions*` para `packages/contracts`); item 5 (drift OpenAPI ↔ `.env.example`).
Item 7 (OAuth como etapa explícita) já está decidido e implementado na rota `.../authorize`.

### 8.2 Pendentes

| Decisão | Quem decide | Bloqueia |
| --- | --- | --- |
| Conteúdo final das 7 perguntas e ordem | Júlio | definição `v2` |
| `Veganismo` e `Alergia a amendoim` no lugar de `Sem açúcar` | Júlio | opções da Etapa 2 |
| Faixas de orçamento fechadas vs. valor livre | Júlio | Etapa 3 |
| Regra que transforma respostas em tema | Júlio + sessão da API | Marco T |

## 9. Próximos passos sugeridos

1. Júlio fecha conteúdo e rótulos das 7 perguntas; a definição `v2` segue a forma da seção 6.3.
2. Matheus estende `QuestionnaireQuestion` (`maxSelections`, `allowOther`, `otherInput`,
   `customInput`) e `validateAnswers`, com testes para o teto de 2 e o texto do "Outro".
3. Decidir progresso parcial; se sim, `SubmitAnswersRequest.completed` deixa de ser `const: true`.
4. Expor os endereços salvos da conta (`listAddresses`) para a Etapa 1, com a mesma sanitização de
   alias/bairro já usada em `ADDRESS_SELECTION_REQUIRED`.
5. Adicionar a ação `reveal` do host e o estado correspondente ao `PartySnapshot`.
6. Só depois ligar essas respostas ao agente de opções e à regra de tema.
