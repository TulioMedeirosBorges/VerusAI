# VerusAI

Extensão de navegador (Chrome, Manifest V3) + servidor Node.js/Express que analisa
notícias em qualquer página e usa uma cadeia de 11 chamadas de IA (OpenAI) para
extrair afirmações verificáveis, buscar evidências na web e em fontes oficiais, e
gerar um veredito final com explicação, fontes e nível de confiança — tudo exibido
numa sidebar injetada na própria página.

> **Aviso:** este é um projeto de faculdade, desenvolvido para fins acadêmicos. A
> intenção do VerusAI **não é afirmar que uma notícia é 100% verdadeira ou falsa**,
> e sim ajudar o leitor a analisar melhor o que está lendo. O software verifica
> cada afirmação da notícia em busca de evidências; quando não encontra evidência
> suficiente para alguma parte dela, **essa parte não é dada como verdadeira** — ela
> fica marcada como inconclusiva, em vez de confirmada.

## Demonstração

### Página inicial da Verus

![Página inicial da Verus](assets/gifs/Gif_da_pagina_inicial_da_verus.gif)

*Visão geral da página inicial do site da Verus.*

### Extensão em funcionamento

![Extensão em funcionamento](assets/gifs/Gif_da_extensao_funcionando.gif)

*A extensão analisando uma notícia diretamente na página, do clique no botão até o veredito na sidebar.*

## Visão geral

1. O usuário navega até uma notícia e clica no botão flutuante que a extensão
   injeta na página (ou usa o menu de compartilhar do navegador — ver
   [`share-verus.js`](src/extension/content/features/share-verus.js)).
2. O content script extrai o conteúdo da página
   ([`extractor.js`](src/extension/content/services/extractor.js): título, texto
   principal, metadados, data de publicação, transcrição do YouTube quando
   aplicável etc.) e envia para o servidor via `POST /analisar/start`.
3. O servidor roda o **pipeline de IA** ([`runPipeline.js`](src/server/services/pipeline/runPipeline.js)),
   que encadeia 11 etapas (detalhadas abaixo) até montar um resultado final.
4. Enquanto o pipeline roda, a extensão consulta `GET /analisar/status/:jobId`
   periodicamente e atualiza a sidebar com o progresso ("Classificando a
   página", "Extraindo afirmações", "Auditando claims" etc.).
5. O resultado final (`buildFinal`) é salvo em cache no SQLite e devolvido para a
   sidebar: veredito geral, score de confiabilidade, resumo, claims analisadas
   uma a uma, fontes usadas, entidades citadas e alertas.
6. A partir daí o usuário pode conversar sobre a notícia no chat da sidebar,
   destacar as claims no texto da própria página
   ([`claim-highlight.js`](src/extension/content/features/claim-highlight.js)),
   avaliar fontes com a comunidade e ganhar selos por participação.

## Estrutura do projeto

```
├── manifest.json          # Manifest da extensão Chrome (a raiz do projeto é a raiz da extensão)
├── package.json           # Dependências e script de inicialização do servidor
├── assets/                # Ícones, imagens e selos (usados pela extensão e pelo site)
├── public/                # Site público (servido pelo servidor em /site)
│   └── docs/              # Documentação do projeto
└── src/
    ├── extension/         # Código da extensão de navegador
    │   ├── background/    # Service worker (login Google, mensagens)
    │   ├── content/       # Content scripts injetados nas páginas
    │   │   ├── features/  # Funcionalidades (leitor, destaques, link preview, compartilhar...)
    │   │   ├── services/  # Extração de página, API, storage
    │   │   ├── ui/        # Sidebar, botão, popup de login, selo de fonte, selo de comunidade
    │   │   └── chat/      # Chat dentro da sidebar
    │   ├── pages/         # Páginas da extensão (login, registro, configurações, chat)
    │   └── shared/        # Ícones e CSS compartilhados entre as páginas
    └── server/            # Backend Node.js/Express
        ├── server.js      # Ponto de entrada: monta o Express e registra as rotas
        ├── db.js          # Banco SQLite, tabelas e migrações
        ├── lib/           # Helpers genéricos (utils) e envio de e-mail
        ├── services/      # Regras de negócio, agrupadas por domínio
        │   ├── ai-services/   # As 11 etapas de IA do pipeline + chats (ver seção abaixo)
        │   ├── pipeline/      # Orquestração da análise (runPipeline, roteamento de candidatos)
        │   ├── analises/      # Ciclo de vida da análise salva (montar, mesclar, salvar, cache)
        │   ├── comunidade/    # Feedback, selos e avaliação de fontes pelos usuários
        │   ├── integracoes/   # Serviços externos (Google News, link preview, cache)
        │   └── sessoes.js     # Sessões de usuário
        ├── routes/        # Rotas Express agrupadas por domínio
        └── data/          # Dados curados (presidentes)
```

## O pipeline de IA (`src/server/services/ai-services/`)

Todos os serviços de IA seguem o mesmo padrão: chamam a **OpenAI Responses API**
(`POST https://api.openai.com/v1/responses`) usando um **prompt salvo na
plataforma da OpenAI** (identificado por `prompt.id` + `prompt.version`, configurados
via variáveis de ambiente — não há prompts soltos escritos no código-fonte). Cada
serviço:

- Monta as `variables` do prompt a partir dos dados normalizados daquela etapa;
- Lê o texto de saída (`output_text` ou `output[].content[].text`) via o helper
  [`openaiText.js`](src/server/services/ai-services/openaiText.js);
- Faz *parsing* defensivo do JSON retornado (aceitando cercas ```` ```json ````,
  variações de `camelCase`/`snake_case`/português, chaves ausentes) e devolve
  sempre um objeto com formato estável, mesmo em erro — para que uma etapa
  quebrada não derrube o pipeline inteiro.

O `runPipeline` roda as etapas nesta ordem, publicando progresso a cada passo:

| # | Etapa | Serviço | O que faz |
|---|-------|---------|-----------|
| 1 | Classificar página | `classifyPage.js` | Decide se o conteúdo é notícia, opinião, busca, rede social, produto etc. e limpa o texto |
| 2 | Extrair claims | `extractClaims.js` | Extrai as afirmações verificáveis do texto limpo |
| 3 | Detectar tipo das claims | `detectClaimType.js` | Classifica cada claim (categoria, prioridade, se depende de data/local/pessoa) |
| 4 | Gerar queries de busca | `generateSearchQueries.js` | Cria queries de pesquisa e sugestões de API por claim |
| 5 | Selecionar candidatos web | `webSearchCandidates.js` | Aponta links/fontes candidatas a evidência para cada claim |
| 6 | Verificar candidatos | `verifyWebSearchCandidates.js` | Confere se cada link candidato realmente sustenta a claim |
| 7 | Rotear candidatos | `routeVerifiedCandidates.js` (pipeline, sem IA) | Separa candidatos verificados em "precisa API", "precisa fonte oficial" ou "nenhum" |
| 8 | Fontes oficiais | `officialFontesRouter.js` | Busca evidência em fontes oficiais para os candidatos que precisam |
| 9 | Revisão final do pipeline | `finalPipelineReview.js` | Reconsolida tudo e emite um veredito por claim (`simpleCheckClaims`) |
| 10 | Auditoria das claims | `claimAudit.js` | Audita cada veredito da etapa 9 em busca de riscos e problemas |
| 11 | Montagem final | `buildFinal.js` | Gera o objeto final apresentado na sidebar (resumo, veredito geral, fontes, HTML) |

Além dessas 11 etapas, há dois serviços de IA independentes usados fora do
pipeline de análise, para o chat da extensão: `chatNoticias.js` e `chatAnalise.js`.

### 1. `classifyPage.js` — Classificação da página

- **Entrada:** `pageData` (url, domínio, título, descrição, autor, data de
  publicação, headings, links, texto extraído, transcrição do YouTube quando
  houver).
- **IA:** prompt `OPENAI_CLASSIFY_PAGE_PROMPT_ID`.
- **Saída:** categoria da página e do texto principal (`noticia`, `opiniao`,
  `busca`, `social`, `produto`, `generico`, `erro`), título provável, o
  `textolimpo` (texto já higienizado que alimenta as próximas etapas) e o motivo
  da classificação.
- Se o resultado não for `noticia`, o `runPipeline` encerra o pipeline ali mesmo
  (`status: "ignorado"`), evitando gastar as demais 10 chamadas de IA em conteúdo
  que não é checável.

### 2. `extractClaims.js` — Extração de claims

- **Entrada:** a classificação da etapa 1 (texto limpo, título, tipo) + `pageData`.
- **IA:** prompt `OPENAI_EXTRACT_CLAIMS_PROMPT_ID`.
- **Saída:** lista de claims, cada uma com id, texto, tipo, importância, motivo,
  quais verificações ela exige (ano/data/local/pessoa/instituição corretos) e os
  elementos críticos citados (datas, locais, pessoas, instituições, números).
- Se nenhuma claim for extraída, o pipeline também é encerrado ali.

### 3. `detectClaimType.js` — Detecção de tipo de verificação

- **Entrada:** todas as claims da etapa 2, em **lote único** (uma só chamada de IA
  para todas as claims, para reduzir custo/latência).
- **IA:** prompt `OPENAI_DETECT_CLAIM_TYPE_PROMPT_ID`.
- **Saída por claim:** tipo de verificação, categoria principal, se precisa de
  busca web / API oficial / fonte estatística, fontes e APIs recomendadas, nível
  de prioridade e estratégia de checagem.
- O resultado é casado de volta com cada claim pelo `claimid` (nunca por posição
  no array), já que a IA pode reordenar a resposta.

### 4. `generateSearchQueries.js` — Geração de queries de busca

- **Entrada:** contexto da notícia + todas as claims já tipadas (lote único).
- **IA:** prompt `OPENAI_GENERATE_SEARCH_QUERIES_PROMPT_ID`.
- **Saída por claim:** lista de queries de busca, consultas de API sugeridas e
  alertas de busca (ex.: ambiguidade, risco de resultado desatualizado).

### 5. `webSearchCandidates.js` — Seleção de candidatos web

- **Entrada:** claims + classificação de verificação + queries geradas, em lote,
  com o contexto da notícia original.
- **IA:** prompt `OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID`.
- **Saída:** lista de fontes candidatas por claim (URL, domínio, título, tipo de
  fonte, prioridade da query que a gerou, trecho de busca e termos encontrados).
- Aceita tanto o formato `claims[]` quanto um formato alternativo
  `fontesCandidatas[]`, normalizando ambos para a mesma estrutura interna.

### 6. `verifyWebSearchCandidates.js` — Verificação dos candidatos

- **Entrada:** os candidatos da etapa 5, agrupados por claim.
- **IA:** prompt `OPENAI_VERIFY_WEB_SEARCH_CANDIDATES_PROMPT_ID`.
- **Saída por candidato:** se ele *faz sentido* como evidência para a claim,
  confiança da relação, motivo, se precisa de checagem extra em API/fonte
  oficial, e alertas (ex.: fonte não bate com o que a claim afirma).
- Como a IA às vezes não ecoa o `claimid` de volta, o serviço recupera o vínculo
  comparando a URL retornada com as URLs originais enviadas.

### 7. `routeVerifiedCandidates.js` — Roteamento (sem IA)

- Fica em `services/pipeline/`, não em `ai-services/`, porque é lógica pura em
  JS — não faz nenhuma chamada de IA.
- **Entrada:** candidatos já verificados na etapa 6.
- **Saída:** os candidatos de cada claim separados em três grupos —
  `necessitaApi`, `necessitaFonteOficial` e `nenhum` (não precisa de
  processamento adicional) — com totais agregados para o resumo do pipeline.

### 8. `officialFontesRouter.js` — Verificação em fontes oficiais

- **Entrada:** candidatos roteados como "precisa fonte oficial" ou "nenhum" (para
  não perder contexto) de cada claim.
- **IA:** prompt `OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID`, **uma chamada por
  claim que tiver candidato marcado como `necessita_fonte_oficial`** (claims sem
  necessidade de fonte oficial não geram chamada de IA, economizando custo).
- **Saída por claim:** evidências encontradas em fontes oficiais, se o domínio é
  realmente oficial, se os dados batem com o que a claim afirma, tipo de relação
  (confirma/contradiz/contextualiza/inconclusivo) e conclusão preliminar.

### 9. `finalPipelineReview.js` — Revisão final do pipeline

- **Entrada:** todo o histórico do pipeline (`normalizeFinalPipelineForAI`)
  reconsolida as etapas 2 a 8 claim a claim — texto original, tipo, queries,
  candidatos atualizados, roteamento e evidências oficiais — num único objeto
  coerente.
- **IA:** prompt `OPENAI_FINAL_PIPELINE_REVIEW_PROMPT_ID`.
- **Saída:** um veredito (`simpleCheckClaims`) por claim (`confirmada`,
  `contradita`, `parcial`, `inconclusiva`, `erro`), com confiança, resumo,
  explicação, fontes usadas, pontos que confirmam/contradizem/ficam
  inconclusivos, entidades citadas e alertas — além de uma síntese
  `analise_para_build_final` com veredito preliminar geral e claims mais
  importantes, usada como ponto de partida da etapa 11.

### 10. `claimAudit.js` — Auditoria das claims

- **Entrada:** o resultado da etapa 9, também com base em
  `normalizeFinalPipelineForAI`, **um input por claim**.
- **IA:** prompt `OPENAI_CLAIM_AUDIT_PROMPT_ID`, **uma chamada por claim**.
- **Saída por claim:** decisão de auditoria (manter, revisar explicação,
  rebaixar conclusão, exigir fonte oficial, refazer busca, rejeitar checagem),
  riscos avaliados independentemente (alucinação, fonte fraca, contexto errado,
  veredito exagerado), se precisa de nova busca ou fonte oficial, problemas
  encontrados com gravidade, e se a claim pode seguir para o `buildFinal`.
- Funciona como uma segunda camada de IA "checando o checador", pensada para
  reduzir alucinações e veredictos exagerados antes de chegar ao usuário.

### 11. `buildFinal.js` — Montagem do resultado final

- **Entrada:** resultado completo do pipeline + o veredito da etapa 9 + a
  auditoria da etapa 10 (mesclados por `claim_id`), fontes principais e
  entidades coletadas automaticamente de todas as claims, e todos os alertas
  acumulados (globais + por claim + da auditoria).
- **IA:** prompt `OPENAI_BUILD_FINAL_PROMPT_ID`.
- **Saída:** o objeto final consumido pela sidebar — título, resumo curto e
  detalhado, veredito geral, score e nível de confiabilidade, mensagem
  principal para o usuário, claims analisadas com evidências, fontes
  principais, entidades mencionadas (com link pra Wikipédia quando existir),
  alertas gerais, o que foi confirmado/contraditado/ficou inconclusivo e um
  conteúdo estruturado para exibição.
- Todo texto retornado passa por uma limpeza (`normalizePublicTextDeep`) que
  decodifica entidades HTML e converte HTML solto em texto plano, garantindo
  que a sidebar nunca renderize markup bruto vindo da IA.

### Chats (fora do pipeline de análise)

- **`chatNoticias.js`** — responde perguntas gerais de notícias/atualidades no
  chat da sidebar (prompt `OPENAI_CHAT_NOTICIAS_PROMPT_ID`). Usado pela rota
  `POST /chat/noticias` ([`routes/chat.js`](src/server/routes/chat.js)), que
  também grava o histórico por usuário no SQLite.
- **`chatAnalise.js`** — pensado para responder perguntas sobre uma análise
  específica já feita (recebe a pergunta + o resultado do `buildFinal` daquela
  notícia como contexto, prompt `OPENAI_CHAT_ANALISE_PROMPT_ID`). Hoje o
  serviço existe e funciona, mas ainda não está conectado a nenhuma rota
  Express — é o próximo passo natural para um chat "converse sobre esta
  notícia" dentro da sidebar.

### `openaiText.js` — utilitário compartilhado

Não é uma etapa de IA, mas é usado por quase todos os serviços acima:
`getOutputText` extrai o texto de qualquer formato de resposta da Responses API,
e `normalizeAIAnswer` desembrulha respostas de chat que às vezes vêm como JSON
(`{"resposta": "..."}`) em vez de texto puro.

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```
# OpenAI
OPENAI_API_KEY=

# IDs dos prompts salvos na OpenAI, um por etapa do pipeline / chat
OPENAI_CLASSIFY_PAGE_PROMPT_ID=
OPENAI_EXTRACT_CLAIMS_PROMPT_ID=
OPENAI_DETECT_CLAIM_TYPE_PROMPT_ID=
OPENAI_GENERATE_SEARCH_QUERIES_PROMPT_ID=
OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID=
OPENAI_VERIFY_WEB_SEARCH_CANDIDATES_PROMPT_ID=
OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID=
OPENAI_FINAL_PIPELINE_REVIEW_PROMPT_ID=
OPENAI_CLAIM_AUDIT_PROMPT_ID=
OPENAI_BUILD_FINAL_PROMPT_ID=
OPENAI_CHAT_NOTICIAS_PROMPT_ID=
OPENAI_CHAT_ANALISE_PROMPT_ID=

# E-mail (recuperação de senha, notificações)
EMAIL_USER=
EMAIL_PASS=

# Chave de admin (rotas administrativas)
ADMIN_KEY=
```

Cada `OPENAI_*_PROMPT_ID` aponta para um prompt configurado no painel da OpenAI
(Playground → Prompts); o código só referencia o id e a versão, o texto do
prompt em si vive na OpenAI, não no repositório. Se uma variável de um prompt
opcional não estiver definida, o serviço correspondente devolve um erro
estruturado (sem quebrar o pipeline) explicando qual variável falta.

## Como rodar

1. Instale as dependências: `npm install`
2. Crie o arquivo `.env` (seção acima) com as credenciais e prompt IDs
3. Inicie o servidor: `npm start` — sobe em `http://localhost:3000` (site em `/site`)
4. Carregue a extensão no Chrome: `chrome://extensions` → "Carregar sem
   compactação" → selecione a **pasta raiz do projeto** (onde está o
   `manifest.json`)

> Sempre que os arquivos listados em `manifest.json` mudarem de local, recarregue
> a extensão no Chrome (`chrome://extensions` → botão de atualizar).

## Banco de dados

O arquivo `verusai.db` (SQLite) é criado automaticamente na raiz ao iniciar o
servidor e está no `.gitignore` — não é versionado. Ele guarda sessões,
histórico de chat, cache de análises já feitas (para não reprocessar a mesma
URL), feedback e avaliações de fontes da comunidade, e os selos conquistados
pelos usuários.
