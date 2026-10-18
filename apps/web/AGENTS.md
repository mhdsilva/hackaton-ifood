# Diretrizes de desenvolvimento do frontend

Estas diretrizes se aplicam a `apps/web/**`, área de responsabilidade do Otávio no iFood Party (anteriormente SideQuest Party). O objetivo é entregar uma jornada demonstrável, com estrutura simples e adequada ao hackathon.

## Regra sobre textos

**Não altere nenhum texto visível da interface (`apps/web/**`) sem autorização explícita do Lucas Maeda.** Isso inclui títulos, rótulos, botões, mensagens, placeholders, erros e `aria-label`. Se uma mudança exigir texto novo ou diferente, proponha o texto e espere aprovação. Detalhes em `../../AGENTS.md`.

## Contexto e estado atual

“Voltar ao início” na retrospectiva remove somente a sessão da Party do `sessionStorage` no modo real e recarrega `/`, descartando respostas, carrinho e caches locais para criar uma nova Party. No mock, recarrega `/` para reiniciar a prévia. A Party anterior continua disponível para os demais participantes.

Os itens do resumo de pedido usam a mesma composição nos modos mock e real, com altura de 60 px. Sem complemento, o título fica centralizado verticalmente; o preço fica sempre centralizado verticalmente, com ou sem complemento. A Focaccia do mock não tem complemento para demonstrar esse estado.

Na retrospectiva, o número da distância e o título alternativo do card vermelho usam 40 px. A seção “Esse encontro tem nome”, com o nome da Party e a frase abaixo, foi removida da tela.

O título da retrospectiva também usa 40 px; “Cada um num canto.” e “Todo mundo junto.” ocupam uma linha cada, sem quebra interna. A badge “Prévia” do cabeçalho e a nota abaixo das estatísticas sobre distância/endereços/dados simulados foram removidas por solicitação do usuário.

O resumo em `/party/order` exibe novamente o card “Método de Pagamento” após o endereço, reutilizando `OrderDetailCard` e `order-wallet.svg`, com “Pix” fixo e sem ação de trocar método, nos modos mock e conectado, conforme solicitado. Esta apresentação não altera a integração de checkout.

Títulos da sacola (`/party/unboxing`), resumo (`/party/order`) e confirmação (`/party/confirmed`) usam 40 px. A confirmação concluída mostra “Seu pedido foi realizado!”; no modo conectado, o texto de confirmação só é exibido após `order_submitted`/`delivered`, preservando a etapa de consentimento quando o carrinho ainda está preparado.

Na revelação (`/party/reveal`), o frame `20:1655` foi conferido novamente pelo MCP do Figma. O título usa 64 px, alinhado à esquerda, e a imagem tem altura-base de 240 px. O conteúdo começa 20 px abaixo do header e usa gaps de 32 px, com participantes de 42 px também alinhados à esquerda, legenda “conectados” e footer de 24 px acima/abaixo da ação. O mock usa “Noite Italiana”; o modo conectado mantém o título livre da API. A foto local é idêntica ao asset do frame (SHA-256 conferido), e o header inverso usa o logo branco original em `reveal-logo-white.svg`, com as dimensões originais preservadas. Em viewports compactas, a imagem pode encolher para preservar o encaixe sem rolagem; não voltar ao título proporcional à viewport nem à imagem que ocupa todo o espaço restante.

O lobby exibe `AuthenticationBanner` vermelho logo abaixo do convite enquanto o participante atual não está `connected`. “Fazer Login” chama o OAuth existente (`connectMcp`, navegação da própria aba); retorno/restauração e polling atualizam a badge e removem o banner. `validating` e abertura de login desabilitam a ação; `error` permite tentar novamente. Badges da lista representam autenticação (autenticado em fundo claro/texto vermelho; demais em cinza), e o nome do host recebe “(Host)” para todos. Após o ajuste de contraste solicitado pelo Otávio, o avatar da pessoa da sessão usa **fundo vermelho e letra branca**, independente de ser host; os demais usam fundo branco e letra vermelha. A etapa de espera continua usando badges de conclusão do questionário.

`getLobbyState` centraliza o rodapé: convidado sempre aguarda o nome do host; host aguarda autenticação até ele e os convidados estarem conectados, e então libera “Iniciar party” (com pelo menos duas pessoas). `startParty` retorna booleano assíncrono no adapter; só navega quando a API aceita, mantendo o lobby em falhas. No mock, o host começa autenticado e o convidado não; `/?code=PREVIA` demonstra login local de 800 ms sem API, identificado como prévia. `/?preview=authenticated` demonstra todos autenticados e permite iniciar. A vitrine oferece esses cenários. Nenhum parâmetro de prévia altera o modo real nem representa autenticação real.

`QuestionNavigationProvider` trata separadamente as promessas `ready` e `finished` da View Transition API: `skipTransition()` pode rejeitar `ready` com `AbortError` e resolver `finished`. Cancelamento por timeout/nova navegação/desmontagem é esperado e não deve abrir o overlay de erro do Next; manter os handlers locais, sem ocultar rejeições globais.

Preparação, contagem, revelação e sacola usam `PartyShell fitViewport`: altura `100dvh`, main com `min-height: 0` e container queries para ajustar título, órbita, número e foto à área restante. As telas ficam sem rolagem; o shell padrão dos formulários e do resumo continua rolável. A órbita mantém a animação contínua e o SVG escala com ela, sem reiniciar. A sacola agora entra por baixo em 600 ms, fica 1 segundo no centro e sai por cima em 600 ms, com `power3`, cleanup e movimento reduzido; o avanço continua por timer independente de 2,4 segundos. `/party/confirmed` permanece, com botão “Ver retrospectiva” para `/party/retrospective`; na retrospectiva o botão abaixo de compartilhar é “Acompanhar pedido” e abre `https://www.ifood.com.br/` como destino genérico temporário.

Endereços conectados agora usam `ParticipantAddress.details`, adição opcional ao contrato/OpenAPI: rua/número, complemento, bairro/cidade/UF, CEP, referência e endereço formatado, quando fornecidos pelo iFood. A integração privada da API preserva esses campos para o próprio participante; `sanitizeAddress` do planner permanece sem endereço completo, e o snapshot coletivo não muda. `fromParticipantAddress` e `addressDetailLines` centralizam a apresentação da seleção e do resumo; respostas antigas sem detalhes continuam aceitas. `selectedPartyAddress` prioriza o id selecionado quando existem aliases repetidos. Não inventar endereço, entrega ou pagamento ausentes no retorno real. A implementação exige publicar API e frontend atualizados para aparecerem os detalhes reais.

O compartilhamento da retrospectiva agora gera uma arte própria em PNG de 1080×1920 no navegador, com `lib/retrospective-share-image.ts`, usando as fontes locais, logo e dados finais agregados. O botão “Compartilhar esse momento” abre `RetrospectiveShareDialog`, com prévia, geração/erro/retry e download. Em aparelhos com `navigator.canShare({ files })`, “Compartilhar imagem” abre o menu nativo para WhatsApp ou outros destinos escolhidos pela pessoa; a imagem é preparada antes do clique para preservar a ativação exigida pela Web Share API. Sem suporte a arquivos, o botão baixa o PNG. Cancelar a folha nativa não dispara download nem mostra erro. Falhas oferecem salvar manualmente. URLs de blob são revogadas ao fechar/desmontar; o resumo é congelado ao abrir a prévia. Sem upload, backend, contatos, tokens ou endereços; mocks exportados mantêm “DADOS SIMULADOS”. `components/ui/dialog.tsx` centraliza modal acessível com Radix já instalado, sem dependências novas. A cópia de texto foi removida.

Retrospectiva autoral disponível em `/party/retrospective`, sem desenho do Figma, autorizada pelo Otávio. Usa `PartyRetrospectiveResponse` e `PartyRetrospectiveSummary` de `@sidequest/contracts`. No modo real e sem `?preview=`, a tela chama `GET /parties/:id/retrospective` de verdade (via `loadRetrospective` do provider), com polling leve de 3 s enquanto o estado for `waiting_for_deliveries`; o backend considera "pronto" quando cada participante já escolheu/preparou o pedido (carrinho criado a partir da opção do agente/MCP), **sem** exigir que o pedido tenha sido submetido ou entregue. Com `?preview=waiting|no-distance|empty` (ou no modo mock), a tela usa `lib/mock-retrospective.ts`, sinalizada na interface como "PRÉVIA"/"Dados simulados para esta prévia". O cenário simulado usa nome/participantes da sessão, tema (italiano como fallback do mock), pedidos concluídos, itens, restaurantes e distância ilustrativa de 312,6 km. A distância é sempre apresentada como a maior entre dois endereços, aproximada em linha reta; nenhum endereço individual é exibido ou copiado. Não inventar duração, avaliações, gastos ou coordenadas ausentes do contrato. O modo demo real pode omitir a distância.

O design usa Fira Sans Condensed, vermelho, fundo e avatares existentes, um destaque de distância com traço conectando os participantes e `RetrospectiveStats`. GSAP anima entrada e contadores após a splash, com cleanup e respeito a movimento reduzido. “Compartilhar esse momento” abre uma arte em PNG com os dados agregados para compartilhar ou baixar; a versão anterior de cópia de texto foi substituída. A vitrine oferece os cenários `?preview=waiting` (aguarda entregas), `?preview=no-distance` (sem distância) e `?preview=empty` (sem resumo), sempre com dados simulados, independente do modo. O estado de espera não mostra resultados nem conclusão antecipada.

“Confirmar e pagar” no resumo abre `/party/confirmed` **no modo mock** (confirmação visual baseada no frame `36:6354`): título “Seu pedido foi realizado!”, sacola estática original, grupo de participantes e botão fixo “Ver retrospectiva”. `PartyShell` aceita um backdrop decorativo e mantém conteúdo centralizado e rolável sem encobrir a ação. A vitrine tem link direto para testar. A confirmação abre a retrospectiva; o acompanhamento externo genérico fica nela. Não há submissão de pedido nem cobrança; no modo real, o botão leva a `/party/pending/checkout` até o carrinho estar integrado.

O fluxo visual agora segue preparação → `/party/countdown` → `/party/reveal` (tema, frame `20:1655`) → botão “Descobrir meu pedido” → `/party/unboxing` (sacola, frame `36:5790`) → `/party/order` (resumo, frame `36:5852`). Foto italiana, sacola e ícones do resumo são os assets originais baixados do Figma em `public/figma`; a revelação escolhe imagens WebP locais conforme o título e as buscas do agente (`party.theme` e `party.themeQueries`), incluindo café da manhã, categorias culinárias e um fallback ilustrado para temas sem correspondência. Elementos de status do sistema operacional continuam excluídos. O título livre e a justificativa do agente (`party.theme` e `party.themeReason`) são apresentados por `lib/reveal-theme.ts`. O pedido em `/party/order` deixou de ser um menu local: no modo real, `resolveOrderOptions` (`live-party-provider.tsx`) chama `POST /parties/:id/options` com o token do participante, e a API usa o agente/MCP com o tema da Party e o orçamento, as restrições e o endereço das respostas dele. A tela mostra carregamento, erro com “Conectar iFood”/“Tentar de novo” e as opções reais (até três; “Gerar outra opção” alterna entre elas); sem conexão MCP ou sem loja que caiba no orçamento, ela não inventa um pedido. O modo mock continua com o cenário fixo de `lib/mock-reveal.ts`. “Trocar método” leva ao placeholder. As telas de preparação, contagem, tema, sacola e confirmação usam os participantes reais do snapshot.

Na sacola, GSAP/`useGSAP` anima a entrada de baixo (600 ms), pausa no centro (1 s) e saída para cima (600 ms). A animação começa após a splash, respeita movimento reduzido e limpa os efeitos ao desmontar. Um timer independente de 2,4 segundos abre o resumo; a navegação não depende da animação. `PartyShell` ganhou tom vermelho e configuração de marca/conteúdo/footer; `PartyHeader` pode mostrar a marca toda branca. `PreparationParticipants` adapta a cor do anfitrião sobre vermelho; `Button` tem variante `inverse`. O resumo compõe `OrderDetailCard` e os componentes compartilhados; links e exemplo de card constam da vitrine.

A preparação agora termina em `/party/countdown`, uma única tela baseada nos frames `20:5019`, `20:5547` e `20:5581`: “AS ESCOLHAS SE ENCONTRARAM”, “Todo mundo pronto?”, número grande em Fira Sans Condensed SemiBold 280 px e os participantes reais centralizados. Reutiliza `BrandBackdrop`, `PartyHeader` (marca com “Party” branco) e `PreparationParticipants`, também usado pela preparação, pelo tema e pela sacola. A contagem mostra 3 → 2 → 1, um segundo por número, e então abre `/party/reveal`. Espera a splash, cancela o timer ao desmontar e não faz chamadas nem representa conclusão de operações reais. `FlipDigit` usa duas metades recortadas e rotação 3D em 480 ms, inspirado no padrão comunitário split-flap pesquisado em `sLeeNguyen/react-flip-clock-countdown` e `pqina/flip`, sem copiar código nem adicionar dependências. Com movimento reduzido, os números trocam imediatamente e os tempos são preservados. A vitrine permite repetir a dobra manualmente e abrir a contagem completa.

Na integração dos avanços remotos de endereço e sincronização, o modo real mantém os novos campos de carregamento/erro e o cadastro de endereço. O adapter mock fornece seus próprios estados de endereço sem API; `new-address` continua placeholder nesse modo. A navegação animada do questionário é preservada nos dois modos.

O commit `8984bc4` conectou as telas ao `LivePartyProvider`, preservando o mock, mas sem flag. Agora `PartyProvider` seleciona o modo por `NEXT_PUBLIC_PARTY_MODE`: `mock` usa o provider e os catálogos locais, sem chamadas à API nas rotas da Party; qualquer outro valor usa a integração real. O Compose de desenvolvimento define `mock` por padrão. Para testar a integração, definir `$env:NEXT_PUBLIC_PARTY_MODE = "live"` no PowerShell e recriar o serviço com `docker compose -f compose.dev.yaml up -d web`; para voltar ao mock, definir `mock` e recriar. Em produção, a ausência da variável preserva o modo real. A rota `/test` continua exclusiva para integração real, independentemente da flag.

No modo mock, a raiz abre diretamente o lobby do Júlio; `/?code=CODIGO` abre a prévia do convidado Lucas. O lobby identifica os dados simulados e oferece uma simulação local de login, sem OAuth real. O botão de revelar continua liberado na espera para conferir a preparação sem outros dispositivos. No modo real, já há criação/entrada por formulário, restauração do token em `sessionStorage`, polling de 1,5 segundo, fechamento, catálogo do questionário, envio final, conexão OAuth e revelação pela API. Endereços e preparação ainda usam modelos locais. As descrições anteriores de fluxo somente mockado abaixo registram a construção visual e não descrevem mais o modo real por completo.

O frontend usa Next.js com App Router, React, TypeScript estrito, Tailwind CSS e shadcn/ui. A rota `/` demonstra a sala do anfitrião; `/party/address` permite escolher um endereço simulado. Ambas seguem as telas `5:2119` e `5:2260` do [Figma do Júlio](https://www.figma.com/design/cBjRXT5phkb6jAIVlbmtGo/Ifood-Party), com tema escuro, vermelho iFood, DM Sans e Inter locais e SVGs em `public/figma`. Elementos do sistema operacional desenhados no protótipo (horário, bateria e indicador inferior) não fazem parte da interface web. No desktop, o conteúdo fica centralizado com largura limitada; não existe design desktop entregue para estas telas.

A navegação roda contra a API real pelo `LivePartyProvider` (`components/party/live-party-provider.tsx`); o `MockPartyProvider` continua no repositório como referência, sem uso. Iniciar com pelo menos duas pessoas leva ao endereço, depois às restrições (`/party/restrictions`) e ao orçamento (`/party/budget`). As novas telas seguem os nós `5:2317` e `5:2358` do Figma. Perguntas começam sem respostas ou opções marcadas; a única exceção é o endereço, que inicia com a primeira opção selecionada. Respostas escolhidas pelo usuário são preservadas ao voltar. Restrições permitem múltiplas escolhas ou nenhuma; selecionar “Outro” abre um detalhe obrigatório. Orçamento exige uma escolha para continuar; “Outro valor” abre um `CurrencyInput` com prefixo fixo “Até R$”, separador de milhar e duas casas decimais no padrão brasileiro. A digitação preenche os centavos; o estado guarda reais em formato decimal, e somente valores positivos habilitam continuar. O valor digitado também precisa caber no `budget.customInput` da API (hoje 1–999): fora da faixa, o botão fica bloqueado e a tela mostra a faixa aceita, em vez de deixar o envio falhar com `custom_value_required`. O campo de restrição “Outro” continua provisório.

A primeira visita também mostra uma splash de aproximadamente 2,7 segundos sobre a rota atual. O logo branco começa centralizado sozinho. Um recorte circular de 0,6 segundo com `power3.inOut` revela o fundo escuro sem escalar sua arte, enquanto o logo muda para vermelho e se desloca à esquerda; “Party” aparece deslizando para a direita. A arte de fundo reutiliza o SVG do logo como máscara estática. Nos últimos 0,5 segundo, a splash desliza para a esquerda e libera a tela. A animação usa GSAP com `@gsap/react`, respeita `prefers-reduced-motion` e desaparece antes de liberar a interação com a tela. Não há persistência entre recargas.

O `PartyShell` ocupa a altura dinâmica da viewport, mantendo header e footer fora da área rolável. O conteúdo central rola sem encobrir o botão; a borda superior do footer e a borda inferior dos headers com voltar ocupam toda a largura da tela. Conteúdo e ações permanecem limitados a `max-w-md` no desktop. O footer não mostra mais a indicação de prévia nem o link da vitrine, que continua acessível em `/dev/components`. O card do lobby usa fundo cinza, título branco e chamada vermelha, com área de convite escura, conforme as referências enviadas por Otávio.

O layout declara `viewport-fit=cover` e `theme-color` escuro como padrão. Durante a splash animada, os fundos de `html`, `body` e da splash e o meta `theme-color` começam vermelhos e mudam juntos para escuro ao concluir o recorte circular (0,85 segundo). As cores vêm dos tokens do tema; a limpeza restaura os estilos e o meta anteriores. Com movimento reduzido, o fundo permanece escuro e a splash é dispensada. Confirmar o resultado das barras nativas no iPhone; a prévia desktop não reproduz essa interface do navegador.

O mock usa o contrato `PartySnapshot`, adaptado da fixture compartilhada. No modo real, `EntryGate` (`live-party-provider.tsx`) não pede nada a ninguém: sem sessão e sem `?code`, ela chama `createParty` automaticamente com o nome batizado pelo dia da semana (`partyNameForToday`: "Sextou à distância", "Domingou à distância"...) e cai no lobby para copiar o link; com `?code=CODIGO`, entra por convite direto. **Nome da Party e nome da pessoa não são pedidos**: até o OAuth do iFood, a pessoa aparece como "Anfitrião"/"Convidado N" e depois o backend troca pelo `fullName` do `getUser`. A sessão fica em `sessionStorage` e é restaurada ao recarregar. `EntryGate` lê o parâmetro no cliente, dentro de `Suspense`, para manter compatibilidade com exportação estática. O código de convite é validado pela API — não autentica sozinho — e o status dos outros participantes chega pelo polling.

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
