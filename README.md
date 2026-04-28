# VerusAI — Extensão de Verificação de Notícias

Extensão para Google Chrome que analisa automaticamente o conteúdo de páginas web e redes sociais, verificando a veracidade de afirmações usando IA (OpenAI) e busca em fontes jornalísticas confiáveis.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Instalação e Configuração](#instalação-e-configuração)
- [Arquitetura](#arquitetura)
- [Backend — Servidor Express](#backend--servidor-express)
- [Extensão — Content Scripts](#extensão--content-scripts)
- [Pipeline de Análise](#pipeline-de-análise)
- [Autenticação](#autenticação)
- [API Reference](#api-reference)

---

## Visão Geral

O VerusAI injeta um botão flutuante em qualquer página web. Ao clicar, o usuário abre uma sidebar que exibe:

- **Score de confiabilidade** (0–100%) com cor indicativa
- **Resumo** da análise
- **Afirmações verificadas** com veredicto individual
- **Fontes consultadas** com links
- **Chat** para perguntas adicionais sobre o conteúdo

Plataformas suportadas: sites de notícias, YouTube, Instagram, Twitter/X, TikTok, Facebook.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Extensão | Chrome Extension Manifest V3, JavaScript vanilla |
| Backend | Node.js, Express 5, SQLite (better-sqlite3) |
| IA | OpenAI API (GPT com web search) |
| Autenticação | Email/senha (bcrypt) + Google OAuth2 |
| E-mail | Nodemailer (Gmail) |

---

## Estrutura do Projeto

```
extensão-final/
├── assets/
│   ├── icons/          # Ícones SVG da interface
│   └── images/         # Logo VerusAI
├── src/
│   ├── background/
│   │   └── background.js       # Service worker — proxy de requisições
│   ├── content/
│   │   ├── features/
│   │   │   ├── analysis.js     # Extração de conteúdo da página
│   │   │   ├── configs.js      # Gerenciamento de configurações
│   │   │   └── reader.js       # Leitor de notícias (acessibilidade)
│   │   ├── services/
│   │   │   ├── api.js          # Comunicação com o backend
│   │   │   └── storage.js      # Wrapper do chrome.storage
│   │   ├── ui/
│   │   │   ├── button.js       # Botão flutuante "Analisar"
│   │   │   ├── popup-login.js  # Popup de login inline
│   │   │   └── sidebar.js      # Sidebar principal com resultados
│   │   ├── analyzeWithOpenAI.js
│   │   ├── captureFrames.js    # Captura de frames de vídeo
│   │   ├── content.js          # Entry point dos content scripts
│   │   └── state.js            # Estado global da extensão
│   ├── pages/
│   │   ├── chat/               # Página de chat dedicada
│   │   ├── login/              # Página de login
│   │   ├── register/           # Página de cadastro
│   │   └── settings/           # Página de configurações
│   ├── server/
│   │   ├── services/
│   │   │   ├── analyzeSource.js        # Análise de credibilidade do canal
│   │   │   ├── buildFinalResult.js     # Construção do resultado final + score
│   │   │   ├── checkClaims.js          # Verificação de afirmações
│   │   │   ├── classifyPage.js         # Classificação do tipo de página
│   │   │   ├── extractClaims.js        # Extração de afirmações verificáveis
│   │   │   ├── extractMainContent.js   # Extração do conteúdo principal
│   │   │   ├── extractVideoContent.js  # Análise de frames de vídeo
│   │   │   ├── openai.js               # Wrapper da OpenAI API
│   │   │   ├── rankSources.js          # Ranqueamento de fontes
│   │   │   └── searchRelatedNews.js    # Busca de matérias relacionadas
│   │   └── server.js           # Servidor Express + rotas de auth
│   └── shared/
│       ├── icons.js
│       └── sidebar.css         # Estilos da sidebar (Shadow DOM)
├── manifest.json
├── package.json
└── .env
```

---

## Instalação e Configuração

### Pré-requisitos

- Node.js 18+
- Conta OpenAI com acesso à API
- Conta Gmail para envio de e-mails (recuperação de senha)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
OPENAI_API_KEY=sua_chave_aqui
EMAIL_USER=seuemail@gmail.com
EMAIL_PASS=sua_senha_de_app_gmail
```

> Para o Gmail, use uma **Senha de App** (não a senha normal). Ative em: Conta Google → Segurança → Verificação em duas etapas → Senhas de app.

### 3. Iniciar o servidor

```bash
node src/server/server.js
```

O servidor sobe em `http://localhost:3000`.

### 4. Carregar a extensão no Chrome

1. Acesse `chrome://extensions/`
2. Ative o **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta raiz do projeto

---

## Arquitetura

```
┌─────────────────────────────────────────────┐
│              Chrome Extension               │
│                                             │
│  content.js → button.js → sidebar.js        │
│       ↓                                     │
│  analysis.js (extrai conteúdo da página)    │
│       ↓                                     │
│  background.js (proxy de fetch)             │
└──────────────────┬──────────────────────────┘
                   │ HTTP POST /analisar
                   ▼
┌─────────────────────────────────────────────┐
│           Servidor Express (3000)           │
│                                             │
│  classifyPage → extractMainContent          │
│       ↓                                     │
│  extractClaims + analyzeSource (paralelo)   │
│       ↓                                     │
│  checkClaims + searchRelatedNews (paralelo) │
│       ↓                                     │
│  rankSources → buildFinalResult             │
└─────────────────────────────────────────────┘
```

O **background.js** atua como proxy porque content scripts têm restrições de CORS. Toda requisição ao backend passa por ele via `chrome.runtime.sendMessage`.

---

## Backend — Servidor Express

### Banco de Dados (SQLite)

Duas tabelas criadas automaticamente na inicialização:

**`usuarios`**
| Campo | Tipo | Descrição |
|---|---|---|
| id | INTEGER | Chave primária |
| email | TEXT UNIQUE | E-mail do usuário |
| senha | TEXT | Hash bcrypt |
| nome | TEXT | Nome de exibição |
| configs | TEXT | JSON de configurações |
| criado_em | DATETIME | Data de criação |

**`tokens_recuperacao`**
| Campo | Tipo | Descrição |
|---|---|---|
| token | TEXT UNIQUE | Código de 6 dígitos |
| email | TEXT | E-mail associado |
| expira_em | DATETIME | Expiração (15 min) |
| usado | INTEGER | 0 = válido, 1 = usado |

---

## Extensão — Content Scripts

### `content.js` — Entry Point

- Usa guard `window.verus_guard` para evitar inicialização dupla
- Cria o botão via `CreateButton()`
- Observa mutações do DOM com debounce de 300ms (necessário para SPAs como Instagram)
- Escuta `chrome.storage.onChanged` para aplicar configs em tempo real

### `analysis.js` — Extração de Conteúdo

A função `extractPagePayload()` coleta:
- Título da página
- Texto visível (até 8.000 caracteres)
- Links encontrados no artigo
- Imagem principal
- Plataforma detectada (youtube, instagram, twitter, tiktok, facebook, web)
- Handle e URL do canal/perfil (para redes sociais)

### `sidebar.js` — Interface Principal

Renderizada em **Shadow DOM** para isolamento de estilos. Contém:
- Header com logo, toggle de tema e botão de configurações
- Barra de confiabilidade animada
- Área de mensagens (análise + chat)
- Input de chat com verificação de login
- Menu de configurações (tamanho de texto, alto contraste, tema escuro, leitor de notícias)

---

## Pipeline de Análise

Ao clicar em "Analisar", o seguinte pipeline é executado no servidor:

```
POST /analisar
│
├── 1. classifyPage(text)
│      → tipo: "noticia" | "opiniao" | "busca" | "generico"
│
├── 2. extractMainContent(text)
│      → { titulo, corpo }
│
├── 3. [paralelo]
│   ├── extractClaims(corpo)        → até 5 afirmações verificáveis
│   └── analyzeSource(...)          → credibilidade do canal (só redes sociais)
│
├── 4. [paralelo]
│   ├── checkClaims(afirmacoes)     → veredicto por afirmação
│   └── searchRelatedNews(...)      → matérias jornalísticas relacionadas
│
├── 5. Mescla matérias nas sources de cada claim
│
├── 6. [se claims sem evidência + frames disponíveis]
│      extractVideoContent(frames)  → complementa com análise visual
│
├── 7. rankSources(resultados)      → ordena fontes por reputação
│
├── 8. buildFinalResult(...)        → score + veredicto final
│
└── 9. [se ainda há claims sem conclusão]
       Segunda rodada de checkClaims + searchRelatedNews
```

### Sistema de Pontuação (`buildFinalResult.js`)

O score final é calculado somando pontos em 5 dimensões:

| Dimensão | Pontos |
|---|---|
| Reputação do site de origem | -2 a +2 |
| Estrutura das afirmações | -2 a +2 |
| Qualidade das fontes encontradas | -2 a +2 |
| Tipo de página (notícia/opinião/genérico) | -2 a +1 |
| Taxa de afirmações confirmadas | -3 a +3 |

**Conversão de pontos para veredicto:**
- ≥ 8 pontos → `true` (Alta confiabilidade)
- ≥ 4 pontos → `mixed` (Média confiabilidade)
- ≥ 1 ponto → `mixed` (Baixa confiabilidade)
- < 1 ponto → `false` (Provável fake news)

### Reputação de Domínios

- **Whitelist** (+2 pts): G1, BBC, CNN Brasil, Folha, Estadão, Reuters, AP News, etc.
- **Yellowlist** (+1 pt): Terra, IG, Metrópoles, Jovem Pan, etc.
- **Blacklist** (-2 pts): InfoWars, Natural News, Before It's News, etc.
- **Desconhecido** (+0.5 pts)

---

## Autenticação

### Fluxo de Login com E-mail

1. Usuário preenche e-mail e senha
2. `POST /login` verifica hash bcrypt
3. Resposta inclui `email` e `nome`
4. Dados salvos em `chrome.storage.local`

### Fluxo de Login com Google

1. Extensão usa `chrome.identity.getAuthToken` (OAuth2)
2. `POST /login-google` cria conta automaticamente se não existir
3. Senha armazenada como `"google-oauth"` (não usada para login)

### Recuperação de Senha

1. `POST /recuperar-senha` → gera token de 6 dígitos, válido por 15 minutos
2. Token enviado por e-mail via Nodemailer
3. `POST /redefinir-senha` → valida token e atualiza hash bcrypt
4. Token marcado como `usado = 1` após uso

---

## API Reference

### `POST /register`
Cadastra novo usuário.

**Body:** `{ email, senha, nome }`  
**Respostas:** `201` sucesso | `409` e-mail já cadastrado | `400` campos faltando

---

### `POST /login`
Autentica usuário com e-mail e senha.

**Body:** `{ email, senha }`  
**Resposta 200:** `{ mensagem, email, nome }`

---

### `POST /login-google`
Autentica ou cria usuário via Google OAuth.

**Body:** `{ email, nome }`  
**Resposta 200:** `{ mensagem, email, nome }`

---

### `POST /salvar-configs`
Salva configurações de acessibilidade do usuário.

**Body:** `{ email, configs: { toggles: { contraste, tema, leitornoticias }, fontSize } }`

---

### `POST /carregar-configs`
Retorna configurações salvas do usuário.

**Body:** `{ email }`  
**Resposta 200:** `{ configs }`

---

### `POST /recuperar-senha`
Envia código de recuperação por e-mail.

**Body:** `{ email }`

---

### `POST /redefinir-senha`
Redefine a senha usando o código recebido.

**Body:** `{ token, novaSenha }`

---

### `POST /analisar`
Endpoint principal de análise de conteúdo.

**Body:**
```json
{
  "text": "conteúdo da página",
  "title": "título",
  "url": "https://...",
  "siteName": "Nome do site",
  "foundLinks": [],
  "imageUrl": "https://...",
  "platform": "web | youtube | instagram | twitter | tiktok | facebook",
  "hasMultipleTopics": false,
  "sourceHandle": "@canal",
  "sourceUrl": "https://...",
  "frames": []
}
```

**Resposta 200:**
```json
{
  "pageType": "news_article | generic | search | opiniao",
  "summary": "Resumo da análise",
  "overallVerdict": "true | false | mixed | unverifiable",
  "confidenceLabel": "alta | média | baixa",
  "confidenceScore": 85,
  "pontuacao": 7.5,
  "claims": [
    {
      "text": "afirmação verificada",
      "verdict": "supported | disputed | mixed | insufficient_evidence | not_checkable",
      "sources": [
        {
          "title": "G1",
          "url": "https://g1.globo.com/...",
          "sourceType": "primary",
          "snippet": "Trecho relevante da fonte"
        }
      ]
    }
  ],
  "links": [],
  "warnings": [],
  "source": null
}
```
