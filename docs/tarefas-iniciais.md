# Sprint 0 — fundação da Party

> Objetivo atual: três dispositivos chegam juntos a `READY_FOR_THEME`, sem depender das decisões ainda abertas sobre tema, cardápio ou retrospectiva.

A proposta anterior de missão, papéis semânticos e jogo foi substituída. O escopo aprovado está na [especificação da fundação](superpowers/specs/2026-10-17-party-foundation-design.md).

## Matheus — Party Coordinator

Área:

```text
apps/api/src/party/**
apps/api/src/mcp/**
packages/contracts/**
apps/api/openapi.yaml
```

Tarefas:

- [ ] substituir o contrato antigo pelos estados `OPEN`, `COLLECTING_ANSWERS` e `READY_FOR_THEME`;
- [ ] emitir um token temporário ao criar ou entrar na Party;
- [ ] limitar a sala a quatro participantes;
- [ ] permitir que somente o anfitrião feche o grupo;
- [ ] receber respostas genéricas vinculadas ao token;
- [ ] avançar automaticamente quando todos responderem;
- [ ] manter os tokens MCP dos participantes em um registro privado;
- [ ] publicar a API na Oracle;
- [ ] ensaiar o fluxo em três dispositivos.

## Otávio — experiência multiusuário

Área:

```text
apps/web/**
```

Tarefas que podem começar sem outras decisões:

- [ ] criar e entrar em uma Party por código;
- [ ] guardar `participantToken` em `sessionStorage`;
- [ ] mostrar os participantes da sala;
- [ ] permitir que o anfitrião feche o grupo;
- [ ] consultar `GET /parties/:id` a cada 1–2 segundos;
- [ ] renderizar um formulário a partir da definição temporária do Júlio;
- [ ] enviar respostas genéricas sem fixar campos no cliente de API;
- [ ] exibir o estado da conexão MCP sem expor tokens nem segredos.

## Maeda — isolamento MCP

Área:

```text
apps/api/src/ifood/**
apps/api/src/agent/**
fixtures/*ifood*.json
```

Tarefas:

- [ ] ler [`docs/ifood-mcp.md`](ifood-mcp.md) e confirmar o modelo OAuth 2.1 com os organizadores;
- [ ] registrar o agente e obter `client_id` + `client_secret` após a homologação;
- [ ] criar test accounts no sandbox;
- [ ] executar o spike descrito no [ADR de sessões MCP](adr/0001-uma-sessao-mcp-por-participante.md);
- [ ] autorizar e provar duas, depois três sessões no mesmo processo;
- [ ] confirmar autenticação por token, sem variável global;
- [ ] validar o refresh do `access_token` com o `refresh_token`;
- [ ] sanitizar respostas antes de criar fixtures;
- [ ] expor uma validação que não devolva nem registre tokens ou segredos;
- [ ] documentar o fallback caso a biblioteca use credencial global.

## Júlio — produto

Tarefas:

- [ ] definir as perguntas e uma versão do questionário;
- [ ] definir como respostas geram sugestões de tema;
- [ ] decidir se haverá votação e como ela termina;
- [ ] entregar estados e textos de carregamento, erro e nova tentativa;
- [ ] evitar fixar detalhes de cardápio antes do spike do MCP.

## Contrato deste primeiro checkpoint

```text
Criar Party
→ Entrar por código
→ Fechar grupo
→ Responder
→ READY_FOR_THEME
```

## Fora deste checkpoint

- geração e votação de temas;
- montagem de cardápios;
- carrinhos e pedidos;
- entregas;
- retrospectiva;
- WebSocket;
- persistência definitiva.
