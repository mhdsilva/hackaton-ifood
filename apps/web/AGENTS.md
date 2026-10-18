# Diretrizes de desenvolvimento do frontend

Estas diretrizes se aplicam a `apps/web/**`, área de responsabilidade do Otávio no iFood Party (anteriormente SideQuest Party). O objetivo é entregar uma jornada demonstrável, com estrutura simples e adequada ao hackathon.

## Contexto e estado atual

“Confirmar e pagar” no resumo agora abre `/party/confirmed`, confirmação visual mockada baseada no frame `36:6354`: título “Pedido realizado, aproveite com seus amigos!”, sacola estática original, grupo de participantes e botão fixo “Acompanhar entrega”. `PartyShell` aceita um backdrop decorativo e mantém conteúdo centralizado e rolável sem encobrir a ação. A vitrine tem link direto para testar. O acompanhamento vai a `/party/pending/delivery`, ainda sem rastreio. Não há submissão de pedido nem cobrança; na integração real, esta tela só deve ser alcançada depois de a API confirmar o pedido.

O fluxo visual agora segue preparação → `/party/countdown` → `/party/reveal` (tema, frame `20:1655`) → botão “Descobrir meu pedido” → `/party/unboxing` (sacola, frame `36:5790`) → `/party/order` (resumo, frame `36:5852`). Foto italiana, sacola e ícones do resumo são os assets originais baixados do Figma em `public/figma`; elementos de status do sistema operacional continuam excluídos. O tema agora vem do agente (`party.theme` e `party.themeReason`) e é apresentado por `lib/reveal-theme.ts`; como só existe a arte italiana (`theme-italian.png`), **todos os temas usam essa imagem por enquanto** — trocar é preencher a arte por tema. O pedido continua um cenário local de `lib/mock-reveal.ts`, incluindo itens de R$38 + R$12 + R$8 e R$6 de taxas, total R$64. Nenhum endpoint de catálogo/carrinho/pedido/pagamento é chamado. “Gerar outra opção” e “Trocar método” levam a placeholders explícitos, sem simular sucesso dessas operações. As telas de preparação, contagem, tema, sacola e confirmação usam os participantes reais do snapshot; o pedido ainda é visual e não representa um pedido real.

Na sacola, GSAP/`useGSAP` anima duas sequências curtas de rotação e deslocamento, separadas por 300 ms, em torno da base. A animação começa após a splash, respeita movimento reduzido e limpa os efeitos ao desmontar. Um timer independente de 2,4 segundos abre o resumo; a navegação não depende da animação. `PartyShell` ganhou tom vermelho e configuração de marca/conteúdo/footer; `PartyHeader` pode mostrar a marca toda branca. `PreparationParticipants` adapta a cor do anfitrião sobre vermelho; `Button` tem variante `inverse`. O resumo compõe `OrderDetailCard` e os componentes compartilhados; links e exemplo de card constam da vitrine.

A preparação agora termina em `/party/countdown`, uma única tela baseada nos frames `20:5019`, `20:5547` e `20:5581`: “AS ESCOLHAS SE ENCONTRARAM”, “Todo mundo pronto?”, número grande em Fira Sans Condensed SemiBold 280 px e os participantes reais centralizados. Reutiliza `BrandBackdrop`, `PartyHeader` (marca com “Party” branco) e `PreparationParticipants`, também usado pela preparação, pelo tema e pela sacola. A contagem mostra 3 → 2 → 1, um segundo por número, e então abre `/party/reveal`. Espera a splash, cancela o timer ao desmontar e não faz chamadas nem representa conclusão de operações reais. `FlipDigit` usa duas metades recortadas e rotação 3D em 480 ms, inspirado no padrão comunitário split-flap pesquisado em `sLeeNguyen/react-flip-clock-countdown` e `pqina/flip`, sem copiar código nem adicionar dependências. Com movimento reduzido, os números trocam imediatamente e os tempos são preservados. A vitrine permite repetir a dobra manualmente e abrir a contagem completa.

Na integração dos avanços remotos de endereço e sincronização, o modo real mantém os novos campos de carregamento/erro e o cadastro de endereço. O adapter mock fornece seus próprios estados de endereço sem API; `new-address` continua placeholder nesse modo. A navegação animada do questionário é preservada nos dois modos.

O commit `8984bc4` conectou as telas ao `LivePartyProvider`, preservando o mock, mas sem flag. Agora `PartyProvider` seleciona o modo por `NEXT_PUBLIC_PARTY_MODE`: `mock` usa o provider e os catálogos locais, sem chamadas à API nas rotas da Party; qualquer outro valor usa a integração real. O Compose de desenvolvimento define `mock` por padrão. Para testar a integração, definir `$env:NEXT_PUBLIC_PARTY_MODE = "live"` no PowerShell e recriar o serviço com `docker compose -f compose.dev.yaml up -d web`; para voltar ao mock, definir `mock` e recriar. Em produção, a ausência da variável preserva o modo real. A rota `/test` continua exclusiva para integração real, independentemente da flag.

No modo mock, a raiz abre diretamente o lobby do Júlio; `/?code=CODIGO` abre a prévia do convidado Lucas. O lobby identifica os dados simulados e oculta a conexão OAuth. O botão de revelar continua liberado na espera para conferir a preparação sem outros dispositivos. No modo real, já há criação/entrada por formulário, restauração do token em `sessionStorage`, polling de 1,5 segundo, fechamento, catálogo do questionário, envio final, conexão OAuth e revelação pela API. Endereços e preparação ainda usam modelos locais. As descrições anteriores de fluxo somente mockado abaixo registram a construção visual e não descrevem mais o modo real por completo.

O frontend usa Next.js com App Router, React, TypeScript estrito, Tailwind CSS e shadcn/ui. A rota `/` demonstra a sala do anfitrião; `/party/address` permite escolher um endereço simulado. Ambas seguem as telas `5:2119` e `5:2260` do [Figma do Júlio](https://www.figma.com/design/cBjRXT5phkb6jAIVlbmtGo/Ifood-Party), com tema escuro, vermelho iFood, DM Sans e Inter locais e SVGs em `public/figma`. Elementos do sistema operacional desenhados no protótipo (horário, bateria e indicador inferior) não fazem parte da interface web. No desktop, o conteúdo fica centralizado com largura limitada; não existe design desktop entregue para estas telas.

A navegação roda contra a API real pelo `LivePartyProvider` (`components/party/live-party-provider.tsx`); o `MockPartyProvider` continua no repositório como referência, sem uso. Iniciar com pelo menos duas pessoas leva ao endereço, depois às restrições (`/party/restrictions`) e ao orçamento (`/party/budget`). As novas telas seguem os nós `5:2317` e `5:2358` do Figma. Perguntas começam sem respostas ou opções marcadas; a única exceção é o endereço, que inicia com a primeira opção selecionada. Respostas escolhidas pelo usuário são preservadas ao voltar. Restrições permitem múltiplas escolhas ou nenhuma; selecionar “Outro” abre um detalhe obrigatório. Orçamento exige uma escolha para continuar; “Outro valor” abre um `CurrencyInput` com prefixo fixo “Até R$”, separador de milhar e duas casas decimais no padrão brasileiro. A digitação preenche os centavos; o estado guarda reais em formato decimal, e somente valores positivos habilitam continuar. O campo de restrição “Outro” continua provisório.

A primeira visita também mostra uma splash de aproximadamente 2,7 segundos sobre a rota atual. O logo branco começa centralizado sozinho. Um recorte circular de 0,6 segundo com `power3.inOut` revela o fundo escuro sem escalar sua arte, enquanto o logo muda para vermelho e se desloca à esquerda; “Party” aparece deslizando para a direita. A arte de fundo reutiliza o SVG do logo como máscara estática. Nos últimos 0,5 segundo, a splash desliza para a esquerda e libera a tela. A animação usa GSAP com `@gsap/react`, respeita `prefers-reduced-motion` e desaparece antes de liberar a interação com a tela. Não há persistência entre recargas.

O `PartyShell` ocupa a altura dinâmica da viewport, mantendo header e footer fora da área rolável. O conteúdo central rola sem encobrir o botão; a borda superior do footer e a borda inferior dos headers com voltar ocupam toda a largura da tela. Conteúdo e ações permanecem limitados a `max-w-md` no desktop. O footer não mostra mais a indicação de prévia nem o link da vitrine, que continua acessível em `/dev/components`. O card do lobby usa fundo cinza, título branco e chamada vermelha, com área de convite escura, conforme as referências enviadas por Otávio.

O layout declara `viewport-fit=cover` e `theme-color` escuro como padrão. Durante a splash animada, os fundos de `html`, `body` e da splash e o meta `theme-color` começam vermelhos e mudam juntos para escuro ao concluir o recorte circular (0,85 segundo). As cores vêm dos tokens do tema; a limpeza restaura os estilos e o meta anteriores. Com movimento reduzido, o fundo permanece escuro e a splash é dispensada. Confirmar o resultado das barras nativas no iPhone; a prévia desktop não reproduz essa interface do navegador.

O mock usa o contrato `PartySnapshot`, adaptado da fixture compartilhada. Sem sessão, `/` cria uma Party e `/?code=CODIGO` entra por convite (só o nome da Party, na tela provisória); **o nome da pessoa não é pedido**: até o OAuth do iFood, ela aparece como "Anfitrião"/"Convidado N" e depois o backend troca pelo `fullName` do `getUser`. A sessão fica em `sessionStorage` e é restaurada ao recarregar. `EntryGate` lê o parâmetro no cliente, dentro de `Suspense`, para manter compatibilidade com exportação estática. O código de convite é validado pela API — não autentica sozinho — e o status dos outros participantes chega pelo polling.

O estado das respostas é mantido entre as rotas do grupo `(party)` e reiniciado ao recarregar a página; a identidade (Party + participante + token) vem do `sessionStorage` e sobrevive ao recarregar. Após orçamento, o fluxo segue por energia (`/party/energy`, etapa 4), formato do pedido (`/party/order-style`, 5), desejos (`/party/desires`, 6), exclusões (`/party/avoid`, 7) e espera (`/party/waiting`, 8). Energia e formato exigem uma escolha. Desejos exigem uma ou duas escolhas, com checkboxes quadrados; ao atingir duas, as outras opções ficam indisponíveis até desmarcar uma. “Tanto faz, me surpreenda!” conta como uma opção. Exclusões permitem nenhuma ou várias; “Outro” abre texto obrigatório, seguindo o padrão provisório dos campos condicionais.

A etapa 8 marca como “Pronto” os participantes com `questionnaireResponse.completed` no snapshot; os demais permanecem “Aguardando...”. `ParticipantList` também compõe essa lista com status individuais. “Revelar resultado” só habilita para o anfitrião quando todos concluíram e chama `POST /parties/:id/reveal` antes de abrir `/party/preparing`. O backend escolhe o tema com o agente a partir das respostas de todos; o resultado volta em `party.theme` e, quando houve LLM, `party.themeReason` explica a escolha. Não há timers simulando respostas de outras pessoas: a atualização vem do polling de `GET /parties/:id` a cada 1,5 s e o provider reage ao estado (`lib/party-flow.ts`): quando o anfitrião inicia, quem está no lobby vai para `/party/address`; quando todos concluem, todos vão para `/party/waiting`; quando o tema é revelado, todos vão para `/party/preparing`. As respostas vão para `POST /parties/:id/answers` e o questionário é o de `GET /questionnaire`; a definição fixa de `lib/mock-questionnaire.ts` só aparece se essa busca falhar (`usingLiveCatalog: false`). Os endereços vêm de `GET /parties/:id/addresses` quando a conta do iFood está conectada e caem para a lista de exemplo, sinalizada como simulada, sem conexão. Por autorização explícita de Otávio, a configuração v2 da API foi ajustada para `cravings.required: true`, mantendo `maxSelections: 2`; rascunhos incompletos continuam permitidos.

A preparação (`/party/preparing`) segue o nó `20:3667` e as três referências enviadas por Otávio. Usa os participantes reais do snapshot: as bolas em órbita são uma por participante (2 a 4) e a lista inferior mostra os mesmos nomes; o tema ainda não aparece nesta tela. Usa os três SVGs fornecidos, Fira Sans Condensed Bold local nos títulos e `BrandBackdrop`, que compartilha a arte e os ajustes manuais da splash. Cada etapa dura três segundos, começando após a saída da splash; o timer é cancelado ao desmontar. Após a terceira etapa, abre `/party/countdown`; a contagem 3 → 2 → 1 então leva ao tema em `/party/reveal`. A rota também pode ser aberta diretamente pela vitrine para testar a simulação. Estes tempos não representam processamento real: na integração, estados e falhas da API deverão conduzir a preparação, sem simular sucesso de operações reais.

Destinos sem tela usam `/party/pending/[screen]`: `new-address` e `reveal` (resultado). Os antigos placeholders `invite` e `next-question` permanecem acessíveis, mas não recebem os novos links. O botão de copiar link monta a URL da raiz na origem atual com `?code=` usando `snapshot.party.code`, por meio de `lib/party-invitation.ts`. Na integração, esse código virá da Party retornada pela API; a geração e a validação do código pertencem ao backend. Somente após a cópia ter sucesso o botão troca o ícone de link por check e o texto por “Copiado!” durante dois segundos. Falhas de cópia exibem uma mensagem sem simular sucesso. Criar/entrar, fechar a Party, enviar respostas e revelar o tema já chamam a API; o endereço vem do iFood quando há conexão e a tela `/party/pending/new-address` busca e salva um endereço novo (`POST /addresses/resolve` e `POST /addresses`), com apresentação provisória.

A vitrine `/dev/components` demonstra variantes, tamanhos e estados do único `Button` compartilhado, além de participantes, progresso, endereço, restrições, orçamento, escolhas únicas, desejos limitados, conclusão individual e variantes dos avatares da preparação. O antigo `RadioCard` foi generalizado como `SelectionCard`, compartilhado por endereço, orçamento e preferências, com semântica nativa de radio ou checkbox. `QuestionChoices` compõe os cards e o limite de escolhas. Campos usam `Input` compartilhado. A vitrine é uma ferramenta de desenvolvimento, fora da jornada final do app. Acrescentar componentes conforme forem necessários nas telas e atualizar os exemplos junto com os componentes.

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
- `lib/contracts.ts` reexporta `PartySnapshot` de `@sidequest/contracts`; `lib/mock-party.ts` usa esse contrato para o cenário visual. Não há chamadas à API. O frontend possui tsconfig próprio com resolução `bundler`, sem herdar a compilação NodeNext do backend.
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

- Os avatares ao redor de `PreparationIllustration` são um por participante (2 a 4) e orbitam continuamente, em sentido horário, com uma volta a cada 24 segundos e velocidade linear. As posições são distribuídas por igual no círculo, uma por pessoa, com o centro na borda. A camada orbital permanece montada entre as três etapas; mudanças de texto, SVG e progresso não reiniciam a animação. Os avatares fazem a rotação inversa para manter as iniciais na vertical. O SVG e os círculos centrais permanecem imóveis. A animação CSS inicia ao montar, independente da splash e dos timers, e é desativada com movimento reduzido.

- Os títulos da preparação usam `PreparationTitle` com GSAP e `useGSAP`: palavras do título anterior sobem e desaparecem em 320 ms; as seguintes entram por baixo em 520 ms com `power3.out`, sobreposição de 80 ms e stagger discreto de 18 ms. Máscaras por palavra recortam o movimento. Os títulos compartilham uma célula de grid para reservar a altura do maior texto, sem deslocar a ilustração ou as barras. Somente o texto atual é exposto à tecnologia assistiva; movimento reduzido troca imediatamente. A animação tem limpeza ao atualizar/desmontar e não controla os timers nem o avanço das etapas.

- As barras do questionário e da preparação compartilham `SegmentedProgress`, com preenchimento por `scaleX` e easing. O questionário preenche o segmento atual em 700 ms após 400 ms para acompanhar a troca de conteúdo; a preparação preenche cada segmento durante os três segundos da etapa, começando somente após a splash. Segmentos anteriores permanecem completos. A vitrine permite avançar e repetir as barras.
- `QuestionNavigationProvider` usa a View Transition API, quando disponível, para capturar a troca entre rotas do questionário: texto e formulário saem 20 px à esquerda com fade de 220 ms; os seguintes entram 24 px da direita com fade de 360 ms. Header, footer e progresso não deslizam. A ação e a navegação não aguardam o término da animação; a captura aguarda a montagem da rota e possui cancelamento/limite de 1,5 segundo. Navegadores sem suporte recebem entrada CSS quando suportada; movimento reduzido dispensa o slide e preenche as barras imediatamente. Não exige GSAP nem dependências adicionais.

- Usar CSS/Tailwind para transições simples, como foco, hover e mudanças de cor.
- Usar GSAP apenas pontualmente, nos locais e comportamentos indicados pelo Otávio. A splash global já é o primeiro uso; `gsap` e `@gsap/react` estão instalados no workspace web.
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
- Exibir apenas o estado da conexão MCP. O backend já possui OAuth por participante com PKCE, provedor real do iFood e provedor de demonstração, com refresh de token no servidor. "Conectar iFood" navega a própria aba para a URL de autorização (popup depois de `await` é bloqueado) e o status volta pelo polling. Segredos pertencem ao backend, conforme `docs/ifood-mcp.md` e `docs/desenvolvimento.md`.

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
