# Diretrizes de desenvolvimento do frontend

Estas diretrizes se aplicam a `apps/web/**`, área de responsabilidade do Otávio no iFood Party (anteriormente SideQuest Party). O objetivo é entregar uma jornada demonstrável, com estrutura simples e adequada ao hackathon.

## Contexto e estado atual

O setup implementado usa Next.js com App Router, React, TypeScript estrito, Tailwind CSS e shadcn/ui. A rota `/` é uma página provisória com acesso à vitrine em `/dev/components`, que demonstra variantes, tamanhos e estados de um único `Button` compartilhado. A vitrine é uma ferramenta de desenvolvimento, fora da jornada final do app. Acrescentar componentes conforme forem necessários nas telas e atualizar os exemplos quando o design do Figma for aplicado. O design final, a jornada da Party, mocks de interação, integração API/MCP e animações ainda serão implementados. Conforme alinhamento com Matheus, a API ainda não está pronta para uso pelo frontend; começar a jornada com mocks tipados até a integração ser liberada.

O monorepo possui npm workspaces, API em memória, contratos TypeScript e uma fixture compartilhada. O recorte de produto atual vai de criar/entrar na Party até `READY_FOR_THEME`, passando pelo fechamento do grupo e questionário. Carrinhos, pedidos, entregas, jogo e retrospectiva estão fora deste checkpoint. Os scripts do frontend já existem; o build da raiz contempla API e web, e `build:api` preserva o build exclusivo do backend.

## Ambiente e comandos

- Executar instalação, desenvolvimento e verificações no Docker Desktop com containers Linux. A imagem usa Node 24.22.0 Debian bookworm-slim, fixada por digest em `Dockerfile.dev`; usar o npm fornecido nessa imagem e o lockfile único da raiz.
- Executar os comandos abaixo na raiz do repositório:

```bash
# Construir e iniciar; npm ci e o build dos contratos precedem o servidor.
docker compose -f compose.dev.yaml up -d --build
# Página: http://localhost:5173
docker compose -f compose.dev.yaml logs -f web

# Verificações com o serviço iniciado.
docker compose -f compose.dev.yaml exec web npm run lint:web
docker compose -f compose.dev.yaml exec web npm run typecheck:web

# Parar o dev antes de construir: desenvolvimento e produção usam .next.
docker compose -f compose.dev.yaml stop web
docker compose -f compose.dev.yaml run --rm web npm run build:web
docker compose -f compose.dev.yaml run --rm --service-ports web npm run start:web
# Ctrl+C encerra o servidor de produção. Para voltar ao dev:
docker compose -f compose.dev.yaml up -d web

# Parar e remover containers, preservando os volumes.
docker compose -f compose.dev.yaml down
```

- Dependências, saída dos contratos e `.next` ficam em volumes Docker. O código é compartilhado com o host. O dev usa Webpack e `WATCHPACK_POLLING=true` para atualização ao salvar no Windows.
- O comando de início executa `npm ci` para sincronizar os volumes com o lockfile. Após mudar dependências, reconstruir/reiniciar o serviço. Para adicionar pacotes, usar npm dentro do container, com `--workspace @sidequest/web`, atualizando o lockfile da raiz.
- Atalhos npm da raiz: `dev:web`, `lint:web`, `typecheck:web`, `build:web` e `start:web`. `typecheck:web` e `build:web` compilam os contratos antes do frontend.
- `lib/contracts.ts` verifica a importação de `PartySnapshot` de `@sidequest/contracts`, sem dados ou chamadas à API. O frontend possui tsconfig próprio com resolução `bundler`, sem herdar a compilação NodeNext do backend.
- `compose.dev.yaml` é independente do Compose de publicação da API. Nenhum serviço de API ou provedor MCP é necessário para conferir esta página.
- Na validação inicial, `npm audit --omit=dev` não apontou vulnerabilidades. O audit completo apontou cinco alertas de severidade alta na cadeia de desenvolvimento `eslint-config-next → fast-glob → micromatch → braces`, sem correção compatível oferecida pelo npm. Reavaliar nas atualizações; não aplicar `npm audit fix --force` com downgrade do Next para resolver esses avisos.

Consulte as fontes existentes antes de implementar:

- [README do projeto](../../README.md): produto, jornada e escopo do MVP.
- [Tarefas iniciais](../../docs/tarefas-iniciais.md): entregáveis e divisão do trabalho.
- [Desenvolvimento](../../docs/desenvolvimento.md): integração e decisões do Sprint 0.
- [Pesquisa de impacto](../../docs/pesquisa-impacto.md): limites das promessas do produto.
- [Contratos compartilhados](../../packages/contracts/src/index.ts), [OpenAPI](../api/openapi.yaml) e [fixture da Party](../../fixtures/party.json): referências para dados e integração.

## Stack e organização

- Usar Next.js com App Router, TypeScript estrito, Tailwind CSS e shadcn/ui.
- Usar npm workspaces e o `package-lock.json` da raiz. Não criar lockfile independente no frontend.
- Organizar o projeto diretamente em `apps/web`, sem uma camada `src` adicional:

```text
app/                  Rotas, páginas e layouts
components/ui/        Componentes básicos compartilhados, incluindo shadcn
components/party/     Componentes específicos da experiência
lib/                  Acesso a dados, mocks e utilitários
```

- Criar pastas e abstrações conforme a necessidade real; evitar camadas antecipadas.
- Usar arquivos em kebab-case, componentes em PascalCase e funções/hooks em camelCase. Respeitar os nomes especiais exigidos pelo Next.js, como `page.tsx` e `layout.tsx`.
- Escrever código e identificadores em inglês; textos da interface e documentação em português.
- Manter páginas pequenas, compondo os elementos da interface. Extrair componentes quando houver responsabilidade própria ou reutilização.
- Localizar a fronteira de componentes cliente nas partes que exigem interação, estado ou APIs do navegador.

## Componentes compartilhados

- Adicionar cada componente shadcn uma única vez em `components/ui`, personalizá-lo ali e importar esse componente nas telas. Não copiar sua implementação a cada uso.
- O componente local recebido do shadcn já é o componente do projeto. Não criar um wrapper apenas para repassar propriedades.
- Por exemplo, manter um único `Button` em `components/ui/button.tsx`, utilizado para criar Party, entrar na sala e confirmar ações.
- Centralizar variações recorrentes em propriedades como `variant` e `size`. Usar classes locais para necessidades de layout, evitando repetir estilos visuais que deveriam pertencer ao componente compartilhado.
- Compor os componentes de `components/party` com essas peças básicas. Criar wrappers somente quando acrescentarem comportamento ou composição próprios.
- Antes de criar um componente, verificar se existe um equivalente que possa ser reutilizado ou estendido.

## Design e acessibilidade

- Desenvolver mobile first e adaptar a composição para desktop.
- Preservar semântica, navegação por teclado, foco visível, rótulos acessíveis e interação por toque.
- Júlio entrega telas e regras pelo Figma. Consultar o material correspondente pelo MCP do Figma antes de implementar seu visual e seus comportamentos.
- Adaptar os componentes do shadcn ao design entregue. Centralizar cores, tipografia e espaçamentos em tokens de tema.
- Enquanto o design não estiver disponível, desenvolver navegação, dados e comportamentos com apresentação provisória. Não tratar escolhas visuais provisórias como decisões finais do Júlio.

## Animações

- Usar CSS/Tailwind para transições simples, como foco, hover e mudanças de cor.
- Usar GSAP apenas pontualmente, nos locais e comportamentos indicados pelo Otávio. Instalar `gsap` e `@gsap/react` quando surgir a primeira necessidade concreta.
- Manter as animações no componente responsável, com `useGSAP`, escopo local e limpeza ao desmontar ou atualizar.
- Respeitar `prefers-reduced-motion` e manter a interface funcional sem animação.
- Não fazer o avanço da Party ou a conclusão de uma ação depender do término de uma animação.

## Dados, mocks e integração

- Começar com mocks tipados baseados em `fixtures/party.json`, acessados por funções em `lib`. Páginas e componentes não importam fixtures diretamente.
- A fixture existente representa uma Party em `COLLECTING_ANSWERS`, com participantes em diferentes estados de resposta e conexão MCP. Cenários complementares de frontend devem continuar compatíveis com os contratos e ser identificados como simulados.
- Consumir os tipos de `@sidequest/contracts`, como `PartySnapshot`, sem duplicar os contratos do backend.
- Usar estado simples do React inicialmente. Adicionar outra biblioteca de estado somente quando uma necessidade concreta justificar.
- Manter o acesso a dados separado da apresentação, permitindo substituir mocks por chamadas à API do Matheus pelo navegador sem reescrever as telas.
- Regras de negócio e integração MCP pertencem ao backend. O frontend representa os estados, coleta ações individuais e apresenta os resultados.
- Identificar dados simulados na demo. Um fallback local deve ser explícito; não apresentar uma operação real que falhou como sucesso simulado.
- Na integração, respeitar os estados `OPEN`, `COLLECTING_ANSWERS` e `READY_FOR_THEME` e os erros definidos pela API. Somente o anfitrião fecha o grupo; a conclusão coletiva provoca a transição automática conforme as regras do backend. Não usar o antigo fluxo de `/advance`.
- Guardar o `participantToken` recebido ao criar ou entrar em `sessionStorage` e enviá-lo como Bearer somente nas rotas privadas. Não colocar tokens na URL, no estado compartilhado, em fixtures ou logs.
- Enviar o questionário pelo envelope `SubmitAnswersRequest`, com `questionnaireVersion`, `answers` e `completed`, sem fixar suas perguntas no cliente de API.
- Consultar a Party a cada 1–2 segundos, interromper o polling ao desmontar e tratar `404` como Party indisponível. Não há WebSocket neste recorte.
- Coordenar a origem do frontend com o CORS da API, que atualmente aceita `http://localhost:5173` por padrão.
- Exibir apenas o estado da conexão MCP. O backend já possui OAuth por participante com PKCE e provedor de demonstração; o provedor real e o refresh continuam pendentes. Segredos pertencem ao backend, conforme `docs/ifood-mcp.md` e `docs/desenvolvimento.md`.

## Responsabilidades e padrão de trabalho

- Otávio mantém `apps/web`; Júlio define design, fluxo e textos; Matheus mantém API e contratos; Maeda mantém a integração MCP e a resolução dos kits.
- Alinhar mudanças nos contratos com Matheus e coordenar ajustes necessários na configuração raiz. Não alterar `apps/api/src/party/**` como parte do trabalho de frontend.
- Inspecionar o estado local antes de editar e preservar alterações existentes.
- Implementar incrementos pequenos e demonstráveis. Adicionar dependências apenas para necessidades concretas.
- Seguir Conventional Commits no formato `tipo(escopo): descrição`, com escopo opcional e descrição curta e objetiva. Usar `feat` para funcionalidades, `fix` para correções, `docs` para documentação, `refactor` para reorganização sem mudança de comportamento, `test` para testes e `chore` para manutenção. Exemplo: `docs(web): document frontend development guidelines`.
- Manter cada commit focado em uma mudança coerente e revisar os arquivos staged antes de commitar. Não incluir alterações alheias à tarefa.
- Prever carregamento, ausência de dados, erros e bloqueios relevantes para cada tela.
- Respeitar o controle individual das respostas e da conexão MCP. Tratar `READY_FOR_THEME` como o fim do recorte atual, sem antecipar regras de tema, compra ou jogo ainda não definidas.
- Atualizar estas diretrizes quando uma decisão mudar. Distinguir sempre o que está planejado do que já foi implementado.

## Verificação

- Após a implementação de funcionalidades, verificar tipos, lint e build com os comandos configurados acima. O build da API sozinho não valida o frontend. Não executar o build de produção sobre o mesmo volume `.next` enquanto o servidor de desenvolvimento estiver rodando.
- Conferir a jornada em viewport móvel e desktop, incluindo teclado, foco e estados dos componentes.
- Verificar a reutilização dos componentes: uma alteração no estilo base deve refletir nos usos correspondentes, respeitando suas variantes.
- Testar os comportamentos críticos conforme forem implementados: criação e entrada por código, sessão individual, fechamento exclusivo pelo anfitrião, envio do questionário e atualização coletiva até `READY_FOR_THEME`.
- Verificar cenários de carregamento, erro, falta de dados e identificação do modo simulado. Para animações, conferir limpeza e movimento reduzido.
- Ao revisar este documento, conferir sua compatibilidade com os contratos e a documentação do monorepo. Uma mudança apenas documental não exige inicializar o frontend ou instalar dependências.
