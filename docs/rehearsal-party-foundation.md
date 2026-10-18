# Ensaio — fundação da Party em três dispositivos

Este ensaio valida somente criação, entrada, fechamento do grupo, respostas, polling e o registro privado da conexão MCP. Tema, cardápios e pedidos ficam fora deste checkpoint.

> O passo 3 usa o fluxo OAuth por participante já implementado. No modo `demo` (padrão) não há
> login real; no modo `ifood`, cada pessoa entra na própria conta. Ver [`docs/ifood-mcp.md`](ifood-mcp.md).

## Antes do ensaio

- API publicada com HTTPS;
- `CORS_ORIGIN` igual à origem do frontend;
- três navegadores ou dispositivos;
- DevTools aberto para conferir respostas sem projetar tokens ou chaves.

Defina a URL pública em um terminal de apoio:

```bash
API_URL=https://api.exemplo.com
curl "$API_URL/health"
```

Resultado esperado:

```json
{"status":"ok"}
```

## 1. Criar a Party no dispositivo A

O frontend chama:

```http
POST /parties
Content-Type: application/json

{
  "name": "Jantar de sexta",
  "host": { "id": "ana", "name": "Ana" }
}
```

Conferir:

- HTTP `201`;
- estado `OPEN`;
- código de seis caracteres;
- token salvo apenas no `sessionStorage` do dispositivo A.

## 2. Entrar nos dispositivos B e C

Cada frontend chama `POST /parties/:code/join` com identidade diferente.

Conferir nos três dispositivos, após no máximo dois segundos:

- Ana, Bruno e Caio aparecem na lista;
- estado continua `OPEN`;
- cada navegador possui seu próprio token;
- nenhum token aparece em `GET /parties/:id`.

## 3. Conectar o iFood (OAuth por participante)

Cada dispositivo pede o link de autorização com o próprio Bearer token:

```http
POST /parties/:id/mcp-connection/authorize
Authorization: Bearer <token-do-dispositivo>
```

A resposta traz `{ authorizationUrl, status: "validating", mode }`. Abra `authorizationUrl` no
navegador do dispositivo. No modo `demo` (padrão) não há login real: o callback volta sozinho e
marca `connected`. No modo `ifood`, cada pessoa entra na própria conta do iFood e autoriza.

Conferir:

- o polling mostra `validating` e depois `connected` (ou `error`) apenas para aquele participante;
- nenhum `client_secret`, `access_token`, `refresh_token` ou `code` aparece na resposta, no polling,
  nos logs ou no DevTools compartilhado;
- uma requisição com token de outra Party retorna `403 ACCESS_DENIED`.

O backend guarda os tokens no registro privado, indexado por `partyId + participantId`; nunca há
chave colada nem `apiKey`. O modelo completo está em [`docs/ifood-mcp.md`](ifood-mcp.md).

## 4. Fechar o grupo

No dispositivo A, o anfitrião chama `POST /parties/:id/close` com seu Bearer token.

Conferir:

- estado muda para `COLLECTING_ANSWERS` nos três dispositivos;
- uma nova tentativa de entrada recebe `409 PARTY_CLOSED`;
- a mesma chamada feita por B ou C recebe `403 HOST_ONLY`.

## 5. Responder em cada dispositivo

Cada navegador envia uma resposta distinta:

```http
POST /parties/:id/answers
Authorization: Bearer <token-do-dispositivo>
Content-Type: application/json

{
  "questionnaireVersion": "v1",
  "answers": { "preference": "massa" },
  "completed": true
}
```

Conferir:

- depois de A e B, o estado permanece `COLLECTING_ANSWERS`;
- depois de C, o estado muda automaticamente para `READY_FOR_THEME`;
- os três dispositivos observam a mudança em até dois segundos;
- reenviar uma resposta substitui somente a resposta daquele dispositivo e não regride o estado.

## 6. Registrar o resultado

Anotar:

- URL e commit usados;
- horário do ensaio;
- dispositivos e navegadores;
- latência percebida do polling;
- qualquer erro e sua resposta JSON;
- se algum segredo apareceu em tela, log ou DevTools compartilhado.

O ensaio passa quando os três dispositivos chegam a `READY_FOR_THEME` sem recarregar a API nem trocar tokens manualmente.
