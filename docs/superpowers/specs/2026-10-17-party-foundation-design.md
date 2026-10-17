# Fundação multiusuário da Party

## Intenção

Construir o menor núcleo estável da solução atual: três pessoas entram na mesma Party por dispositivos diferentes, o anfitrião fecha o grupo, cada pessoa responde a um questionário ainda definido pelo produto e a sala avança automaticamente quando todos terminam.

Este recorte existe para liberar o trabalho paralelo de Júlio, Otávio e Maeda sem cristalizar decisões sobre tema, votação, cardápios, pedidos ou retrospectiva.

## Fluxo incluído

```text
Criar Party
→ Entrar por código
→ Anfitrião fecha o grupo
→ Participantes respondem
→ Party detecta que todos terminaram
→ READY_FOR_THEME
```

## Estados

- `OPEN`: participantes podem entrar; somente o anfitrião pode fechar o grupo.
- `COLLECTING_ANSWERS`: participantes estão congelados e enviam suas respostas.
- `READY_FOR_THEME`: todos enviaram respostas completas; o próximo fluxo será definido depois.

As transições são automáticas após o fechamento do grupo. O endpoint `advance` não faz parte da jornada do produto.

## Identidade temporária

Ao criar ou entrar na Party, a API devolve um token opaco do participante. O frontend guarda esse token no dispositivo e o envia como Bearer token nas ações privadas. O token não aparece no `PartySnapshot` nem é compartilhado com outros participantes.

Somente o token do anfitrião pode fechar o grupo. Cada token permite enviar respostas e conectar a conta do iFood apenas para o participante ao qual pertence.

## Questionário flexível

O Júlio ainda definirá as perguntas. A API não codifica campos como orçamento ou preferência. Ela recebe:

```json
{
  "questionnaireVersion": "v1",
  "answers": {
    "budget": 40,
    "preference": "massa"
  },
  "completed": true
}
```

Uma nova resposta do mesmo participante substitui a anterior. A Party chega a `READY_FOR_THEME` quando todos os participantes do grupo fechado possuem uma resposta com `completed: true`.

## Fronteira MCP

Cada participante conectará a própria conta do iFood MCP por autorização OAuth 2.1 durante a Party. O backend guarda apenas os tokens resultantes, em um registro privado na memória, indexado por `partyId + participantId`; eles nunca integram o estado público, logs, fixtures ou prompts. O `client_secret` do agente fica somente no backend. O modelo completo está em [`docs/ifood-mcp.md`](../../ifood-mcp.md).

Neste recorte, a API define a rota, o armazenamento privado e a interface de validação. O adaptador real do iFood MCP será implementado pelo Maeda conforme [`docs/adr/0001-uma-sessao-mcp-por-participante.md`](../../adr/0001-uma-sessao-mcp-por-participante.md).

## Atualização entre dispositivos

O frontend consulta `GET /parties/:id` a cada 1–2 segundos. WebSocket não faz parte deste recorte. Todas as instâncias recebem o mesmo `PartySnapshot` público.

## Restrições

- Node.js 22 e npm 10.
- Um único processo da API na Oracle.
- Estado e tokens (da Party e dos participantes) apenas em memória.
- Duas pessoas no mínimo; até quatro participantes no MVP.
- Três participantes serão usados no pitch.
- CORS configurável para a origem do frontend.
- A apresentação e a transcrição locais continuam fora do Git.

## Fora do escopo

- perguntas definitivas;
- geração de temas;
- votação;
- montagem de cardápios;
- criação e envio de pedidos;
- acompanhamento das entregas;
- retrospectiva;
- banco de dados;
- WebSocket;
- login permanente;
- integração real com o MCP.

## Critério de pronto

Três dispositivos conseguem entrar na mesma Party publicada, observar a lista de participantes, ter suas identidades isoladas, enviar respostas genéricas e observar a transição automática para `READY_FOR_THEME` quando o último participante termina.
