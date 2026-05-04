# VerusIA — Contexto do Projeto

## Visão Geral

Extensão Chrome chamada **VerusIA** que analisa páginas web, posts e vídeos para verificar informações e classificar conteúdo usando IA (OpenAI).

---

## Fluxo Principal

```
Usuário clica em "Analisar"
    ↓
Extrator coleta dados da página (extractor.js)
    ↓
Botão envia POST /analisar com o payload (button.js)
    ↓
Servidor recebe e executa runPipeline(pageData) (server.js)
    ↓
classifyPage(pageData) chama a OpenAI (classifyPage.js)
    ↓
Resultado exibido na Sidebar (sidebar.js)
```

---

## Estrutura de Arquivos Relevantes

```
Extensão Final/
├── src/
│   ├── content/
│   │   ├── services/
│   │   │   ├── extractor.js       # Coleta dados da página
│   │   │   ├── api.js             # Funções de chamada à API
│   │   │   └── storage.js         # Acesso ao chrome.storage
│   │   ├── ui/
│   │   │   ├── button.js          # Botão "Analisar" e fluxo principal
│   │   │   ├── sidebar.js         # Painel lateral de resultados
│   │   │   └── popup-login.js     # Popup de login interno
│   │   ├── features/
│   │   │   ├── configs.js         # Configurações de acessibilidade
│   │   │   └── reader.js          # Leitor de notícias
│   │   ├── content.js             # Entry point da extensão
│   │   └── state.js               # Estado global da extensão
│   ├── background/
│   │   └── background.js          # Service worker — proxy de fetch
│   ├── server/
│   │   ├── services/
│   │   │   └── classifyPage.js    # Classifica a página via OpenAI
│   │   └── server.js              # Servidor Express + runPipeline
│   └── pages/
│       ├── login/
│       ├── register/
│       └── settings/
├── .env                           # Variáveis de ambiente
├── manifest.json                  # Manifest da extensão Chrome
└── CONTEXTO.md                    # Este arquivo
```

---

## Extrator (`extractor.js`)

Coleta dados da página atual e expõe como variáveis globais `window.verus_*`.

### Campos coletados

| Campo | Descrição |
|---|---|
| `url` | URL completa da página |
| `domain` | Domínio (ex: `g1.globo.com`) |
| `title` | Título da página |
| `description` | Meta description |
| `siteName` | Nome do site (og:site_name) |
| `author` | Autor do conteúdo |
| `publishDate` | Data de publicação |
| `imageUrl` | Imagem principal (og:image) |
| `language` | Idioma da página |
| `pageType` | Tipo (og:type ou "webpage") |
| `headings` | Array de h1, h2, h3 |
| `links` | Até 30 links da página |
| `textLength` | Quantidade de caracteres do texto |
| `text` | Texto principal da página |

### Variáveis globais expostas

Após a extração, todos os campos ficam disponíveis como:
```js
window.verus_url
window.verus_domain
window.verus_title
window.verus_description
window.verus_siteName
window.verus_author
window.verus_publishDate
window.verus_language
window.verus_pageType
window.verus_headings
window.verus_textLength
window.verus_text
window.verus_links
```

### Estratégias por site

| Site | Estratégia |
|---|---|
| YouTube (`/watch`) | Abre transcrição automaticamente via DOM |
| YouTube (`/shorts`) | ⚠️ Aviso — não suportado |
| Instagram (`/p/` ou `/reel/`) | Identifica post ativo, expande "mais" |
| Instagram (`/reels/`) | ⚠️ Aviso — não suportado |
| Twitter / X | Extrai tweets do thread |
| Reddit | Extrai post e comentários |
| Outros | Extração genérica priorizando `article`, `main`, etc. |

### Detecção de data de publicação

Busca em 3 lugares:
1. Meta tags (`article:published_time`, `datePublished`, etc.)
2. Elemento `<time datetime="...">` no HTML
3. JSON-LD (`application/ld+json`)

---

## Botão (`button.js`)

- Ao clicar em **"Analisar"**:
  1. Exibe popup de progresso com etapas animadas
  2. Chama `PageExtractor.extract()` para coletar dados
  3. Envia `POST /analisar` para o servidor via background script
  4. Abre a sidebar com o payload extraído + resultado do servidor

- Ao clicar em **"💬"**:
  - Abre a sidebar no modo chat

---

## Background Script (`background.js`)

Proxy de fetch — necessário porque content scripts têm restrições de CORS e contexto isolado.

Recebe mensagens do tipo `FETCH` e executa o fetch no contexto do service worker, retornando JSON ou texto conforme o `Content-Type` da resposta.

---

## Servidor (`server.js`)

Servidor Express rodando em `http://localhost:3000`.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/register` | Cadastro de usuário |
| POST | `/login` | Login com email/senha |
| POST | `/login-google` | Login com Google OAuth |
| POST | `/salvar-configs` | Salva configurações do usuário |
| POST | `/carregar-configs` | Carrega configurações do usuário |
| POST | `/recuperar-senha` | Envia código de recuperação por email |
| POST | `/redefinir-senha` | Redefine senha com token |
| POST | `/analisar` | **Pipeline principal de análise** |
| GET | `/api/analises` | Lista análises do cache |
| GET | `/api/analises/detalhe` | Detalhe de uma análise |
| DELETE | `/api/analises` | Remove análise do cache |

### runPipeline

```
runPipeline(pageData)
    ↓
1. classifyPage(pageData)       ← classifica o tipo de página
    ↓
   Se deveContinuarAnalise = false → retorna { status: "ignorado" }
   Se deveContinuarAnalise = true  → continua pipeline
    ↓
2. extractMainContent           (TODO)
3. extractClaims                (TODO)
4. checkClaims                  (TODO)
5. searchRelatedNews            (TODO)
6. buildFinalResult             (TODO)
```

---

## classifyPage (`classifyPage.js`)

Chama a **OpenAI Responses API** com um prompt salvo.

### Variáveis enviadas ao prompt

```
url, domain, title, description, sitename, author,
publishdate, imageurl, language, pagetype,
headings, links, textlength, text
```

### Tipos de classificação

| Tipo | Continua análise? |
|---|---|
| `noticia` | ✅ Sim |
| `opiniao` | ✅ Sim |
| `social` | ✅ Sim |
| `busca` | ❌ Não |
| `produto` | ❌ Não |
| `generico` | ❌ Não |
| `erro` | ❌ Não |

### Retorno normalizado

```json
{
  "tipo": "noticia",
  "confianca": 0.95,
  "conteudoInutilDetectado": [],
  "trechosUteis": [],
  "tituloProvavel": "...",
  "resumoConteudoUtil": "...",
  "motivoClassificacao": "...",
  "deveContinuarAnalise": true
}
```

---

## Sidebar (`sidebar.js`)

Painel lateral que exibe:

1. **Banner do pipeline** — status do servidor (verde/amarelo/vermelho/cinza)
2. **Dados extraídos** — todos os campos coletados pelo extrator
3. **Chat** — permite fazer perguntas sobre o conteúdo

### Banner do pipeline

| Cor | Significado |
|---|---|
| 🟢 Verde | Pipeline concluído / continuando análise |
| 🟡 Amarelo | Página ignorada (busca, produto, genérico) |
| 🔴 Vermelho | Erro no servidor |
| ⚫ Cinza | Servidor não respondeu |

---

## Variáveis de Ambiente (`.env`)

```
EMAIL_USER=...
EMAIL_PASS=...
OPENAI_API_KEY=...
ADMIN_KEY=...
OPENAI_CLASSIFY_PAGE_PROMPT_ID=...
```

---

## Banco de Dados (SQLite)

Tabelas:
- `usuarios` — email, senha (bcrypt), nome, configs (JSON)
- `tokens_recuperacao` — tokens de redefinição de senha com expiração
- `cache_analises` — cache de análises por URL

---

## Como Rodar

```bash
# Instalar dependências
npm install

# Subir o servidor
node src/server/server.js

# Carregar a extensão no Chrome
# chrome://extensions → Modo desenvolvedor → Carregar sem compactação → selecionar a pasta raiz
```
