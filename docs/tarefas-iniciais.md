# Sprint 0 — tarefas iniciais

> Objetivo: em duas horas e meia, cada integrante termina com algo demonstrável sem depender do trabalho dos demais.

## Responsabilidades

| Integrante | Papel inicial | Área de propriedade |
| --- | --- | --- |
| Júlio | Design de produto | Fluxo, conteúdo, interface e pitch |
| Otávio | Party Experience | Frontend e jornada navegável |
| Maeda | iFood Agent | MCP, busca, carrinho e fixtures |
| Matheus | Capitão e Party Coordinator | Contratos, API, estado compartilhado e integração |

Otávio e Maeda podem trocar de papel caso a experiência técnica de cada um indique uma divisão melhor. As fronteiras entre os módulos permanecem as mesmas.

## Regra deste sprint

Cada pessoa deve conseguir demonstrar seu resultado isoladamente no checkpoint. Durante o Sprint 0:

- o frontend usa dados simulados;
- a API funciona sem o MCP;
- o MCP funciona em um script isolado;
- o design não espera implementação;
- o contrato de dados abaixo permanece congelado.

## Primeiros 15 minutos — Matheus

Criar e enviar a estrutura inicial:

```text
apps/
├── web/
└── api/

packages/
└── contracts/

fixtures/
└── party.json

docs/
```

Adicionar a fixture compartilhada:

```json
{
  "party": {
    "id": "party-123",
    "code": "CAOS42",
    "name": "Caos Crocante",
    "status": "REVIEWING_CARTS"
  },
  "participants": [
    {
      "id": "ana",
      "name": "Ana",
      "budget": 35,
      "restrictions": ["vegetarian"],
      "cartStatus": "ready",
      "orderStatus": null,
      "total": 31.9,
      "etaMinutes": 38
    },
    {
      "id": "bruno",
      "name": "Bruno",
      "budget": 40,
      "restrictions": [],
      "cartStatus": "pending",
      "orderStatus": null,
      "total": null,
      "etaMinutes": null
    }
  ],
  "mission": {
    "name": "Sobrevivência Crocante",
    "mode": "competitive",
    "roles": [
      "item_crocante",
      "bebida_desconhecida",
      "item_surpresa"
    ]
  }
}
```

Enquanto Matheus prepara essa estrutura:

- Júlio começa o fluxo e as regras da experiência;
- Otávio prepara o projeto do frontend ou seus componentes básicos;
- Maeda inicia a autenticação e a investigação do MCP.

---

## Júlio — Design de produto

### Missão

Definir a primeira Party completa e entregar tudo que o frontend precisa para representá-la.

### Tarefas

- [ ] Desenhar o fluxo abaixo:

```text
Criar Party
→ Compartilhar link
→ Entrar
→ Responder questionário
→ Ver meu kit
→ Ready check
→ Acompanhar entregas
→ Jogar
→ Ver resultado
```

- [ ] Definir as cinco perguntas do questionário:
  - orçamento;
  - restrições;
  - categoria desejada;
  - nível de surpresa;
  - clima da Party.
- [ ] Finalizar a modalidade **Caos Crocante**.
- [ ] Definir cinco rodadas ou ações curtas:
  1. revelar o item sem mostrar seu nome;
  2. apresentá-lo como um artefato;
  3. experimentar;
  4. votar;
  5. criar uma história coletiva.
- [ ] Escrever os textos dos principais estados:
  - esperando participantes;
  - esperando respostas;
  - gerando kits;
  - carrinho pronto;
  - esperando confirmação;
  - pedido atrasado;
  - todos receberam;
  - missão concluída.
- [ ] Criar wireframes em baixa fidelidade.
- [ ] Preparar o roteiro de uma demo de 90 segundos.

### Entregável do checkpoint

- fluxo visível no Figma;
- questionário final;
- regras executáveis do Caos Crocante;
- textos prontos para Otávio;
- roteiro curto da demonstração.

### Não fazer neste sprint

- identidade visual completa;
- ilustrações finais;
- animações;
- várias modalidades de jogo;
- telas administrativas.

---

## Otávio — Party Experience

### Missão

Construir o fluxo completo do usuário com dados simulados, sem esperar API, MCP ou design final.

### Área de propriedade

```text
apps/web/**
```

### Tarefas

- [ ] Criar as rotas ou telas equivalentes:

```text
/
/party/new
/party/:code
/party/:code/questions
/party/:code/review
/party/:code/tracking
/party/:code/play
/party/:code/recap
```

- [ ] Carregar os dados de `fixtures/party.json`.
- [ ] Implementar criação e entrada na Party.
- [ ] Mostrar participantes no lobby.
- [ ] Implementar o questionário.
- [ ] Exibir um carrinho simulado.
- [ ] Implementar o ready check.
- [ ] Mostrar o acompanhamento das entregas.
- [ ] Implementar a primeira rodada do jogo.
- [ ] Criar uma retrospectiva simples.
- [ ] Adicionar controles temporários de demonstração:

```text
[Avançar estado]
[Simular atraso]
[Marcar todos como entregues]
```

### Entregável do checkpoint

Uma aplicação navegável de ponta a ponta usando apenas a fixture compartilhada.

### Não fazer neste sprint

- autenticação;
- chamadas ao MCP;
- WebSocket;
- animações complexas;
- responsividade perfeita;
- gerenciamento sofisticado de estado.

---

## Maeda — iFood Agent

### Missão

Provar o caminho crítico do iFood MCP isoladamente e produzir dados reais que os outros módulos consigam consumir depois.

### Área de propriedade

```text
apps/api/src/ifood/**
apps/api/src/agent/**
fixtures/*ifood*.json
fixtures/resolved-kit-*.json
```

### Perguntas que precisam ser respondidas

- [ ] Como autenticar uma conta de teste?
- [ ] É possível manter mais de uma sessão simultaneamente?
- [ ] Como obter o endereço autorizado?
- [ ] Como buscar um mercado ou conveniência aberto?
- [ ] Como encontrar itens para três papéis semânticos?
- [ ] Como criar um carrinho no sandbox?
- [ ] Como acompanhar o pedido?
- [ ] Quais etapas não funcionam bem no sandbox?

### Fluxo técnico

Executar, sem enviar pedido real:

```text
autenticar
→ listAddresses
→ searchOffers ou browseOffers
→ getMerchant
→ getItem
→ criar carrinho no sandbox
```

### Interface esperada

```ts
type ResolveKitInput = {
  budget: number
  restrictions: string[]
  roles: string[]
}

type ResolveKitOutput = {
  merchant: {
    id: string
    name: string
  }
  items: Array<{
    role: string
    itemId: string
    name: string
    price: number
  }>
  total: number
  estimatedDeliveryMinutes: number
}
```

### Fixtures esperadas

```text
fixtures/
├── ifood-addresses.json
├── ifood-discovery-results.json
├── resolved-kit-ana.json
└── ifood-cart-result.json
```

Remover tokens, telefone, e-mail, CPF e endereço completo antes de salvar qualquer resposta.

### Entregável do checkpoint

- uma chamada real ao MCP;
- um kit resolvido;
- fixtures sanitizadas;
- relatório curto do que funcionou;
- decisão sobre como demonstrar múltiplos participantes.

### Não fazer neste sprint

- agente completo;
- suporte a todas as verticais;
- múltiplos estabelecimentos;
- otimização logística sofisticada;
- envio de pedido real.

---

## Matheus — Capitão e Party Coordinator

### Missão

Criar o contrato técnico, a sala compartilhada e uma máquina de estados independente do frontend e do MCP.

### Área de propriedade

```text
apps/api/src/party/**
packages/contracts/**
configuração de integração e deploy
```

### Tarefas

- [ ] Criar a estrutura inicial do repositório.
- [ ] Publicar a fixture e congelar o contrato do sprint.
- [ ] Definir os tipos compartilhados.
- [ ] Criar uma API em memória:

```text
POST /parties
GET  /parties/:id
POST /parties/:id/join
POST /parties/:id/answers
POST /parties/:id/plan
POST /parties/:id/ready
POST /parties/:id/order-status
POST /parties/:id/advance
```

- [ ] Implementar os estados:

```text
LOBBY
COLLECTING_ANSWERS
PLANNING
REVIEWING_CARTS
ORDERING
WAITING_DELIVERIES
READY_TO_PLAY
PLAYING
COMPLETED
```

- [ ] Aplicar as regras mínimas:
  - a Party começa em `LOBBY`;
  - dois participantes permitem avançar;
  - todos precisam responder ao questionário;
  - cada pessoa confirma individualmente;
  - a missão é liberada quando todos recebem;
  - `advance` permite controlar a demonstração.
- [ ] Manter uma lista de bloqueios e decisões.
- [ ] Impedir mudanças de escopo durante o sprint.

### Entregável do checkpoint

Uma API demonstrável de ponta a ponta:

```text
criar sala
→ entrar com duas pessoas
→ salvar respostas
→ marcar carrinhos prontos
→ atualizar pedidos
→ liberar missão
```

### Não fazer neste sprint

- banco de dados definitivo;
- login completo;
- WebSocket;
- filas;
- integração com Discord;
- autorização sofisticada;
- infraestrutura complexa.

---

## Checkpoint — após duas horas

Cada integrante tem cinco minutos:

1. **Júlio:** mostra o fluxo e conduz uma rodada do Caos Crocante.
2. **Otávio:** navega da criação da Party até a retrospectiva.
3. **Maeda:** mostra uma consulta real ao MCP e o kit resolvido.
4. **Matheus:** cria uma Party e avança seus estados pela API.

Depois das apresentações, o grupo decide apenas:

1. Quantas sessões reais do MCP são possíveis?
2. Quantos participantes aparecerão na demo?
3. Qual ajuste único o contrato precisa?
4. Qual é o maior bloqueio das próximas duas horas?
5. Quais três telas receberão acabamento visual primeiro?

## Integração — últimos 30 minutos

- Otávio troca a fixture pela API de Matheus, mantendo fallback local.
- Maeda adapta `ResolveKitOutput` ao contrato compartilhado.
- Matheus resolve divergências de contrato e integra somente o happy path.
- Júlio entrega textos e prioridades visuais para as telas centrais.

O frontend deve continuar demonstrável quando a API ou o MCP não estiver disponível:

```ts
const party = apiAvailable
  ? await fetchParty()
  : demoFixture
```

## Definição de pronto do Sprint 0

- [ ] O fluxo completo pode ser explicado em menos de dois minutos.
- [ ] A interface percorre a jornada usando fixtures.
- [ ] A API percorre a máquina de estados sem depender do MCP.
- [ ] Pelo menos uma consulta real ao MCP foi executada.
- [ ] A modalidade Caos Crocante possui regras executáveis.
- [ ] O grupo sabe quais partes da demo serão reais e quais serão simuladas.
- [ ] Cada integrante consegue demonstrar seu próprio resultado.
