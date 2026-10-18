# User MCP - Tools

> Fonte: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/account/tools (extraído em 2026-10-17)

O User MCP oferece 3 tools atômicas para gerenciar identidade e endereços de entrega. Este guia documenta cada tool, seus parâmetros, respostas e exemplos de código.

## Visão geral

| Tool | Descrição | Quando usar |
|---|---|---|
| [`getUser`](#getuser) | Obter nome, email, telefone, formas de pagamento e dados comportamentais | Personalização, saudações, descoberta de tiers |
| [`listAddresses`](#listaddresses) | Listar endereços de entrega salvos com padrões de uso | **SEMPRE primeiro** em qualquer fluxo de entrega |
| [`createAddress`](#createaddress) | Geocodificar e salvar um novo endereço de entrega | Após `listAddresses` retornar vazio ou usuário escolher "novo" |

## Índice rápido

- [`getUser`](#getuser) — Identidade do usuário com tiers baseados em escopos OAuth
- [`listAddresses`](#listaddresses) — Descoberta de endereços com inferência comportamental
- [`createAddress`](#createaddress) — Geocodificação two-step com confirmação, ou single-shot

---

## Convenções transversais

Todas as tools seguem estas convenções:

- **Chaves JSON**: `lowerCamelCase`
- **Identificadores**: UUID v4 para `addressId`; string opaca para `candidateId` (ex.: `cand-001`)
- **HTTP Status**: Sempre `200 OK` (JSON-RPC 2.0); erros vêm no corpo
- **Identidade**: o gateway injeta via header HTTP; o agente nunca fornece nem vê `userId`
- **Envelopes de resposta**: tools de leitura retornam `data`/`results`; erros retornam um objeto `errors`
- **agentHints**: Sempre presentes; orientam a próxima ação
- **Leitura vs Escrita**: `getUser` e `listAddresses` não têm efeitos colaterais; `createAddress` persiste

---

## Obter identidade e perfil do usuário

### `getUser`

Retorna o perfil do usuário autenticado — nome, email, telefone e, opcionalmente, formas de pagamento e dados comportamentais, conforme o tier de escopo OAuth (BASIC → ADVANCED → BEHAVIOR). Use para personalização, saudações e para validar quais escopos foram concedidos.

**Quando usar:**

- Saudar o usuário pelo nome (ponto de entrada da personalização)
- Entender o tier do perfil e a segmentação
- Obter formas de pagamento (tier ADVANCED+)
- Obter `taxPayerIdentificationNumber` (tier ADVANCED+)
- Acessar dados comportamentais para personalização (tier BEHAVIOR)

**Quando NÃO usar:**

- Para obter endereços, pedidos ou histórico de pagamento (use `listAddresses` ou outros domínios)
- Para descobrir quais formas de pagamento um estabelecimento aceita (use `listPaymentMethods` no Cart)
- Para fabricar ou adivinhar um `userId` (a identidade é injetada via header e invisível ao agente)

**Efeitos colaterais**: Nenhum (somente leitura).

**Pré-condições**: Usuário autenticado via OAuth; o gateway injeta a identidade via header.

#### Tiers de resposta (baseados nos escopos OAuth)

O gateway determina qual tier retornar conforme os escopos concedidos ao agente:

| Tier | Escopos necessários | Campos retornados |
|---|---|---|
| **BASIC** | `mcp.user.basic.read`, `mcp.user.addresses.read`, `mcp.user.addresses.write` | `fullName`, `email`, `phone` |
| **ADVANCED** | BASIC + `mcp.user.advanced.read` | BASIC + `taxPayerIdentificationNumber`, `paymentMethods` |
| **BEHAVIOR** | ADVANCED + `mcp.user.behavior.read` | ADVANCED + `profileData` (`hasClub`, `userBehaviorDescription`) |

#### Parâmetros

Nenhum — a identidade é injetada pelo gateway.

#### Resposta (Tier 1: BASIC)

```json
{
  "success": true,
  "data": {
    "fullName": "João Silva",
    "email": "foodlover@ifood.com.br",
    "phone": "55119999999"
  },
  "agentHints": {
    "suggestedNextAction": "Use the user's name for personalization. Check if the user has saved delivery addresses before searching for restaurants or items."
  }
}
```

#### Resposta (Tier 2: ADVANCED)

```json
{
  "success": true,
  "data": {
    "fullName": "João Silva",
    "email": "foodlover@ifood.com.br",
    "phone": "55119999999",
    "taxPayerIdentificationNumber": "11111111111",
    "paymentMethods": ["Cartão de Crédito", "Vale Refeição", "Pix"]
  },
  "agentHints": {
    "suggestedNextAction": "Use the user's name for personalization. Check if the user has saved delivery addresses before searching for restaurants or items."
  }
}
```

#### Resposta (Tier 3: BEHAVIOR)

```json
{
  "success": true,
  "data": {
    "fullName": "João Silva",
    "email": "foodlover@ifood.com.br",
    "phone": "55119999999",
    "taxPayerIdentificationNumber": "11111111111",
    "paymentMethods": ["Cartão de Crédito", "Vale Refeição", "Pix"],
    "profileData": {
      "hasClub": true,
      "userBehaviorDescription": "## 1) User Profile & Persona\n\n### User Persona\nPizza lover who orders primarily on weekends. Prefers mid-range restaurants and occasionally browses premium options. Club iFood subscriber.\n\n### Motivation\nConvenience-driven — orders when cooking isn't an option. Weekend dinner is the primary use case.\n\n[...]"
    }
  },
  "agentHints": {
    "suggestedNextAction": "Use the user's name for personalization. Check if the user has saved delivery addresses before searching for restaurants or items."
  }
}
```

**Campos de resposta (Tier 1 — BASIC):**

| Campo | Tipo | Descrição |
|---|---|---|
| `success` | boolean | `true` quando a operação foi concluída com sucesso. |
| `data` | object | Os dados do perfil do usuário, aninhados em `data`. |
| `data.fullName` | string | Nome completo do usuário, adequado para tratamento direto ("João Silva"). |
| `data.email` | string | Email do usuário autenticado. |
| `data.phone` | string | Telefone com código do país (ex.: `"55119999999"`). |
| `agentHints` | object | `suggestedNextAction` — orienta o agente a personalizar com o nome e verificar endereços salvos. |

**Campos de resposta (Tier 2 — ADVANCED, soma ao BASIC):**

| Campo | Tipo | Descrição |
|---|---|---|
| `data.taxPayerIdentificationNumber` | string | CPF, ex.: `"11111111111"`. |
| `data.paymentMethods` | array de strings | Formas de pagamento salvas na conta, ordenadas pela mais usada recentemente. |

**Campos de resposta (Tier 3 — BEHAVIOR, soma ao ADVANCED):**

| Campo | Tipo | Descrição |
|---|---|---|
| `data.profileData` | object | Dados de perfil e segmentação. |
| `data.profileData.hasClub` | boolean | Se o usuário é assinante do Club iFood. |
| `data.profileData.userBehaviorDescription` | string | String em Markdown com a saída do LCM (Large Commerce Model): persona, localização, padrões temporais, preferências alimentares, promoções, descoberta, social, avaliações, insights-chave e sinais de segmentação. |

#### Saída (Erro — falha de autenticação)

```json
{
  "errors": {
    "mcpCode": -32302,
    "code": "AUTHENTICATION_REQUIRED",
    "message": "The user is not authenticated. This is a gateway configuration issue — the external agent cannot resolve it. Do not retry. Inform the user that their session may have expired and they should re-authenticate.",
    "suggestedAction": "Tell the user: 'I couldn't verify your identity. Please make sure you're logged into iFood.' Do not attempt any other identity or address operations until this is resolved.",
    "retryable": false
  }
}
```

---

## Descobrir endereços salvos

### `listAddresses`

Retorna todos os endereços de entrega ativos da conta com análises de uso — contagem de pedidos por dia e turno, afinidade de categoria, flags de último usado e mais usado. **PRIMEIRA chamada obrigatória em todo fluxo de compra.** O número de resultados (0, 1 ou N) determina toda a jornada.

**Quando usar:**

- **PRIMEIRO passo obrigatório** em qualquer fluxo de compra/entrega
- Para descobrir locais de entrega disponíveis
- Para decidir se cria um novo endereço (lista vazia) ou deixa o usuário escolher um existente
- Para obter coordenadas para consultas de Offer Discovery
- Para entender os padrões de entrega do usuário

**Quando NÃO usar:**

- Após etapas de descoberta/carrinho (o endereço DEVE vir primeiro)
- Para listar endereços arquivados ou excluídos (somente endereços ativos)
- Para salvar um novo endereço (use `createAddress`)

**Efeitos colaterais**: Nenhum (somente leitura).

**Pré-condições**: Usuário autenticado via gateway; sem parâmetros de entrada.

**Regra de ordenação:** Endereços com `alias` vêm primeiro, seguidos dos sem alias ordenados pelo mais recentemente criado/editado (até 20). Lista vazia quando não há endereços salvos.

#### Parâmetros

Nenhum — retorna todos os endereços ativos em uma única resposta.

#### Resposta (com endereços)

```json
{
  "results": [
    {
      "addressId": "28e8f7e5-7970-46b0-9ab3-f93d155bbf47",
      "formattedAddress": "R. Anésio Lafayette Raizer, 157, Casa 14, Vila José Iório, Campinas, SP",
      "alias": "Casa",
      "location": {
        "street": "R. Anésio Lafayette Raizer",
        "number": "157",
        "neighborhood": "Vila José Iório",
        "city": "Campinas",
        "state": "SP"
      },
      "postalCode": "13105532",
      "complement": "Casa 14",
      "reference": "Próximo ao Platz Mall",
      "coordinates": {
        "latitude": -22.882708,
        "longitude": -46.970348
      },
      "isLastUsedAddress": true,
      "isMostUsedAddress30d": true,
      "topMerchantTypes": {
        "DRUGSTORE": "1",
        "GROCERIES": "1",
        "RESTAURANT": "10"
      },
      "topWeekDayShift": {
        "Friday dinner": "3",
        "Friday snack": "1",
        "Monday dinner": "2",
        "Sunday lunch": "2",
        "Sunday snack": "1",
        "Tuesday dinner": "1",
        "Wednesday dinner": "2"
      },
      "ordersByMerchantTypeWeekdayAndShift": {
        "DRUGSTORE": {
          "Sunday": { "lunch": "1" }
        },
        "GROCERIES": {
          "Sunday": { "snack": "1" }
        },
        "RESTAURANT": {
          "Friday": { "dinner": "3", "snack": "1" },
          "Monday": { "dinner": "2" },
          "Sunday": { "lunch": "1" },
          "Tuesday": { "dinner": "1" },
          "Wednesday": { "dinner": "2" }
        }
      }
    }
  ],
  "agentHints": {
    "addressCount": 1,
    "suggestedNextAction": "Single saved address — use it as the delivery address without waiting for confirmation. Inform the user which address is being used (prefer the alias when available). Let them know they can provide a new address if it is not correct.",
    "nextStepWhenUserPicksAddress": "Use the coordinates (latitude/longitude) from this address immediately to find nearby restaurants and items. Inform the user which address is being used (prefer the alias). Tell them they can provide a new address if it is not correct."
  }
}
```

**Campos de resposta:**

| Campo | Tipo | Descrição |
|---|---|---|
| `results` | array | Todos os endereços ativos, com alias primeiro, depois os mais recentemente criados/editados (até 20). |
| `addressId` | string | Identificador persistente da conta. Use nas tools de Offer Discovery e Cart. |
| `formattedAddress` | string | String de exibição completa, formato `{street}, {number}, {complement}, {neighborhood}, {city}, {state}`. NÃO inclui CEP nem `reference`. |
| `alias` | string \| null | Rótulo amigável ("Casa", "Trabalho"). Prefira este sobre `formattedAddress` ao apresentar opções. |
| `location` | object | Componentes normalizados: `street`, `number`, `neighborhood`, `city`, `state`. `number` pode estar ausente. |
| `postalCode` | string | CEP sem máscara (ex.: `"13105532"`). |
| `complement` | string \| null | Apartamento, bloco ou outro complemento. |
| `reference` | string \| null | Ponto de referência para entrega ("Próximo ao Platz Mall", "Portão azul"). |
| `coordinates` | object | `latitude` e `longitude` para raio de entrega e roteamento. |
| `isLastUsedAddress` | boolean | True se foi o endereço usado no pedido mais recente. |
| `isMostUsedAddress30d` | boolean | True se tem a maior contagem de uso nos últimos 30 dias. |
| `topMerchantTypes` | map | Tipos de estabelecimento mais pedidos neste endereço. Chaves são valores do enum `merchantType` (`RESTAURANT`, `DRUGSTORE`, `GROCERIES`, `PETSTORE`, `LIQUORSTORE`, `SHOPPING`); valores são contagens em string. |
| `topWeekDayShift` | map | Combinações dia+turno mais pedidas. Chaves são `"{Weekday} {shift}"` (ex.: `"Friday dinner"`); valores são contagens em string. |
| `ordersByMerchantTypeWeekdayAndShift` | map | Tabela cruzada por tipo de estabelecimento × dia da semana × turno. Sinal primário para casar a intenção do usuário a um endereço. |

> **Nota sobre formato das contagens:** Todas as contagens nos três mapas comportamentais são **strings** (ex.: `"10"`), não inteiros — converta antes de fazer aritmética. Chaves de dia são capitalizadas (`"Friday"`); chaves de turno são minúsculas (`"dinner"`).

#### Inferência comportamental (múltiplos endereços)

Quando o usuário tem vários endereços e há dados comportamentais, `agentHints.suggestedNextAction` instrui o agente a **inferir** o endereço mais provável em vez de listar todas as opções. Os campos usados na inferência são:

| Campo | Uso na inferência |
|---|---|
| `ordersByMerchantTypeWeekdayAndShift` | Sinal primário — casar a intenção (categoria + dia/turno) |
| `isLastUsedAddress` | Desempate — endereço do pedido mais recente |
| `isMostUsedAddress30d` | Desempate — maior uso nos últimos 30 dias |
| `topMerchantTypes` | Afinidade de categoria neste endereço |
| `topWeekDayShift` | Padrões de dia+turno |

**Prioridade da inferência:** (1) casar a intenção com `ordersByMerchantTypeWeekdayAndShift`; (2) `isLastUsedAddress`; (3) `isMostUsedAddress30d`. Confirme brevemente pelo alias (ex.: "Entregar na Casa?") — nunca assuma em silêncio.

#### agentHints — seleção de endereço

| Cenário | `addressCount` | Hints retornados | Comportamento do agente |
|---|---|---|---|
| Sem endereços | — (omitido) | `noResultsGuidance` | Pedir endereço; salvar na conta |
| Endereço único | `1` | `suggestedNextAction`, `nextStepWhenUserPicksAddress` | Usar imediatamente; informar; sem confirmação |
| Múltiplos + dados comportamentais | `N` | `addressCount`, `suggestedNextAction`, `nextStepWhenUserPicksAddress` | Inferir o mais provável; confirmar em uma pergunta; listar só se rejeitar |
| Múltiplos, sem dados comportamentais | `N` | `addressCount`, `suggestedNextAction`, `dataWarning`, `nextStepWhenUserPicksAddress` | Apresentar opções por alias; não inferir |

#### Resposta (lista vazia)

```json
{
  "results": [],
  "agentHints": {
    "noResultsGuidance": "No saved addresses found. Ask the user for their delivery address as a free-form string (e.g., 'Avenida Paulista, 100, São Paulo, SP'), then save it on the user's account."
  }
}
```

#### Resposta (múltiplos endereços, sem dados comportamentais)

```json
{
  "results": [
    { "addressId": "fb7fbc80-9520-47fa-b7ac-83d6662c97f2", "alias": "Casa", "formattedAddress": "Avenida Paulista, 100, Bela Vista, São Paulo, SP" },
    { "addressId": "ca2b81f4-d4a8-5f31-88b2-64e7771d28g3", "alias": "Trabalho", "formattedAddress": "Rua Canário, 981, Moema, São Paulo, SP" }
  ],
  "agentHints": {
    "addressCount": 2,
    "suggestedNextAction": "Multiple saved addresses and behavioral data is unavailable. Present options to the user by alias when available (Casa, Trabalho) and ask which one to use for delivery.",
    "dataWarning": "Behavioral data is unavailable for this call. Do not infer a preferred address — present saved options and ask the user to choose.",
    "nextStepWhenUserPicksAddress": "After the user confirms the delivery address (whether inferred or explicitly chosen), use its coordinates (latitude/longitude) to find nearby restaurants and items. If you inferred the address from behavioral data, you must get confirmation before proceeding. If the user wants a different address, collect it as a free-form string and save it on the user's account."
  }
}
```

#### Saída (Erro — serviço indisponível)

```json
{
  "errors": {
    "mcpCode": -32502,
    "code": "SERVICE_UNAVAILABLE",
    "message": "The address service is temporarily unavailable. Do not retry immediately. Inform the user that address lookup is down and suggest they try again in a few minutes. You can proceed to Offer Discovery with a user-provided location if available.",
    "suggestedAction": "Tell the user: 'I'm having trouble accessing your saved addresses. You can tell me your delivery address directly if you know it, or we can wait a moment and try again.'",
    "retryable": true
  }
}
```

---

## Geocodificar e persistir novo endereço

### `createAddress`

Geocodifica uma string de endereço livre, retorna candidatos para confirmação do usuário e então persiste o endereço escolhido. Suporta dois fluxos: (1) **two-step** — geocodificar → confirmar → criar, e (2) **single-shot** — quando o usuário fornece endereço + complemento de uma vez e o match é SINGLE, cria diretamente. A geocodificação é encapsulada — o agente nunca chama uma tool de geocodificação separada.

**Quando usar:**

- Após `listAddresses` retornar vazio (usuário sem endereços salvos)
- Quando o usuário escolhe adicionar um novo endereço (após ver os salvos)
- Two-step: geocodificar, confirmar com o usuário e criar (inclua `neighborhood` quando a geocodificação omitir)
- Single-shot: criar diretamente quando o usuário forneceu todos os essenciais e o bairro é resolvível

**Quando NÃO usar:**

- Antes de chamar `listAddresses` (descoberta de endereço primeiro)
- Fabricando strings de endereço (colete do usuário)
- Sem `address` (mínimo obrigatório)
- Adivinhando `candidateId` (obtenha de uma resposta de geocodificação)
- Colocando bairro em `complement` ou `reference` (use `neighborhood`)

**Efeitos colaterais:** Cria um novo endereço na conta. Two-step: apenas na confirmação com `candidateId`. Single-shot: na primeira chamada se SINGLE e bairro resolvível. Idempotente via `candidateId`.

#### Resolução de bairro

A validação de endereço brasileira exige `neighborhood` (bairro). Provedores de geocodificação podem omiti-lo — especialmente em municípios pequenos. O servidor resolve o bairro nesta ordem antes de persistir:

1. **Parâmetro explícito `neighborhood`** — maior prioridade; use quando a geocodificação omitir ou o usuário corrigir.
2. **Valor geocodificado** — `candidates[].location.neighborhood`.
3. **Fallback da consulta de endereço** — extração best-effort do token entre número e cidade (ex.: `"Rua X, 44, Centro, Sonora, MS"` → `"Centro"`).

Se nada resolver, a persistência é bloqueada com `MISSING_NEIGHBORHOOD` (two-step) ou o servidor retorna candidatos com orientação para coletar o bairro (degradação do single-shot).

**Regras do agente:**

- Verifique `candidates[].location.neighborhood` após geocodificar. Se vazio, pergunte: *"Qual é o bairro?"*
- Reenvie com `candidateId` + `neighborhood` na confirmação.
- Nunca codifique o bairro em `complement` ou `reference`.

#### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `address` | string | sim | String de endereço livre (ex.: `"Avenida Paulista, 100, São Paulo, SP"`). |
| `neighborhood` | string | condicional | Bairro. Obrigatório quando a geocodificação não retornar e o fallback não resolver. Envie na confirmação (com `candidateId`) ou no single-shot. Sobrescreve o bairro geocodificado. |
| `alias` | string | não | Rótulo amigável ("Casa", "Trabalho"). Fortemente recomendado quando o usuário tem outros endereços. |
| `complement` | string | não | Apartamento, bloco ou outro complemento (ex.: `"Apto 72"`). |
| `reference` | string | não | Ponto de referência ("Portão azul", "Perto do mercado"). |
| `candidateId` | string | condicional | Obrigatório para confirmar e criar. Vem do candidato escolhido em uma resposta `candidates[]`. Também é a chave de idempotência. |

#### Passo 1: Geocodificação (sem efeitos colaterais)

Chame `createAddress(address)` para geocodificar. Retorna `matchConfidence` com candidatos:

**Candidato único:**

```json
{
  "matchConfidence": "SINGLE",
  "candidates": [
    {
      "candidateId": "cand-001",
      "formattedAddress": "Avenida Paulista, 100, Bela Vista, São Paulo, SP, CEP 01310-100",
      "location": {
        "street": "Avenida Paulista",
        "number": "100",
        "neighborhood": "Bela Vista",
        "city": "São Paulo",
        "state": "SP"
      },
      "postalCode": "01310-100",
      "coordinates": {
        "latitude": -23.561414,
        "longitude": -46.656139
      }
    }
  ],
  "agentHints": {
    "confirmAddressGuidance": "The address 'Avenida Paulista, 100' matched a single location. Confirm with the user and ask together: 'Avenida Paulista, 100, Bela Vista, São Paulo, SP, CEP 01310-100 — confirm? What's the complement and a nickname, like Casa or Trabalho? A delivery reference?' Then re-submit with the same address, plus alias, complement, reference, neighborhood (if geocoding omitted it), and the candidateId."
  }
}
```

**Candidato único — geocodificação omitiu o bairro:**

```json
{
  "matchConfidence": "SINGLE",
  "candidates": [
    {
      "candidateId": "cand-002",
      "formattedAddress": "Rua Rio Grande do Sul, 44, Sonora, MS, CEP 79400-000",
      "location": {
        "street": "Rua Rio Grande do Sul",
        "number": "44",
        "neighborhood": "",
        "city": "Sonora",
        "state": "MS"
      },
      "postalCode": "79400-000",
      "coordinates": {
        "latitude": -17.57,
        "longitude": -54.75
      }
    }
  ],
  "agentHints": {
    "confirmAddressGuidance": "The address matched a single location. Geocoding did not return neighborhood (bairro). Ask the user explicitly for the neighborhood, then re-submit with the same address, candidateId, neighborhood, and optional complement, alias, and reference to create the address."
  }
}
```

**Múltiplos candidatos:**

```json
{
  "matchConfidence": "MULTIPLE",
  "candidates": [
    {
      "candidateId": "cand-001",
      "formattedAddress": "Avenida Paulista, 100, Bela Vista, São Paulo, SP, CEP 01310-100",
      "location": { "street": "Avenida Paulista", "number": "100", "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP" },
      "postalCode": "01310-100",
      "coordinates": { "latitude": -23.561414, "longitude": -46.656139 }
    },
    {
      "candidateId": "cand-002",
      "formattedAddress": "Avenida Paulista, 100, Paraíso, São Paulo, SP, CEP 01310-101",
      "location": { "street": "Avenida Paulista", "number": "100", "neighborhood": "Paraíso", "city": "São Paulo", "state": "SP" },
      "postalCode": "01310-101",
      "coordinates": { "latitude": -23.573254, "longitude": -46.645012 }
    }
  ],
  "agentHints": {
    "confirmAddressGuidance": "The address 'Avenida Paulista, 100' matched multiple locations in São Paulo. Present the candidates to the user by formattedAddress and ask for confirmation, together with: '[formattedAddress] — confirm? What's the complement and a nickname, like Casa or Trabalho? A delivery reference?' If any candidate has an empty neighborhood, ask for bairro and include neighborhood on re-submit."
  }
}
```

#### Criação single-shot

Quando o usuário fornece `address` (rua + número) e `complement` em uma única interação, a geocodificação retorna um match SINGLE e o bairro é resolvível, o agente pode pular a confirmação e criar diretamente em uma chamada.

**Pré-condições do single-shot:** match SINGLE; usuário forneceu `address` + `complement`; bairro resolvível. Retorna `createdDirectly: true` em `agentHints`.

```json
{
  "matchConfidence": "SINGLE",
  "addressId": "fb7fbc80-9520-47fa-b7ac-83d6662c97f2",
  "formattedAddress": "Avenida Paulista, 100, Apto 72, Bela Vista, São Paulo, SP, CEP 01310-100",
  "alias": null,
  "location": { "street": "Avenida Paulista", "number": "100", "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP" },
  "postalCode": "01310-100",
  "complement": "Apto 72",
  "reference": null,
  "coordinates": { "latitude": -23.561414, "longitude": -46.656139 },
  "agentHints": {
    "nextStepWhenUserPicksAddress": "Address created and saved. Use the coordinates (latitude/longitude) from this address to find nearby restaurants and items.",
    "createdDirectly": true
  }
}
```

**Quando NÃO usar single-shot:**

- `matchConfidence` é `"MULTIPLE"` → sempre confirme com o usuário
- Usuário NÃO forneceu `complement` → colete antes de criar
- Bairro não resolvível → colete o bairro primeiro (o servidor degrada para candidatos)
- O agente está inseguro sobre qualquer campo → confirme antes de criar

#### Passo 2: Confirmação e criação

Após o usuário confirmar, chame `createAddress` com `candidateId` + `complement`, `alias`, `reference` (e `neighborhood` quando necessário):

```json
{
  "addressId": "fb7fbc80-9520-47fa-b7ac-83d6662c97f2",
  "formattedAddress": "Avenida Paulista, 100, Bela Vista, São Paulo, SP, CEP 01310-100",
  "alias": "Casa",
  "location": { "street": "Avenida Paulista", "number": "100", "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP" },
  "postalCode": "01310-100",
  "complement": "Apto 72",
  "reference": "Portão azul",
  "coordinates": { "latitude": -23.561414, "longitude": -46.656139 },
  "agentHints": {
    "nextStepWhenUserPicksAddress": "Address saved. Use the coordinates (latitude/longitude) from this address to find nearby restaurants and items."
  }
}
```

**Idempotência:** `candidateId` é a chave de idempotência. Chamadas duplicadas de confirmação com o mesmo `candidateId` e mesmos parâmetros retornam `agentHints.alreadyExists: true` (não é erro). Chamadas duplicadas com o mesmo `candidateId` mas parâmetros diferentes retornam `CANDIDATE_ID_CONFLICT`.

```json
{
  "addressId": "fb7fbc80-9520-47fa-b7ac-83d6662c97f2",
  "formattedAddress": "Avenida Paulista, 100, Bela Vista, São Paulo, SP, CEP 01310-100",
  "alias": "Casa",
  "location": { "street": "Avenida Paulista", "number": "100", "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP" },
  "postalCode": "01310-100",
  "complement": "Apto 72",
  "reference": "Portão azul",
  "coordinates": { "latitude": -23.561414, "longitude": -46.656139 },
  "agentHints": {
    "nextStepWhenUserPicksAddress": "This address was already created (idempotent response). Use the coordinates to find nearby restaurants — no need to create it again.",
    "alreadyExists": true
  }
}
```

#### Campos de resposta (endereço criado)

| Campo | Tipo | Descrição |
|---|---|---|
| `addressId` | string | Identificador persistente da conta. Use nas tools de Offer Discovery e Cart. |
| `formattedAddress` | string | String completa incluindo CEP. Two-step: `{street}, {number}, {neighborhood}, {city}, {state}, CEP {postalCode}`. Single-shot: inclui `complement` antes do `neighborhood`. |
| `alias` | string \| null | Rótulo amigável ("Casa", "Trabalho"). |
| `location` | object | Componentes normalizados: `street`, `number`, `neighborhood`, `city`, `state`. |
| `postalCode` | string | CEP do endereço validado. |
| `complement` | string \| null | Apartamento, bloco ou outro complemento. |
| `reference` | string \| null | Ponto de referência ("Portão azul", "Perto do mercado"). |
| `coordinates` | object | `latitude` e `longitude` para raio de entrega e roteamento. |

---

## Erros comuns dos agentes

- **Pular `listAddresses`:** pular para a criação de endereço antes de verificar os salvos faz o usuário reinserir informações que já forneceu. Sempre liste primeiro.
- **Listar todos os endereços quando há dados comportamentais:** quando `agentHints.suggestedNextAction` instrui inferência, não apresente todos os endereços por padrão. Infira o mais provável, confirme brevemente e liste todas as opções só se o usuário rejeitar ou pedir.
- **Inferir sem confirmação (múltiplos endereços):** obtenha uma breve confirmação do usuário antes de prosseguir — nunca assuma em silêncio. Não se aplica quando há só um endereço salvo.
- **Esperar campos de endereço explícitos:** `createAddress` aceita uma única string `address`. Não divida em rua/número/cidade/estado — exceto `neighborhood`, que tem um parâmetro dedicado.
- **Ignorar bairro ausente:** quando `candidates[].location.neighborhood` estiver vazio ou a orientação pedir bairro, pergunte ao usuário e reenvie com `neighborhood`. Não coloque bairro em `complement` ou `reference`.
- **Não pedir `alias` em novos endereços:** quando o usuário já tem 1+ endereços salvos, sempre sugira um alias para o novo.

---

## Segurança e identidade

Todas as tools do User MCP recebem a identidade do usuário **automaticamente via header HTTP do gateway**:

- O agente externo **nunca** fornece nem vê `userId`
- O gateway injeta a identidade de forma transparente a partir do token OAuth
- Apenas o usuário autenticado acessa seus próprios dados

`getUser` retorna `fullName` para personalização; as tools de endereço retornam identificadores de domínio (`addressId`). O `userId` subjacente nunca é exposto.

---

## Fluxo completo: entrada para saída

```text
1. getUser()
   └─ Saudar o usuário pelo nome (personalização)

2. listAddresses()  ← SEMPRE primeiro
   ├─ vazio          → coletar novo endereço (passo 3)
   ├─ 1 endereço     → usar direto; informar (sem confirmação)
   └─ N endereços    → inferir (com dados comportamentais) e confirmar, ou apresentar opções

3. createAddress()
   ├─ Passo 1: geocodificar → matchConfidence + candidates[]
   ├─ (single-shot se aplica) → criar direto
   ├─ (caso contrário) confirmar com o usuário
   └─ Passo 2: confirmar e criar → addressId permanente

4. Usar addressId / coordenadas nos próximos MCPs
   ├─ Offer Discovery: encontrar restaurantes e itens
   ├─ Cart: criar carrinho e definir entrega
   └─ Order Tracking: rastrear pedido
```

**Regra crítica**: `listAddresses` é SEMPRE o ponto de entrada. Nunca comece com `createAddress`.

