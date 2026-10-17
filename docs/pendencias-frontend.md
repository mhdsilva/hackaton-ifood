# Pendências do frontend

> Bugs conhecidos do app web de referência (`apps/web`) para o Colucci resolver.
> O `apps/web` não está versionado agora; este documento vive no repo para não se perder.

## 1. `fetch` desvinculado quebra o cliente no navegador

**Arquivo:** `apps/web/src/party-api.ts` (construtor da classe `PartyApi`).

```ts
constructor(
  baseUrl: string,
  private readonly fetch: typeof globalThis.fetch = globalThis.fetch,
) {
```

O `fetch` global é guardado em um campo e depois chamado como `this.fetch(...)`. No navegador,
`window.fetch` precisa ser chamado com `this === window`; chamá-lo desvinculado lança:

```
TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
```

O `fetch` do Node tolera a chamada desvinculada, então os testes passam — mas no navegador
**toda** chamada da API falha (criar Party, entrar, buscar polling, iniciar OAuth). O erro aparece
no `#feedback` da tela.

**Reproduzir:**

```bash
npm run dev:api
npm run dev:web
# abrir http://localhost:5173 e tentar criar uma Party
```

**Correção sugerida:** vincular o default ao `globalThis`, por exemplo
`globalThis.fetch.bind(globalThis)`, ou chamar `globalThis.fetch(...)` em vez de `this.fetch(...)`.
Preservar a injeção usada nos testes (`new PartyApi(url, transport.fetch)`).
