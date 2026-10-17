# Pesquisa de impacto — SideQuest

> Versão pesquisada em 17 de outubro de 2026. Este documento avalia a tese de impacto do conceito atual: uma Party que usa o iFood para sincronizar experiências entre amigos em endereços diferentes.

## Resumo executivo

A tese mais defensável não é “combater a solidão com delivery”. O produto não tem evidência clínica, não cria companhia e não deve prometer melhora de saúde mental.

A tese recomendada é:

> **Amigos distantes já dividem a tela. O SideQuest sincroniza o que chega à casa de cada um para que eles também dividam a experiência.**

Cada participante entra em uma Party, responde a um questionário e conecta sua própria conta do iFood. O agente cria uma missão comum e resolve localmente produtos que cumprem papéis equivalentes, respeitando endereço, orçamento e restrições individuais. Depois coordena as entregas e inicia a experiência quando todos estiverem prontos.

Há cinco blocos de evidência que sustentam essa narrativa, com forças diferentes:

1. **Conexão social é uma necessidade relevante:** a OMS estima que uma em cada seis pessoas no mundo vivencia solidão; as maiores prevalências aparecem entre adolescentes e jovens adultos. Isso justifica a relevância do tema, mas não prova que o SideQuest o resolva.
2. **Comer junto é um comportamento associado a bem-estar:** dados do Gallup World Poll em 142 países e territórios mostram associação robusta entre mais refeições compartilhadas e maior bem-estar subjetivo. A própria pesquisa ressalta que ainda há lacunas causais.
3. **Atividades novas e compartilhadas podem melhorar a experiência de casais:** três experimentos de laboratório encontraram aumento imediato na qualidade percebida da relação após uma tarefa nova e estimulante, comparada a uma tarefa rotineira. É evidência causal, mas antiga, de curta duração e restrita a casais.
4. **Estar junto não garante atenção compartilhada:** um experimento de campo randomizado com 304 pessoas encontrou mais distração e menor aproveitamento da refeição quando celulares permaneciam disponíveis. Esse achado sustenta uma decisão de interface em que o agente prepara a atividade e depois reduz sua presença na tela.
5. **Comer junto a distância é uma prática estudada:** uma revisão de 104 publicações descreve refeições remotas como forma de amigos, casais e famílias manterem contato. A literatura ainda é jovem e não autoriza claims clínicos.

O caso de negócio tem escala plausível: o relatório institucional 2023–2025 do iFood informa cerca de **55 milhões de usuários ativos, mais de 400 mil estabelecimentos e 120 milhões de pedidos mensais**. Isso mostra uma infraestrutura existente capaz de materializar experiências. Não demonstra demanda pelo SideQuest.

### Conclusão para o hackathon

O impacto deve ser apresentado como **a criação de uma nova ocasião de uso: experiências físicas sincronizadas entre pessoas distantes**, e medido no próprio produto. Solidão e bem-estar entram como contexto, com linguagem cuidadosa. A promessa concreta é transformar uma chamada já planejada em uma experiência comum, apesar das diferenças de endereço e catálogo.

---

## 1. Dados fortes

### 1.1 Conexão social é um tema relevante, sobretudo entre jovens

O relatório de 2025 da Comissão da OMS sobre Conexão Social estima que:

- cerca de **1 em cada 6 pessoas** no mundo vivencia solidão;
- a prevalência estimada é de **20,9% entre pessoas de 13 a 17 anos**;
- a prevalência estimada é de **17,4% entre pessoas de 18 a 29 anos**;
- a estimativa para a Região das Américas é de **13,6%**, com intervalos de incerteza relevantes.

Fonte primária: [OMS — *From loneliness to social connection: charting a path to healthier societies* (2025)](https://iris.who.int/bitstream/handle/10665/381746/9789240112360-eng.pdf).

**O que o dado permite dizer:** desconexão social e solidão são problemas difundidos, inclusive entre jovens, portanto criar mais oportunidades de interação tem relevância social.

**O que o dado não permite dizer:** que usuários do iFood estejam sozinhos; que delivery cause solidão; ou que uma experiência gerada pelo SideQuest reduza solidão.

Solidão é uma experiência subjetiva. Isolamento social é uma condição objetiva. Morar sozinho também não é sinônimo de nenhum dos dois. Essas distinções devem aparecer na fala do grupo.

### 1.2 Morar sozinho tornou-se mais comum no Brasil

Segundo a PNAD Contínua do IBGE, as unidades domésticas unipessoais passaram de **12,2% em 2012 para 18,6% em 2024**. É um aumento de **6,4 pontos percentuais**, ou aproximadamente **52% em termos relativos**.

Em São Paulo, o indicador passou de **12,0% para 18,4%** no mesmo período.

Fonte primária: [IBGE — Síntese de Indicadores Sociais 2025, gráfico “Percentual de unidades domésticas unipessoais — 2012/2024”](https://agenciadenoticias.ibge.gov.br/media/com_mediaibge/arquivos/15ec1d59965a24b0bb2817eaf9b6f490.pdf), com dados da [tabela SIDRA 6788](https://sidra.ibge.gov.br/tabela/6788).

O Censo 2022 encontrou **18,9% de unidades domésticas unipessoais**, resultado compatível com a tendência da PNAD, embora as operações estatísticas não devam ser misturadas como se fossem a mesma série.

Fonte primária: [IBGE — Censo Demográfico 2022: composição domiciliar](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv102127.pdf).

**O que o dado permite dizer:** existe um contingente crescente de lares formados por uma pessoa, e produtos domésticos não podem presumir uma família tradicional no mesmo endereço.

**Limite para o SideQuest:** a experiência atual exige outras pessoas presentes ou conectadas. O crescimento dos lares unipessoais só ajuda a narrativa se o produto oferecer convite simples, sessão remota ou experiência solo. Sem isso, o dado descreve uma tendência, mas não sustenta diretamente o MVP.

### 1.3 Refeições compartilhadas estão associadas a bem-estar

O capítulo 3 do *World Happiness Report 2025* analisou respostas do Gallup World Poll de 2022 e 2023 em **142 países e territórios**, com amostras representativas de aproximadamente 500 pessoas por país. Os entrevistados informaram quantos almoços e jantares haviam compartilhado com pessoas conhecidas na semana anterior.

Principais achados:

- compartilhar mais refeições esteve associado a maior satisfação com a vida e afeto positivo e a menor afeto negativo;
- a associação permaneceu após controles por idade, gênero, educação, emprego, renda, tamanho do domicílio, dificuldade para comprar alimentos e efeitos fixos de país;
- a frequência de refeições compartilhadas explicou variação em bem-estar em magnitude comparável a indicadores como renda e desemprego;
- a América Latina e o Caribe apresentaram a maior frequência média: aproximadamente **9 refeições compartilhadas por semana**.

Fonte primária: [*World Happiness Report 2025*, capítulo 3 — “Sharing meals with others”](https://worldhappiness.report/ed/2025/sharing-meals-with-others-how-sharing-meals-supports-happiness-and-social-connections/) e [PDF do capítulo](https://files.worldhappiness.report/WHR25_Ch03.pdf).

Uma versão revisada por pares foi publicada em 2026 no periódico *Scientific Reports*: [De Neve et al., “Sharing meals is associated with greater wellbeing”](https://doi.org/10.1038/s41598-026-46771-9).

**O que o dado permite dizer:** refeições compartilhadas são um contexto social relevante e um indicador robustamente associado a bem-estar em diferentes culturas.

**Limite causal:** trata-se principalmente de evidência observacional. Pessoas com mais bem-estar podem ter mais oportunidades de comer acompanhadas; outros fatores podem influenciar as duas coisas. Os autores afirmam que ainda existem grandes lacunas sobre causalidade. O pitch deve usar “associado”, não “gera”, “melhora” ou “combate”.

**Leitura crítica para o Brasil:** a América Latina já lidera em refeições compartilhadas. Portanto, o problema local não pode ser descrito como “brasileiros deixaram de comer juntos” sem dados específicos. A oportunidade mais segura é **enriquecer ocasiões que já existem**, dando estrutura, novidade e participação ao encontro.

### 1.4 Atividades novas realizadas em conjunto têm evidência experimental limitada, mas útil

Um estudo publicado no *Journal of Personality and Social Psychology* combinou dois levantamentos e três experimentos de laboratório com casais. Nos três experimentos, casais que fizeram juntos uma tarefa de sete minutos classificada como nova e estimulante apresentaram aumento maior na qualidade percebida da relação do que casais submetidos a uma tarefa mais rotineira. Um dos experimentos também encontrou mudança em comportamento codificado por avaliadores cegos.

Fonte primária: [Aron et al. — “Couples’ Shared Participation in Novel and Arousing Activities and Experienced Relationship Quality” (2000)](https://files.blogs.baruch.cuny.edu/wp-content/blogs.dir/7309/files/2019/11/Aron_Norman_Aron_McKenna_Heyman_2000.pdf), DOI [10.1037/0022-3514.78.2.273](https://doi.org/10.1037/0022-3514.78.2.273).

**O que o dado permite dizer:** há evidência experimental de que uma atividade curta, nova e compartilhada pode melhorar imediatamente a experiência de casais.

**Limites:** o artigo é de 2000; os experimentos foram curtos; as amostras foram pequenas e norte-americanas; o resultado não pode ser generalizado automaticamente para amigos, famílias, grupos brasileiros ou efeitos duradouros. Ele sustenta uma hipótese de design: **novidade + participação conjunta**, não uma promessa de impacto clínico.

### 1.5 Refeições compartilhadas também podem acontecer a distância

Uma revisão de escopo publicada em 2022 reuniu **104 publicações** sobre formas digitais de comensalidade. Entre elas aparecem refeições por videochamada, comunidades virtuais de comida e experiências que combinam alimentação e jogos. A revisão relata que refeições remotas são usadas por amigos, casais e famílias para manter contato quando estão geograficamente separados. Também aponta que ter a comida pronta no mesmo horário e consumir alimentos semelhantes pode estimular diálogo.

Fonte: [“Digital Forms of Commensality in the 21st Century: A Scoping Review”](https://pmc.ncbi.nlm.nih.gov/articles/PMC9779162/).

Um estudo de 2023 realizou dois experimentos sobre *cloud-based commensality*, definida como comer enquanto se participa de uma videoconferência. Em um dos experimentos, casais fizeram refeições em diferentes condições de laboratório; os resultados sugeriram mais emoções positivas e maior percepção de proximidade na condição remota compartilhada do que na refeição solitária.

Fonte: [Wang e Wan — “Alone but together: Cloud-based commensality benefits physical and mental health”](https://doi.org/10.1111/aphw.12448).

**O que os dados permitem dizer:** refeições remotas são uma prática real e podem produzir sensação de copresença; sincronizar horário e algum grau de semelhança entre os alimentos é uma hipótese de design plausível.

**Limites:** o campo ainda é incipiente, grande parte da literatura é qualitativa e o experimento citado é restrito a casais e condições controladas. Não há prova de que uma Party do SideQuest reduza solidão ou produza benefícios duradouros.

### 1.6 Presença física e atenção compartilhada são coisas diferentes

Um experimento de campo pré-registrado reuniu **304 pessoas**, entre estudantes e membros da comunidade, em grupos de três a cinco amigos ou familiares durante uma refeição em um café. Os grupos foram distribuídos aleatoriamente entre duas condições: celulares disponíveis sobre a mesa ou celulares guardados. Quando os aparelhos estavam disponíveis, os participantes relataram mais distração e menos aproveitamento da experiência. Um segundo estudo por amostragem de experiência encontrou o mesmo padrão em interações cotidianas.

Fonte primária: [Dwyer, Kushlev e Dunn — “Smartphone use undermines enjoyment of face-to-face social interactions”](https://doi.org/10.1016/j.jesp.2017.10.007), *Journal of Experimental Social Psychology* 78 (2018), [manuscrito completo](https://static1.squarespace.com/static/57a40c19414fb54f51f8095f/t/5dbc52a03ed9a757d6b1eac8/1572623009161/1-s2.0-S0022103117301737-main.pdf).

**O que o dado permite dizer:** a simples presença de outras pessoas à mesa não garante uma interação de qualidade; o desenho da experiência e a disputa pela atenção importam.

**Limites:** o efeito observado foi pequeno, o estudo foi realizado no Canadá e não avaliou um jogo conduzido por agente. Ele não prova que o SideQuest aumentará conexão.

**Implicação de produto:** o SideQuest deve usar tecnologia para preparar e iniciar o encontro, depois reduzir a interação individual com telas. Uma opção é um único celular compartilhado atuar como narrador em áudio, com rodadas executadas por voz e objetos físicos. O agente gera a experiência e sai da frente.

### 1.7 O iFood oferece escala e infraestrutura para testar uma nova ocasião de uso

O Relatório de Sustentabilidade 2023–2025 do iFood informa:

- cerca de **55 milhões de usuários ativos**;
- **mais de 400 mil estabelecimentos parceiros**;
- **120 milhões de pedidos mensais**;
- presença em **mais de 1.500 cidades brasileiras**.

Fonte institucional primária: [iFood — Relatório de Sustentabilidade 2023–2025](https://institucional.ifood.com.br/wp-content/uploads/2025/08/iFood_RS23-25_POR-v9-1.pdf) e [página de transparência](https://institucional.ifood.com.br/transparencia/).

Em novembro de 2025, o iFood informou um pico de **180 milhões de pedidos no mês** e R$ 15 bilhões em vendas de parceiros. Por ser um recorde mensal, esse número não deve ser apresentado como média recorrente.

Fonte institucional primária: [iFood — recorde de novembro de 2025](https://institucional.ifood.com.br/releases/ifood-bate-novo-recorde-no-mes-de-novembro-com-180-milhoes-de-pedidos-totais/).

**O que os dados permitem dizer:** o SideQuest poderia operar sobre uma rede comercial já presente em larga escala e em várias categorias.

**O que não permitem dizer:** que 55 milhões de pessoas seriam público do SideQuest; que existe demanda comprovada por jogos; ou que o produto aumentaria pedidos. Essas hipóteses precisam de experimento.

---

## 2. Evidências promissoras, mas fracas para o pitch

### 2.1 Jogos cooperativos como intervenção de conexão

Um estudo piloto desenvolveu um jogo de cartas cooperativo chamado *Connections*. Trinta adultos, organizados em 15 duplas de desconhecidos, participaram de uma única sessão. Houve mudanças pré–pós em alguns indicadores imediatos de disposição para se conectar e de estado emocional.

Fonte: [“Iterative Design, Feasibility, and Preliminary Efficacy Testing...”](https://pmc.ncbi.nlm.nih.gov/articles/PMC11981092/).

**Por que não usar como prova central:** amostra de conveniência muito pequena, ausência de grupo de controle, participantes com baixa solidão inicial e medidas imediatas suscetíveis a efeito de demanda. Os próprios autores pedem um ensaio randomizado com seguimento.

Além disso, uma revisão sistemática e meta-análise sobre participação em videogames e solidão encontrou **resultados mistos**: diferentes estudos associaram jogar tanto a menor quanto a maior solidão, dependendo do contexto, do tipo de jogo, da motivação e da população. Embora videogame não seja igual à experiência física e presencial do SideQuest, a revisão é um alerta contra qualquer claim genérico de que “jogar conecta”.

Fonte: [“Is Increased Video Game Participation Associated With Reduced Sense of Loneliness? A Systematic Review and Meta-Analysis” (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9149078/).

Uma revisão mais ampla de 263 trabalhos sobre jogos sociais também aponta baixa validade ecológica em parte da literatura e falta de medidas estabelecidas para resultados sociais: [“Social gaming: A systematic review” (2024)](https://doi.org/10.1016/j.chb.2023.107851).

Uso aceitável: “Jogos cooperativos são um mecanismo promissor para estruturar conversa e colaboração.”

Uso inadequado: “Jogos comprovadamente reduzem a solidão.”

### 2.2 Retrospectiva do iFood

O iFood já oferece retrospectiva anual individualizada, com itens, restaurantes, categorias e número de pedidos. Em 2025, a empresa informou que o recurso estava disponível a seus 60 milhões de clientes.

Fonte institucional: [iFood — Retrospectiva 2025](https://institucional.ifood.com.br/clientes/retrospectiva-ifood/).

Esse dado prova familiaridade do usuário com narrativas personalizadas a partir do histórico. Não prova impacto social e não deve ser o centro da proposta atual.

### 2.3 Pesquisas brasileiras de solidão feitas durante a pandemia

Levantamentos online da Ipsos realizados em 2020 e 2021 são frequentemente citados para afirmar que o Brasil seria “o país mais solitário”. Esses dados foram coletados em contexto excepcional de pandemia, por painel online, e algumas manchetes misturam perguntas e períodos distintos.

Fonte metodológica da própria Ipsos: [Ipsos Flair Brasil 2022](https://www.ipsos.com/sites/default/files/Ipsos-Flair-Brasil-2022.pdf).

**Decisão:** não usar esses números no pitch. A estimativa global da OMS é mais recente, comparável e metodologicamente melhor documentada.

### 2.4 Crescimento de jogos no Brasil

Pesquisas comerciais sobre a porcentagem de brasileiros que “jogam algum tipo de jogo” costumam ter definição ampla, amostragem proprietária e interesse setorial. Mesmo que verdadeiras, elas não validam a vontade de jogar uma experiência física gerada dentro do iFood.

**Decisão:** não usar como base de impacto. Validar interesse com teste do protótipo é mais convincente.

---

## 3. Dados descartados e argumentos que devem ser evitados

| Argumento | Problema | Formulação segura |
| --- | --- | --- |
| “O SideQuest combate a epidemia de solidão.” | Não há ensaio do produto nem mecanismo clínico. | “O SideQuest cria uma experiência comum para amigos que já decidiram se encontrar remotamente.” |
| “Morar sozinho significa ser solitário.” | Moradia, isolamento social e solidão são conceitos distintos. | “Quase um quinto das unidades domésticas brasileiras é unipessoal; experiências domésticas precisam contemplar novos arranjos.” |
| “Comer junto causa felicidade.” | A principal evidência global é observacional. | “Compartilhar refeições está fortemente associado a maior bem-estar subjetivo em dados de 142 países.” |
| “Jogos reduzem solidão.” | A evidência diretamente aplicável é preliminar e pequena. | “Regras e objetivos compartilhados podem dar estrutura à interação; vamos medir isso no produto.” |
| “As pessoas não sabem mais o que fazer juntas.” | Frase atraente, mas sem dado direto e ampla demais. | “Escolher e preparar uma atividade exige coordenação; o SideQuest comprime esse processo em um briefing.” |
| “O iFood tem 55 milhões de clientes, portanto esse é o mercado.” | Alcance da plataforma não equivale a mercado interessado. | “A plataforma já tem a infraestrutura e o catálogo para testar essa nova ocasião em escala.” |
| “Isso ajuda a saúde mental.” | Claim médico incompatível com as evidências disponíveis. | “O produto busca tornar o tempo compartilhado mais participativo, novo e memorável.” |

---

## 4. Narrativas possíveis

### Narrativa A — Multiplayer do mundo físico **(recomendada)**

#### Problema

Amigos distantes já compartilham voz, vídeo e estado digital durante uma partida. Seus ambientes físicos continuam separados: cada pessoa escolhe, pede e recebe algo sem relação com o que acontece nas outras casas.

#### Proposta

O SideQuest cria um contrato de experiência comum e o traduz para cada endereço. Produtos diferentes cumprem os mesmos papéis narrativos; pedidos individuais são coordenados para que a atividade comece em conjunto.

#### Por que é forte

- explica claramente por que existem múltiplos usuários e múltiplos pedidos;
- transforma diferenças de catálogo em parte da diversão;
- liga diretamente Discord, delivery e amizade à distância;
- cria uma demonstração técnica visual;
- permite medir se o grupo realmente iniciou e concluiu a experiência.

#### Frase de pitch

> **Amigos distantes já dividem a tela. Com o SideQuest, eles passam a dividir a experiência.**

### Narrativa B — Comensalidade digital aumentada

#### Problema

Refeições por chamada já existem, mas sincronizar horário, escolher algo relacionado e criar assunto depende de organização manual.

#### Proposta

O agente monta kits semanticamente relacionados para cada pessoa e conduz uma dinâmica que usa diferenças locais para estimular conversa.

#### Vantagem

É a narrativa com ligação mais direta à pesquisa sobre refeições remotas.

#### Fraqueza

O termo “comensalidade” é pouco familiar e pode deixar a apresentação acadêmica demais. Deve sustentar a tese, não necessariamente nomeá-la no pitch.

#### Frase de pitch

> **A mesma mesa, mesmo a quilômetros de distância.**

### Narrativa C — Protocolo semântico para delivery

#### Problema

Catálogos variam por endereço, então uma experiência remota não pode depender do mesmo SKU para todos.

#### Proposta

O agente descreve funções — picante, crocante, surpresa, recompensa — e resolve cada função localmente, respeitando orçamento, restrições e janela de entrega.

#### Vantagem

É a descrição mais forte da originalidade técnica.

#### Fraqueza

Sozinha, comunica arquitetura e não impacto humano. Funciona como mecanismo sob a Narrativa A.

#### Frase de pitch

> **O agente sincroniza significados, não produtos.**

---

## 5. Tese recomendada

### Formulação curta

> **SideQuest cria experiências físicas sincronizadas para amigos em endereços diferentes. Cada pessoa recebe um kit local e personalizado, mas todos participam da mesma missão.**

### Estrutura narrativa para a apresentação

1. **Cena reconhecível:** “Sexta à noite. Três amigos em três cidades entram na mesma chamada.”
2. **Lacuna:** “Eles dividem a conversa e a partida, mas cada um vive uma noite fisicamente diferente.”
3. **Produto:** “Todos entram em uma Party, respondem a cinco perguntas e conectam suas contas do iFood.”
4. **Prova técnica:** o agente cria papéis comuns, resolve produtos equivalentes em catálogos locais e coordena carrinhos e entregas.
5. **Experiência:** quando todos recebem, os itens diferentes viram componentes da mesma missão.
6. **Impacto:** a Party cria uma ocasião comum e mensurável entre pessoas geograficamente separadas.
7. **Validação honesta:** “A literatura descreve refeições remotas como forma de copresença. Vamos medir participação, conclusão e percepção de experiência comum no SideQuest.”

### Público inicial

O recorte mais coerente para o MVP é:

> **Grupos de duas a quatro pessoas que já se conhecem, vivem em endereços diferentes e pretendem se encontrar em uma chamada.**

O produto não precisa encontrar companhia nem fazer matchmaking. Ele adiciona uma camada física a uma relação e a um encontro que já existem.

Depois, o conceito pode incluir modo espectador, sessões híbridas, modo solo criativo e integração completa com plataformas de voz. Esses casos não entram como promessa do MVP.

---

## 6. Claims seguros para o pitch

### Podem ser usados

- “Uma em cada seis pessoas no mundo vivencia solidão, segundo a OMS; entre jovens de 13 a 29 anos, a estimativa fica entre 17% e 21%.”
- “No Brasil, a proporção de unidades domésticas unipessoais cresceu de 12,2% em 2012 para 18,6% em 2024.”
- “Dados de 142 países mostram que compartilhar mais refeições está associado a maior bem-estar subjetivo.”
- “A América Latina e o Caribe lideram o mundo em frequência de refeições compartilhadas, com cerca de nove por semana; o SideQuest parte de um comportamento cultural que já existe.”
- “Experimentos com casais indicam que atividades novas realizadas em conjunto podem melhorar a experiência imediata da relação, embora a generalização seja limitada.”
- “Uma revisão de 104 publicações descreve refeições remotas como prática usada por amigos, casais e famílias geograficamente separados.”
- “Sincronizar o horário e algum grau de semelhança entre os alimentos é uma hipótese de design apontada pela literatura de comensalidade digital.”
- “Em um experimento randomizado com 304 pessoas, manter celulares disponíveis durante uma refeição aumentou a distração e reduziu o aproveitamento; por isso, o SideQuest usa a tela como superfície compartilhada, evitando interações individuais concorrentes durante a missão.”
- “O iFood informa cerca de 55 milhões de usuários ativos, mais de 400 mil estabelecimentos e 120 milhões de pedidos mensais em seu relatório 2023–2025.”
- “Queremos transformar pedidos locais diferentes em uma experiência comum.”
- “Nosso impacto será medido por Parties iniciadas e concluídas entre pessoas em endereços diferentes.”

### Não devem ser usados

- “Reduzimos a solidão.”
- “Melhoramos a saúde mental.”
- “Comer junto deixa as pessoas mais felizes.”
- “Jogos comprovadamente conectam pessoas.”
- “Brasileiros estão cada vez mais isolados.”
- “Quase 20% dos brasileiros moram sozinhos.” O dado é percentual de **unidades domésticas**, não da população.
- “Nosso mercado é de 55 milhões de pessoas.”

---

## 7. Como provar impacto no hackathon

Números de contexto ajudam a narrativa, mas uma banca pode perguntar: “Como vocês sabem que a experiência funciona?” A resposta mais forte é incorporar medição ao protótipo.

### Métrica norte

**Experiências concluídas por pelo menos duas pessoas em endereços diferentes.**

### Métricas do funil

| Etapa | Métrica |
| --- | --- |
| Intenção | sessões criadas; número de participantes convidados |
| Viabilidade | missões geradas dentro de orçamento, prazo e restrições |
| Sincronização | diferença entre os horários de entrega e participantes prontos no início |
| Ativação | proporção de sessões iniciadas depois da entrega |
| Participação | participantes que completaram ao menos uma ação da missão |
| Conclusão | experiências finalizadas |
| Qualidade | nota de diversão, novidade e participação de todos |
| Atenção | tempo em modo sem tela e percepção de distração |
| Continuidade | intenção de repetir ou criar outra missão |
| Negócio | descoberta de novos itens/categorias, conversão em carrinho, valor incremental — apenas após validar que a experiência é boa |

### Perguntas simples após a missão

Escala de 1 a 5:

1. “Todos tiveram algo para fazer?”
2. “Isso tornou o encontro diferente do habitual?”
3. “Foi fácil começar?”
4. “Você faria outra SideQuest?”

Essas respostas não medem solidão ou saúde mental. Medem diretamente a promessa do produto.

### Experimento de validação sugerido

Comparar chamadas remotas de grupos pequenos em um teste inicial:

- **controle:** cada participante faz seu pedido normalmente;
- **SideQuest:** cada participante recebe produtos locais com papéis equivalentes, narrativa e objetivo compartilhado.

Comparar:

- taxa de início;
- participação de todos;
- conclusão;
- novidade percebida;
- intenção de repetir.

Mesmo sem significância estatística durante o hackathon, esse desenho mostra que o grupo sabe exatamente qual efeito pretende testar.

---

## 8. Pitch de impacto em 45 segundos

> Amigos que vivem longe já conseguem compartilhar uma partida e uma conversa, mas cada um continua vivendo uma noite fisicamente diferente. A literatura sobre comensalidade digital mostra que refeições remotas são usadas para criar copresença entre pessoas geograficamente separadas. O SideQuest transforma isso em produto: todos entram em uma Party, respondem a um questionário e conectam suas contas do iFood. O agente encontra, em cada endereço, produtos diferentes que cumprem os mesmos papéis, coordena os pedidos e inicia uma missão quando todos recebem. Não prometemos tratar solidão. Criamos uma experiência comum, executável e mensurável entre amigos distantes.

## Frase final recomendada

> **Amigos distantes já dividem a tela. Com o SideQuest, eles passam a dividir a experiência.**

