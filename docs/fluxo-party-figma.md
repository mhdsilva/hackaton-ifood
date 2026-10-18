# Fluxo da Party — referência do Figma e lacunas

> Atualizado em 17/10/2026 após leitura do export `Ifood Party (1).pdf` (38 páginas). Este
> documento descreve o fluxo desenhado e compara o que ele pede com o frontend, os contratos e a
> API existentes. Os estados visuais de loading e os textos podem mudar; as lacunas técnicas abaixo
> são um retrato do repositório nesta data.

## Resumo do fluxo

O export vai além do questionário: começa no lobby, coleta preferências individuais, revela um tema
para o grupo, recomenda opções locais e termina na revisão individual do pedido.

```text
Lobby e convite
→ conexão da conta iFood (pré-requisito implícito)
→ questionário individual, 8 etapas
→ todos concluem; anfitrião revela o tema comum
→ espera / contagem regressiva / tema revelado
→ cada participante descobre uma opção local para si
→ revisa itens, preço e estimativa; pode editar a própria escolha
→ continua para conferência final e pagamento no iFood
```

Cada participante pede de um endereço e recebe uma opção própria, mas o tema é compartilhado. A
experiência precisa deixar claros dois níveis de estado: a progressão coletiva da Party e o pedido
privado de cada pessoa.

## O que aparece no export

| Parte | Telas e conteúdo | Escopo |
| --- | --- | --- |
| Lobby | Abertura, nome da Party, convite/link, participantes e identificação do anfitrião | Coletivo |
| Endereço | Endereços salvos e ação para adicionar outro | Individual; dado da conta iFood |
| Restrições | Vegetarianismo, veganismo, lactose, glúten, alergia a amendoim e “Outro” | Individual; permite várias escolhas e texto livre |
| Orçamento | Até R$ 25, R$ 50, R$ 75 ou outro valor; inclui estimativa de taxas | Individual |
| Energia | Leve/refrescante, quente/confortável, crocante/descontraída, intensa/marcante ou surpresa | Individual; também pode informar o tema |
| Formato | Refeição completa, experimentar várias coisas, lanche, sobremesa/bebida ou surpresa | Individual |
| Desejos | Até dois entre crocante, cremoso, fresco, bem temperado, picante, agridoce ou surpresa | Individual |
| Exclusões | Fritura, comida crua, muito picante, bebida, sobremesa ou “Outro” | Individual; permite várias escolhas e texto livre |
| Prontidão | Participantes prontos/aguardando; anfitrião revela quando todos responderam | Coletivo |
| Revelação | Espera, contagem 3–2–1, tema comum (exemplo: Noite Italiana) | Coletivo |
| Descoberta | Ação “Descobrir meu pedido” e recomendação local | Individual, ligada ao tema comum |
| Revisão | Resumo de itens e valores, remover item, desfazer, trocar item e recalcular total | Individual; a escolha de outra pessoa não muda |
| Continuação | “Continuar no iFood” para conferência final e pagamento | Handoff individual para iFood |

O PDF traz variantes de telas de endereço, orçamento e lobby, além de estados de espera e revisão.
Os endereços e nomes exibidos são conteúdo de exemplo do protótipo, não dados para copiar para a
aplicação.

## Comparação com o que existe

### Frontend

O frontend atual é uma prévia navegável com dados simulados. Há lobby, endereço, restrições e
orçamento. O questionário ainda não chama a API e o botão após orçamento leva a uma tela placeholder.
As etapas de energia, formato, desejos, exclusões, prontidão, revelação, resultados e pedido ainda
não estão implementadas. A conexão OAuth também não tem interface neste fluxo.

Essa separação está registrada em [`apps/web/AGENTS.md`](../apps/web/AGENTS.md): manter mock até
alinhamento para integrar. Portanto, as rotas e telas abaixo são trabalho do frontend; o protótipo
atual ainda não demonstra o fluxo ponta a ponta.

### API e contratos

| Necessidade do Figma | Situação atual | Lacuna/ação |
| --- | --- | --- |
| Criar Party, entrar, fechar o grupo e consultar participantes | Rotas `/parties`, `/join`, `/close` e `GET /parties/:id` existem | Frontend precisa trocar o mock por chamadas reais e tratar erros/estados |
| Conectar a conta individualmente | OAuth por participante, com modo `demo` e `ifood`, está implementado | Frontend precisa iniciar autorização, voltar do callback e exibir status. Endereço requer conta conectada |
| Questionário com oito etapas, opções e campos “Outro” | `GET /questionnaire` é dinâmico; contrato aceita `maxSelections`, `allowOther`, `otherInput` e `customInput`; `POST /answers` salva respostas incrementais | Definição servida ainda é provisória e o frontend não consome o contrato. Alinhar rótulos/opções ao Figma com Júlio |
| Selecionar endereço salvo/adicionar endereço | Integração MCP sabe listar/criar endereço; não há rota HTTP pública de endereço no OpenAPI | Criar rota(s) autenticada(s) para expor endereços do participante e, se o escopo incluir cadastro no app, criar endereço com confirmação. Tratar zero/múltiplos endereços |
| Esperar todos e revelar tema | `READY_FOR_THEME`, prontidão coletiva e `POST /reveal` existem | Tema atual é `italiano` fixo para demo. Falta o frontend exibir prontidão, espera/contagem e resultado; Júlio define geração/votação |
| Recomendar opções por participante | `POST /options` usa tema, orçamento, restrições e endereço; retorna `live` ou `simulated` | Frontend ainda não chama a rota. Mapear todas as respostas (energia, formato, desejos e exclusões) para a entrada do agente conforme a regra de recomendação for definida |
| Mostrar pedido de cada pessoa sem afetar os demais | `PartySnapshot` informa estágio do pedido, mas não oferece um resumo seguro de opção/carrinho/valor para a Party | Se o Figma deve mostrar resumo dos pedidos dos amigos, adicionar uma projeção pública mínima (ex.: estabelecimento, resumo dos itens, total/estimativa e status), sem endereço completo, token ou identificador interno |
| Remover/trocar item, desfazer e atualizar valores | `POST /cart` prepara um carrinho para uma `LocalOption`; não há operações de alterar/remover/trocar item | Escolher entre editar a seleção local antes de preparar o carrinho ou acrescentar operações de atualização. Para troca real no iFood, validar disponibilidade/preço e reconstruir/recalcular o carrinho |
| Ir ao iFood para conferência e pagamento | `POST /order` submete o pedido com consentimento explícito; tracking pode devolver código Pix | A semântica difere do botão do Figma, que promete handoff para conferência/pagamento. Confirmar com organização/MCP se há checkout/deep link oficial. Se não houver, ajustar texto e consentimento antes de usar `submitOrder` |

Rotas e detalhes estão em [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) e
[`docs/desenvolvimento.md`](desenvolvimento.md). A lista de ferramentas do provedor está em
[`docs/ifood-mcp.md`](ifood-mcp.md) e [`docs/ifood-user-mcp-tools.md`](ifood-user-mcp-tools.md).

## Pontos a resolver antes de integrar

### 1. Endereços e autorização

O design começa pedindo um endereço salvo, mas não mostra conexão de conta. Definir onde a pessoa
conecta o iFood (antes do endereço é o ponto mais coerente), como volta do OAuth e o que vê se negar
ou se a conta não tiver endereço. O fluxo de adicionar endereço precisa de confirmação da pessoa;
não usar os endereços ilustrativos do Figma como fixture de produção.

### 2. Editar antes de criar o carrinho

Hoje `/cart` já conversa com o MCP e prepara um carrinho; `/order` efetivamente envia o pedido. Para
reduzir dependências no primeiro corte, a implementação pode manter a edição da opção em estado
local e chamar `/cart` só depois de a pessoa confirmar a revisão. Isso só funciona se o backend
conseguir materializar a opção editada e recalcular preços. Se a opção enviada ao carrinho tiver de
ser exatamente a retornada por `/options`, será necessário um contrato para alterações e nova
validação de preço/disponibilidade.

### 3. Resumo coletivo e privacidade

O Figma diferencia o pedido próprio dos pedidos dos outros. A tela não deve precisar ler tokens,
endereços ou respostas individuais dos outros participantes para mostrar um panorama. O snapshot
atual não contém item, restaurante, valor ou previsão compartilháveis; adicionar só os campos
necessários e definir se são estimativas ou valores confirmados pelo carrinho.

### 4. O que significa “Continuar no iFood”

Esse é o principal descompasso de produto/API. `submitOrder` envia o pedido ao iFood mediante
consentimento; o Figma descreve uma navegação para a pessoa conferir e pagar no iFood. Não tratar
esses comportamentos como equivalentes. Confirmar o recurso disponível no MCP e então alinhar botão,
texto, consentimento e contrato. O backend atual também suporta modo simulado; a interface deve
indicar quando a recomendação ou pedido for simulado.

## Sequência sugerida para implementar

1. Manter o fluxo visual atual e implementar as telas que faltam do questionário a partir da
definição dinâmica, incluindo progresso, validação e persistência incremental.
2. Fechar a fronteira de OAuth e endereços: tela/retorno da autorização e endpoints de listagem e
cadastro necessários para servir o design.
3. Implementar prontidão, revelação do tema e transição de espera; o tema continua sujeito à decisão
de Júlio.
4. Integrar descoberta individual e estado de carregamento/erro, mostrando `source: simulated`.
5. Definir a projeção coletiva dos pedidos e o comportamento de edição antes de integrar `/cart`.
6. Alinhar o CTA final com o comportamento oficial de checkout e só então ligar a submissão real.

O objetivo desta ordem é deixar o fluxo demonstrável por incrementos e explicitar os pontos que
precisam de contrato ou decisão antes de depender deles; não é uma decisão de escopo final.

## Referências

- Export do Figma: `Ifood Party (1).pdf`, 38 páginas.
- [OpenAPI](../apps/api/openapi.yaml)
- [Desenvolvimento e integração](desenvolvimento.md)
- [Autenticação iFood MCP](ifood-mcp.md)
- [Ferramentas do iFood User MCP](ifood-user-mcp-tools.md)
- [Orientações do frontend](../apps/web/AGENTS.md)
