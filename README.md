# VerusAI

Extensão de navegador + servidor para análise e checagem de notícias com IA.

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
    │   │   ├── features/  # Funcionalidades (leitor, destaques, compartilhar...)
    │   │   ├── services/  # Extração de página, API, storage
    │   │   ├── ui/        # Sidebar, botão, popup de login, selo de fonte
    │   │   └── chat/      # Chat dentro da sidebar
    │   ├── pages/         # Páginas da extensão (login, registro, configurações, chat)
    │   └── shared/        # Ícones e CSS compartilhados entre as páginas
    └── server/            # Backend Node.js/Express
        ├── server.js      # Ponto de entrada: monta o Express e registra as rotas
        ├── db.js          # Banco SQLite, tabelas e migrações
        ├── lib/           # Helpers genéricos (utils) e envio de e-mail
        ├── services/      # Regras de negócio, agrupadas por domínio
        │   ├── ai-services/   # Etapas de IA do pipeline (classificação, claims, build final)
        │   ├── pipeline/      # Orquestração da análise (runPipeline)
        │   ├── analises/      # Ciclo de vida da análise salva (montar, mesclar, salvar)
        │   ├── comunidade/    # Feedback, selos e avaliação de fontes pelos usuários
        │   ├── integracoes/   # Serviços externos (Google News, link preview, cache)
        │   └── sessoes.js     # Sessões de usuário
        ├── routes/        # Rotas Express agrupadas por domínio
        └── data/          # Dados curados (presidentes)
```

## Como rodar

1. Instale as dependências: `npm install`
2. Crie um arquivo `.env` na raiz com as credenciais (e-mail, chaves de API etc.)
3. Inicie o servidor: `npm start` — sobe em `http://localhost:3000` (site em `/site`)
4. Carregue a extensão no Chrome: `chrome://extensions` → "Carregar sem compactação" → selecione a **pasta raiz do projeto** (onde está o `manifest.json`)

> Após esta reorganização de pastas, recarregue a extensão no Chrome
> (`chrome://extensions` → botão de atualizar) para os novos caminhos valerem.

## Banco de dados

O arquivo `verusai.db` (SQLite) é criado automaticamente na raiz ao iniciar o
servidor e está no `.gitignore` — não é versionado.
