# Ensaio — fundação da Party em três dispositivos

Este ensaio valida somente criação, entrada, fechamento do grupo, respostas, polling e o registro privado da conexão MCP. Tema, cardápios e pedidos ficam fora deste checkpoint.

> O passo 3 usa o placeholder de `apiKey` do recorte atual. O iFood MCP real conecta por OAuth 2.1 por participante — ver [`docs/ifood-mcp.md`](ifood-mcp.md). Quando o adaptador OAuth entrar, o passo 3 vira um redirecionamento de autorização.

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

## 3. Registrar três conexões MCP de ensaio (placeholder)

Placeholder do recorte: cada dispositivo chama a rota de conexão com uma `apiKey` fictícia.

```http
POST /parties/:id/mcp-connection
Authorization: Bearer <token-do-dispositivo>
Content-Type: application/json

{ "apiKey": "chave-de-ensaio-distinta" }
```

Conferir:

- resposta `{ "status": "validating" }`;
- o polling mostra `validating` apenas para aquele participante;
- a chave não aparece na resposta nem no polling;
- uma requisição com token de outra Party retorna `403 ACCESS_DENIED`.

Use chaves falsas neste primeiro ensaio. Na versão correta, o participante autoriza a conta por
OAuth 2.1 (`POST .../mcp-connection/authorize` → navegador → `GET .../mcp-connection/callback`) e
o backend guarda os tokens, nunca uma chave colada.

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
