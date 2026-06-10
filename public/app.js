/* VerusAI — app.js */

const API_URL = "https://api.anthropic.com/v1/messages";
const POR_PAGINA = 9;
const LINK_PREVIEW_DELAY = 360;
const FONTE_NULA = "__fonte_nula__";
const FEEDBACK_STORAGE_PREFIX = "verus_feedback_noticia_v1:";
const FONTES_OFICIAIS = [
  null,
  "IBGE",
  "BancoCentral",
  "IPEA",
  "CVM",
  "TesouroNacional",
  "DadosAbertos",
  "Planalto",
  "Camara",
  "Senado",
  "TSE",
  "STF",
  "STJ",
  "CNJ",
  "DataSUS",
  "Anvisa",
  "SciELO",
  "CrossRef",
  "OpenAlex",
  "WorldBank",
  "ONU",
  "OMS",
  "FMI",
  "Outro",
];
const FONTE_ALIASES = {
  bancocentraldobrasil: "bancocentral",
  camara: "camara",
  camaradosdeputados: "camara",
  senadofederal: "senado",
  tesouronacional: "tesouronacional",
  dadosabertos: "dadosabertos",
  datasus: "datasus",
  scielo: "scielo",
  crossref: "crossref",
  openalex: "openalex",
  worldbank: "worldbank",
  bancomundial: "worldbank",
  organizacaodasnacoesunidas: "onu",
  organizacaomundialdasaude: "oms",
};
const FONTES_OFICIAIS_NORMALIZADAS = new Set(
  FONTES_OFICIAIS
    .filter(fonte => fonte !== null && fonte !== "Outro")
    .map(fonte => normalizarFonte(fonte))
);

let todasAnalises = [];
let filtradas = [];
let paginaAtual = 1;
let filtroAtivo = "";
let buscaAtiva = "";
let dataInicioAtiva = "";
let dataFimAtiva = "";
let fonteAtiva = "";
let ordenacaoAtiva = "recentes";
let previewCardEl = null;
let previewCardAtivo = null;
let previewFrameId = null;
let linkPreviewEl = null;
let linkPreviewAnchor = null;
let linkPreviewUrl = "";
let linkPreviewTimer = null;
let linkPreviewHideTimer = null;
let linkPreviewLastMouse = { x: 0, y: 0 };
const linkPreviewCache = new Map();
let feedbackAuthState = {
  carregado: false,
  logado: false,
  email: "",
  nome: "",
  authToken: "",
};
let feedbackAuthWaiters = [];

// ─── Dados de demonstração (substitua pela sua API real) ───────────────────
const DEMO_DATA = [
  {
    id: "1", url: "https://exemplo.com/noticia-1",
    title: "Vacina contra COVID-19 causa alteração genética permanente",
    summary: "Afirmação viral nas redes sociais diz que as vacinas de mRNA modificam o DNA humano de forma irreversível.",
    veracity: "false",
    sources: ["OMS", "Fiocruz", "Nature"],
    date: "2025-03-12"
  },
  {
    id: "2", url: "https://exemplo.com/noticia-2",
    title: "Brasil registrou recorde de energia solar em 2024",
    summary: "Segundo dados da ANEEL, a geração de energia solar fotovoltaica atingiu novo patamar histórico no país.",
    veracity: "true",
    sources: ["ANEEL", "G1", "Folha de SP"],
    date: "2025-04-01"
  },
  {
    id: "3", url: "https://exemplo.com/noticia-3",
    title: "Governo federal corta 30% do orçamento da educação",
    summary: "A afirmação mistura dados reais de contingenciamento com interpretações equivocadas sobre o total investido.",
    veracity: "mixed",
    sources: ["Câmara dos Deputados", "Agência Brasil"],
    date: "2025-02-28"
  },
  {
    id: "4", url: "https://exemplo.com/noticia-4",
    title: "Nova lei permite prisão por comentários no WhatsApp",
    summary: "Não existe nenhuma legislação brasileira que preveja prisão automática por mensagens em aplicativos.",
    veracity: "false",
    sources: ["STF", "Senado Federal"],
    date: "2025-03-20"
  },
  {
    id: "5", url: "https://exemplo.com/noticia-5",
    title: "Inflação acumulada em 12 meses chega a 5,8%",
    summary: "Dado confirmado pelo IBGE no relatório oficial do IPCA divulgado em abril de 2025.",
    veracity: "true",
    sources: ["IBGE", "Banco Central"],
    date: "2025-04-10"
  },
  {
    id: "6", url: "https://exemplo.com/noticia-6",
    title: "Governo anuncia isenção total do IR para quem ganha até R$ 5.000",
    summary: "A proposta ainda está em discussão no Congresso e não foi aprovada. Há nuances importantes no texto.",
    veracity: "mixed",
    sources: ["Receita Federal", "Câmara", "UOL"],
    date: "2025-04-05"
  },
  {
    id: "7", url: "https://exemplo.com/noticia-7",
    title: "Água de torneira causa câncer segundo estudo americano",
    summary: "O suposto estudo não existe em nenhuma publicação científica indexada. Desinformação recorrente.",
    veracity: "false",
    sources: ["PubMed", "CDC", "ANVISA"],
    date: "2025-01-18"
  },
  {
    id: "8", url: "https://exemplo.com/noticia-8",
    title: "Taxa de desemprego cai para 6,5% no primeiro trimestre",
    summary: "Dado confirmado pela PNAD Contínua do IBGE referente ao primeiro trimestre de 2025.",
    veracity: "true",
    sources: ["IBGE", "Ministério do Trabalho"],
    date: "2025-04-22"
  },
  {
    id: "9", url: "https://exemplo.com/noticia-9",
    title: "China proibiu uso do ChatGPT em todo o território nacional",
    summary: "A China impõe restrições ao ChatGPT, mas existem versões locais aprovadas e o bloqueio não é absoluto.",
    veracity: "mixed",
    sources: ["Reuters", "BBC", "SCMP"],
    date: "2025-03-08"
  }
];

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  injetarTicker();
  preencherHeroComunidade();
  carregarAnalises();
  carregarDestaque();
  configurarBusca();
  configurarFiltros();
  configurarFiltrosAvancados();
  configurarModal();
  configurarSobre();
  configurarAdmin();
  configurarLinkPreview();
  configurarAnimacoes();
  configurarAbas();
  configurarAoVivo();
  configurarFontes();
  configurarAnalisarLink();
  configurarTransparencia();
  configurarAnaliseViaUrl();
});

let revealObserver = null;

function configurarAnimacoes() {
  document.body.classList.add("page-ready");
  document.querySelectorAll(".filtros, .stats, .grid").forEach(el => {
    el.classList.add("reveal-section");
  });

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal-section, .reveal-card").forEach(el => {
      el.classList.add("in-view");
    });
    return;
  }

  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.16,
    rootMargin: "0px 0px -8% 0px",
  });

  observarAnimacoes(document);
}

function observarAnimacoes(root) {
  const scope = root || document;
  const alvos = [];

  if (scope.matches && scope.matches(".reveal-section, .reveal-card")) {
    alvos.push(scope);
  }

  if (scope.querySelectorAll) {
    alvos.push(...scope.querySelectorAll(".reveal-section, .reveal-card"));
  }

  alvos.forEach(el => {
    if (el.dataset.revealObserved) return;
    el.dataset.revealObserved = "true";
    if (revealObserver) {
      revealObserver.observe(el);
    } else {
      el.classList.add("in-view");
    }
  });
}

// ─── Destaque: notícia com mais likes ──────────────────────────────────────
async function carregarDestaque() {
  try {
    const res = await fetch("/api/analises/mais-curtidas?limite=1");
    if (!res.ok) return;
    const data = await res.json();
    const analise = data.analises?.[0];
    if (!analise) return;
    renderizarDestaque(analise);
  } catch {}
}

function renderizarDestaque(analise) {
  const section = document.getElementById("destaqueLikes");
  if (!section) return;

  const label = { true: "✅ Verdadeiro", false: "❌ Falso", mixed: "⚠️ Misto" };
  const host = tentarHost(analise.url);
  const data = analise.date ? formatarData(analise.date) : "";
  const likes = analise.total_likes || 0;

  section.innerHTML = `
    <div class="dl-inner" role="button" tabindex="0" aria-label="Abrir análise em destaque: ${escapeHTML(analise.title)}">
      <div class="dl-badge-col">
        <span class="dl-badge">Mais curtida</span>
        <span class="dl-likes">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          ${likes} ${likes === 1 ? "curtida" : "curtidas"}
        </span>
      </div>
      <div class="dl-content">
        <div class="dl-meta">
          <span class="dl-veracity ${analise.veracity}">${label[analise.veracity] || analise.veracity}</span>
          <span class="dl-source">${escapeHTML(host)}</span>
          ${data ? `<time class="dl-date">${escapeHTML(data)}</time>` : ""}
        </div>
        <h2 class="dl-title">${escapeHTML(analise.title)}</h2>
        ${analise.summary ? `<p class="dl-summary">${escapeHTML(analise.summary)}</p>` : ""}
      </div>
      <div class="dl-arrow" aria-hidden="true">→</div>
    </div>
  `;

  section.hidden = false;

  const inner = section.querySelector(".dl-inner");
  inner.addEventListener("click", () => abrirModal(analise));
  inner.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    abrirModal(analise);
  });

  observarAnimacoes(section);
}

// ─── Mais checadas da semana (destaque editorial de checagens no período) ────
async function carregarMaisChecadas() {
  try {
    const res = await fetch("/api/analises/trending?dias=7&limite=3");
    if (!res.ok) return;
    const data = await res.json();
    renderizarMaisChecadas(data.analises || []);
  } catch {}
}

function renderizarMaisChecadas(analises) {
  const section = document.getElementById("maisChecadas");
  if (!section) return;

  if (!analises.length) {
    section.hidden = true;
    return;
  }

  const label = { true: "Verdadeiro", false: "Falso", mixed: "Misto" };
  const stat = (n, sing, plur) =>
    `<strong>${n}</strong> <span>${n === 1 ? sing : plur}</span>`;

  const itens = analises
    .slice(0, 3)
    .map((a, i) => {
      const checagens = a.verificacoes || 1;
      const likes = a.total_likes || 0;
      const comentarios = a.total_comentarios || 0;
      const resumo = a.summary || a.resumo || "";
      const fonte = a.veiculo || a.paginaOrigem || tentarHost(a.url);
      const data = a.date ? formatarData(a.date) : "";
      const score = Number.isFinite(Number(a.score)) ? Number(a.score) : null;
      return `
      <li class="mc-item reveal-card" data-idx="${i}" data-url="${escapeHTML(a.url)}">
        <span class="mc-rank">${i + 1}</span>
        <div class="mc-body">
          <div class="mc-head">
            <div class="mc-head-text">
              <button class="mc-titulo" type="button" data-idx="${i}">
                ${escapeHTML(a.title)}
              </button>
              <div class="mc-meta">
                <span class="mc-veracity ${a.veracity}">${label[a.veracity] || a.veracity}</span>
                ${fonte ? `<span class="mc-source">${escapeHTML(fonte)}</span>` : ""}
                ${data ? `<time class="mc-date">${escapeHTML(data)}</time>` : ""}
              </div>
            </div>
            ${
              score !== null
                ? `<div class="mc-score ${a.veracity}" title="Índice de confiabilidade">
                     <span class="mc-score-num">${score}</span>
                     <span class="mc-score-cap">confiança</span>
                   </div>`
                : ""
            }
          </div>
          ${resumo ? `<p class="mc-summary">${escapeHTML(resumo)}</p>` : ""}
          <div class="mc-stats">
            <span class="mc-stat" title="Quantas vezes esta notícia foi checada">${stat(checagens, "checagem", "checagens")}</span>
            <span class="mc-stat" title="Curtidas da comunidade">${stat(likes, "like", "likes")}</span>
            <span class="mc-stat" title="Comentários da comunidade">${stat(comentarios, "comentário", "comentários")}</span>
            ${
              comentarios
                ? `<button class="mc-vermais" type="button" aria-expanded="false">Ver comentários</button>`
                : ""
            }
          </div>
          <div class="mc-detalhe" hidden></div>
        </div>
      </li>`;
    })
    .join("");

  section.innerHTML = `
    <header class="mc-header">
      <h2 class="mc-h">Mais checadas</h2>
      <p class="mc-criterio">Ranking pelo nº de verificações e pelo engajamento da comunidade.</p>
    </header>
    <ol class="mc-lista">${itens}</ol>`;
  section.hidden = false;

  // Título abre a análise completa no modal.
  section.querySelectorAll(".mc-titulo").forEach(btn => {
    const analise = analises[Number(btn.dataset.idx)];
    if (analise) btn.addEventListener("click", () => abrirModal(analise));
  });

  // "Ver comentários" carrega e mostra os comentários da notícia (lazy).
  section.querySelectorAll(".mc-vermais").forEach(btn => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".mc-item");
      const detalhe = item?.querySelector(".mc-detalhe");
      if (!detalhe) return;

      if (!detalhe.hidden) {
        detalhe.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "Ver comentários";
        return;
      }

      detalhe.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "Ocultar comentários";

      if (detalhe.dataset.carregado) return;
      detalhe.innerHTML = `<p class="mc-coment-info">Carregando comentários…</p>`;
      try {
        const res = await fetch(
          `/api/analises/feedback?url=${encodeURIComponent(item.dataset.url)}`,
        );
        const data = await res.json();
        detalhe.innerHTML = renderizarComentariosMaisChecadas(data.comentarios || []);
        detalhe.dataset.carregado = "1";
      } catch {
        detalhe.innerHTML = `<p class="mc-coment-info">Não foi possível carregar os comentários.</p>`;
      }
    });
  });

  observarAnimacoes(section);
}

// Lista de comentários (somente leitura) exibida ao expandir um item de
// "Mais checadas". Reaproveita os normalizadores do feedback do modal.
function renderizarComentariosMaisChecadas(comentarios) {
  const lista = normalizarComentariosFeedback(comentarios);
  if (!lista.length) {
    return `<p class="mc-coment-info">Ainda não há comentários nesta checagem.</p>`;
  }

  const itens = lista
    .map(c => {
      const autor = c.proprioUsuario ? "Você" : c.usuarioNome;
      const data = formatarDataFeedback(c.atualizadoEm);
      const iniciais = iniciaisUsuarioFeedback(autor);
      const reacao =
        c.reacao === "like"
          ? "curtiu"
          : c.reacao === "dislike"
            ? "não curtiu"
            : "";
      return `
        <li class="mc-coment">
          <span class="mc-coment-avatar" aria-hidden="true">${escapeHTML(iniciais)}</span>
          <div class="mc-coment-body">
            <div class="mc-coment-head">
              <strong>${escapeHTML(autor)}</strong>
              ${selosComentarioHTML(c.selos)}
              ${reacao ? `<span class="mc-coment-reacao">${reacao}</span>` : ""}
              ${data ? `<time class="mc-coment-data">${escapeHTML(data)}</time>` : ""}
            </div>
            <p class="mc-coment-texto">${escapeHTML(c.comentario)}</p>
          </div>
        </li>`;
    })
    .join("");

  return `<ul class="mc-coments">${itens}</ul>`;
}

// ─── Ticker ────────────────────────────────────────────────────────────────
function injetarTicker() {
  const main = document.querySelector(".main");
  const hero = document.querySelector(".hero");
  if (!main || !hero) return;

  const mensagens = [
    "Verificação independente de notícias",
    "Mais de 1.000 análises publicadas",
    "Fontes verificadas e referenciadas",
    "Combate à desinformação",
    "Transparência editorial",
    "Fact-checking de qualidade",
  ];

  const ticker = document.createElement("div");
  ticker.className = "ticker reveal-section";
  ticker.innerHTML = `
    <div class="ticker-track" aria-hidden="true">
      ${[...mensagens, ...mensagens].map(m => `<span>${m}</span>`).join("")}
    </div>
  `;
  hero.insertAdjacentElement("afterend", ticker);
  observarAnimacoes(ticker);
}

// ─── Carregar análises ─────────────────────────────────────────────────────
async function carregarAnalises() {
  renderizarGrid([]);
  document.getElementById("grid").innerHTML =
    `<div class="loading">Carregando análises…</div>`;

  try {
    const res = await fetch("/api/analises?limite=500");
    if (!res.ok) throw new Error("Erro ao carregar analises");
    const data = await res.json();
    todasAnalises = (data.analises || []).map(normalizarAnaliseApi);
    preencherFiltroFontes();
    aplicarFiltros();
    renderizarDashboard(todasAnalises);
  } catch (err) {
    console.error("[site] erro ao carregar analises:", err);
    todasAnalises = [];
    filtradas = [];
    renderizarStats([]);
    renderizarDashboard([]);
    document.getElementById("grid").innerHTML = `
      <div class="vazio">
        <p>Nenhuma analise publicada ainda.</p>
      </div>`;
    document.getElementById("paginacao").innerHTML = "";
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────
function renderizarStats(base = filtradas) {
  const dados = Array.isArray(base) ? base : [];
  const total   = dados.length;
  const trueCt  = dados.filter(a => a.veracity === "true").length;
  const mixedCt = dados.filter(a => a.veracity === "mixed").length;
  const falseCt = dados.filter(a => a.veracity === "false").length;

  document.getElementById("stats").innerHTML = `
    <div class="stat-item reveal-section">
      <span class="stat-num">${total}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat-item reveal-section">
      <span class="stat-num">${trueCt}</span>
      <span class="stat-label">✅ Verdadeiros</span>
    </div>
    <div class="stat-item reveal-section">
      <span class="stat-num">${mixedCt}</span>
      <span class="stat-label">⚠️ Mistos</span>
    </div>
    <div class="stat-item reveal-section">
      <span class="stat-num">${falseCt}</span>
      <span class="stat-label">❌ Falsos</span>
    </div>
  `;

  // Anima os números
  document.querySelectorAll(".stat-num").forEach(el => {
    const target = parseInt(el.textContent, 10);
    if (!isNaN(target)) animarNumero(el, target);
  });

  observarAnimacoes(document.getElementById("stats"));
}

function animarNumero(el, target) {
  let start = 0;
  const dur = 900;
  const t0 = performance.now();
  function step(now) {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── Dashboard / Panorama ────────────────────────────────────────────────────
// Visão geral do banco inteiro (não dos filtros): distribuição por veracidade,
// volume por mês e ranking de veículos. Renderizado uma vez ao carregar.
function renderizarDashboard(base = todasAnalises) {
  const el = document.getElementById("dashboard");
  if (!el) return;

  const dados = Array.isArray(base) ? base.filter(Boolean) : [];
  const total = dados.length;

  if (!total) {
    el.innerHTML = `
      <div class="dash-head">
        <span class="dash-eyebrow">Panorama</span>
        <h2 class="dash-title">Dashboard</h2>
      </div>
      <div class="dash-destaque">
        <div class="dash-bignum"><strong>0</strong><span>análises publicadas</span></div>
        <div class="dash-bignum"><strong id="dashUsuarios">—</strong><span>usuários cadastrados</span></div>
        <div class="dash-bignum"><strong id="dashAnalistas">—</strong><span>já fizeram análises</span></div>
      </div>
      <p class="dash-rank-empty">Ainda não há análises para resumir.</p>`;
    preencherDashboardUsuarios();
    return;
  }

  const trueCt = dados.filter(a => a.veracity === "true").length;
  const mixedCt = dados.filter(a => a.veracity === "mixed").length;
  const falseCt = dados.filter(a => a.veracity === "false").length;

  const comScore = dados.filter(a => Number.isFinite(Number(a.score)));
  const scoreMedio = comScore.length
    ? Math.round(comScore.reduce((s, a) => s + Number(a.score), 0) / comScore.length)
    : null;
  const pctFalso = total ? Math.round((falseCt / total) * 100) : 0;
  const pctVerdade = total ? Math.round((trueCt / total) * 100) : 0;
  const veiculos = new Set(dados.map(_hostDaAnalise).filter(Boolean)).size;

  el.innerHTML = `
    <div class="dash-head">
      <span class="dash-eyebrow">Panorama</span>
      <h2 class="dash-title">Dashboard</h2>
    </div>
    <div class="dash-destaque">
      <div class="dash-bignum"><strong>${total}</strong><span>análises publicadas</span></div>
      <div class="dash-bignum"><strong id="dashUsuarios">—</strong><span>usuários cadastrados</span></div>
      <div class="dash-bignum"><strong id="dashAnalistas">—</strong><span>já fizeram análises</span></div>
      ${
        scoreMedio !== null
          ? `<div class="dash-bignum"><strong>${scoreMedio}<small>/100</small></strong><span>confiabilidade média</span></div>`
          : ""
      }
    </div>
    <div class="dash-grid">
      <article class="dash-card dash-card--donut">
        <h3>Distribuição por veracidade</h3>
        ${montarDashDonut(total, trueCt, mixedCt, falseCt)}
        <p class="dash-card-nota">${pctVerdade}% verdadeiras · ${pctFalso}% falsas${
          scoreMedio !== null ? ` · confiabilidade média ${scoreMedio}/100` : ""
        }</p>
      </article>
      <article class="dash-card dash-card--months">
        <h3>Análises por mês</h3>
        ${montarDashMeses(dados)}
        <p class="dash-card-nota">Cada barra divide o mês em ✅ verdadeiras, ⚠️ mistas e ❌ falsas.</p>
      </article>
      <article class="dash-card">
        <h3>Veículos mais checados</h3>
        ${montarDashRank(dados, false)}
        <p class="dash-card-nota">${veiculos} veículo${veiculos === 1 ? "" : "s"} diferente${veiculos === 1 ? "" : "s"} já ${veiculos === 1 ? "checado" : "checados"}.</p>
      </article>
      <article class="dash-card">
        <h3>Veículos com mais conteúdo falso</h3>
        ${montarDashRank(dados, true)}
        <p class="dash-card-nota">${falseCt} de ${total} análises (${pctFalso}%) tiveram veredito falso.</p>
      </article>
      <article class="dash-card dash-card--wide">
        <h3>Quem já analisou</h3>
        <div id="dashAnalistasLista"><p class="dash-rank-empty">Carregando…</p></div>
      </article>
    </div>
  `;

  // Só anima de imediato se a sub-aba "Dashboard" já estiver visível;
  // caso contrário a animação roda quando o usuário abrir a sub-aba.
  if (document.body.classList.contains("sub-numeros")) {
    animarDashboard(el);
  }
  preencherDashboardUsuarios();
}

// Preenche os números de usuários no topo do Dashboard e a lista de quem já
// realizou análises (com nome). Busca uma vez e reaproveita no mesmo carregamento.
let _dashUsuariosCache = null;
async function obterEstatisticasUsuarios() {
  if (!_dashUsuariosCache) {
    const res = await fetch("/api/usuarios/estatisticas");
    if (!res.ok) throw new Error("falha");
    _dashUsuariosCache = await res.json();
  }
  return _dashUsuariosCache;
}

// Nº de membros da comunidade no card do hero. Cresce a cada novo registro.
async function preencherHeroComunidade() {
  const el = document.getElementById("heroComunidadeNum");
  if (!el) return;
  try {
    const data = await obterEstatisticasUsuarios();
    el.textContent = Number(data.totalUsuarios || 0).toLocaleString("pt-BR");
  } catch {
    el.textContent = "milhares";
  }
}

async function preencherDashboardUsuarios() {
  const elTotal = document.getElementById("dashUsuarios");
  const elAnalistas = document.getElementById("dashAnalistas");
  const elLista = document.getElementById("dashAnalistasLista");
  try {
    const data = await obterEstatisticasUsuarios();
    if (elTotal) elTotal.textContent = Number(data.totalUsuarios || 0);
    if (elAnalistas) elAnalistas.textContent = Number(data.totalAnalistas || 0);
    if (elLista) {
      const lista = data.analistas || [];
      elLista.innerHTML = lista.length
        ? `<ol class="dash-analistas">${lista
            .map(
              (a, i) => `
            <li class="dash-analista">
              <span class="dash-analista-pos">${i + 1}</span>
              <span class="dash-analista-nome">${escapeHTML(a.nome)}</span>
              <span class="dash-analista-total">${a.total} análise${a.total === 1 ? "" : "s"}</span>
            </li>`,
            )
            .join("")}</ol>`
        : `<p class="dash-rank-empty">As análises feitas a partir de agora aparecerão aqui com o nome de quem as realizou.</p>`;
    }
  } catch {
    if (elTotal) elTotal.textContent = "—";
    if (elAnalistas) elAnalistas.textContent = "—";
    if (elLista) {
      elLista.innerHTML = `<p class="dash-rank-empty">Não foi possível carregar os usuários.</p>`;
    }
  }
}

function montarDashDonut(total, trueCt, mixedCt, falseCt) {
  const segs = [
    { cls: "true", label: "Verdadeiros", color: "#1a7a3c", n: trueCt },
    { cls: "mixed", label: "Mistos", color: "#b07800", n: mixedCt },
    { cls: "false", label: "Falsos", color: "#d3392d", n: falseCt },
  ];

  // Truque do raio 15.915: circunferência ≈ 100, então o dasharray vira % direto.
  let cum = 0;
  const arcos = segs
    .filter(s => s.n > 0)
    .map(s => {
      const pct = (s.n / total) * 100;
      const dash = `${pct.toFixed(2)} ${(100 - pct).toFixed(2)}`;
      const off = (25 - cum).toFixed(2);
      cum += pct;
      return `<circle class="dash-donut-seg" cx="21" cy="21" r="15.915" fill="transparent"
        stroke="${s.color}" stroke-width="4" style="stroke-dasharray:0 100"
        stroke-dashoffset="${off}" data-dash="${dash}"></circle>`;
    })
    .join("");

  const legenda = segs
    .map(s => `
      <li class="dash-legend-item dash-legend--${s.cls}">
        <span class="dash-legend-dot"></span>
        <span class="dash-legend-label">${s.label}</span>
        <span class="dash-legend-val">${s.n} · ${Math.round((s.n / total) * 100)}%</span>
      </li>`)
    .join("");

  return `
    <div class="dash-donut-wrap">
      <svg class="dash-donut" viewBox="0 0 42 42" role="img" aria-label="Distribuição por veracidade das análises">
        <circle class="dash-donut-track" cx="21" cy="21" r="15.915" fill="transparent"></circle>
        ${arcos}
      </svg>
      <div class="dash-donut-center">
        <strong>${total}</strong>
        <span>análises</span>
      </div>
    </div>
    <ul class="dash-legend">${legenda}</ul>
  `;
}

function montarDashMeses(dados) {
  const mapa = new Map();
  dados.forEach(a => {
    const ym = String(a.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const cur = mapa.get(ym) || { t: 0, m: 0, f: 0, total: 0 };
    if (a.veracity === "true") cur.t++;
    else if (a.veracity === "false") cur.f++;
    else cur.m++;
    cur.total++;
    mapa.set(ym, cur);
  });

  const chaves = Array.from(mapa.keys()).sort().slice(-8);
  if (!chaves.length) {
    return `<p class="dash-rank-empty">Sem datas suficientes para o gráfico.</p>`;
  }

  const maxTotal = Math.max(...chaves.map(k => mapa.get(k).total));
  const colunas = chaves
    .map(k => {
      const d = mapa.get(k);
      const hPct = maxTotal ? (d.total / maxTotal) * 100 : 0;
      const titulo = `${_mesLongo(k)}: ${d.total} análise${d.total === 1 ? "" : "s"} (✅ ${d.t} · ⚠️ ${d.m} · ❌ ${d.f})`;
      return `
        <div class="dash-bar-col">
          <div class="dash-bar-track">
            <div class="dash-bar" style="height:0" data-h="${hPct.toFixed(1)}" title="${escapeHTML(titulo)}">
              <span class="seg seg-t" style="flex:${d.t} 1 0"></span>
              <span class="seg seg-m" style="flex:${d.m} 1 0"></span>
              <span class="seg seg-f" style="flex:${d.f} 1 0"></span>
            </div>
          </div>
          <span class="dash-bar-label">${_mesCurto(k)}</span>
        </div>`;
    })
    .join("");

  return `<div class="dash-bars">${colunas}</div>`;
}

function montarDashRank(dados, somenteFalsos) {
  const tally = new Map();
  dados.forEach(a => {
    if (somenteFalsos && a.veracity !== "false") return;
    const host = _hostDaAnalise(a);
    if (!host) return;
    tally.set(host, (tally.get(host) || 0) + 1);
  });

  const itens = Array.from(tally.entries())
    .map(([host, n]) => ({ host, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, somenteFalsos ? 5 : 6);

  if (!itens.length) {
    return `<p class="dash-rank-empty">${
      somenteFalsos
        ? "Nenhum conteúdo falso registrado. 🎉"
        : "Sem veículos identificados ainda."
    }</p>`;
  }

  const max = itens[0].n || 1;
  const classe = somenteFalsos ? "dash-rank dash-rank--red" : "dash-rank";
  return `<ul class="${classe}">${itens
    .map(it => `
      <li class="dash-rank-item">
        <span class="dash-rank-name" title="${escapeHTML(it.host)}">${escapeHTML(it.host)}</span>
        <span class="dash-rank-bar"><span style="width:0" data-w="${((it.n / max) * 100).toFixed(1)}"></span></span>
        <span class="dash-rank-val">${it.n}</span>
      </li>`)
    .join("")}</ul>`;
}

function _hostDaAnalise(a) {
  // Prefere o nome da página de origem (ex.: perfil do Instagram, "G1");
  // cai para o domínio do link quando não há veículo.
  const veiculo = a && a.veiculo ? String(a.veiculo).trim() : "";
  if (veiculo) return veiculo;
  const url = a && a.url ? String(a.url) : "";
  if (/^https?:\/\//i.test(url)) {
    const h = tentarHost(url);
    if (h) return h;
  }
  if (a && Array.isArray(a.sources) && a.sources.length) {
    return String(a.sources[0]).slice(0, 40);
  }
  return "";
}

function _mesCurto(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function _mesLongo(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Anima barras e arcos a partir do zero. Reseta para 0 e, após o paint,
// aplica os valores finais — assim a animação roda toda vez que a sub-aba abre.
function animarDashboard(el) {
  if (!el) return;
  el.querySelectorAll(".dash-donut-seg").forEach(seg => {
    seg.style.strokeDasharray = "0 100";
  });
  el.querySelectorAll(".dash-bar").forEach(bar => {
    bar.style.height = "0%";
  });
  el.querySelectorAll(".dash-rank-bar > span").forEach(s => {
    s.style.width = "0";
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.querySelectorAll(".dash-donut-seg").forEach(seg => {
        if (seg.dataset.dash) seg.style.strokeDasharray = seg.dataset.dash;
      });
      el.querySelectorAll(".dash-bar").forEach(bar => {
        if (bar.dataset.h != null) bar.style.height = bar.dataset.h + "%";
      });
      el.querySelectorAll(".dash-rank-bar > span").forEach(s => {
        if (s.dataset.w != null) s.style.width = s.dataset.w + "%";
      });
    });
  });
}

// ─── Sub-abas de Análises (cascata: lista x dashboard) ───────────────────────
function setSubAba(sub) {
  const numeros = sub === "numeros";
  const checadas = sub === "checadas";
  document.body.classList.toggle("sub-numeros", numeros);
  document.body.classList.toggle("sub-checadas", checadas);

  const menu = document.getElementById("analisesMenu");
  if (menu) {
    menu.querySelectorAll(".tab-menu-item").forEach(b => {
      b.classList.toggle("ativo", b.dataset.sub === sub);
    });
  }

  if (numeros) animarDashboard(document.getElementById("dashboard"));
  if (checadas) carregarMaisChecadas();
}

// Abre/fecha o menu cascata da aba "Análises". Sem argumento alterna o estado.
function abrirMenuAnalises(abrir) {
  const dd = document.getElementById("analisesDropdown");
  if (!dd) return;
  const aberto = abrir === undefined ? !dd.classList.contains("aberto") : abrir;
  dd.classList.toggle("aberto", aberto);
  const tab = document.getElementById("analisesTab");
  if (tab) tab.setAttribute("aria-expanded", aberto ? "true" : "false");
}

// ─── Filtros ───────────────────────────────────────────────────────────────
function configurarBusca() {
  document.getElementById("busca").addEventListener("input", e => {
    buscaAtiva = normalizarTexto(e.target.value);
    paginaAtual = 1;
    aplicarFiltros();
  });
}

function configurarFiltros() {
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      filtroAtivo = btn.dataset.v;
      paginaAtual = 1;
      aplicarFiltros();
    });
  });
}

function configurarFiltrosAvancados() {
  const dataInicio = document.getElementById("dataInicio");
  const dataFim = document.getElementById("dataFim");
  const fonteFiltro = document.getElementById("fonteFiltro");
  const ordenacaoFiltro = document.getElementById("ordenacaoFiltro");
  const limparFiltros = document.getElementById("limparFiltros");

  if (dataInicio) {
    dataInicio.addEventListener("change", e => {
      dataInicioAtiva = e.target.value;
      paginaAtual = 1;
      aplicarFiltros();
    });
  }

  if (dataFim) {
    dataFim.addEventListener("change", e => {
      dataFimAtiva = e.target.value;
      paginaAtual = 1;
      aplicarFiltros();
    });
  }

  if (fonteFiltro) {
    fonteFiltro.addEventListener("change", e => {
      fonteAtiva = e.target.value;
      paginaAtual = 1;
      aplicarFiltros();
    });
  }

  if (ordenacaoFiltro) {
    ordenacaoFiltro.addEventListener("change", e => {
      ordenacaoAtiva = e.target.value || "recentes";
      paginaAtual = 1;
      aplicarFiltros();
    });
  }

  if (limparFiltros) {
    limparFiltros.addEventListener("click", limparTodosFiltros);
  }
}

function preencherFiltroFontes() {
  const fonteFiltro = document.getElementById("fonteFiltro");
  if (!fonteFiltro) return;

  fonteFiltro.innerHTML = `<option value="">Todas as fontes</option>`;
  FONTES_OFICIAIS.forEach(fonte => {
    const option = document.createElement("option");
    option.value = valorFonteFiltro(fonte);
    option.textContent = fonte === null ? "null" : fonte;
    fonteFiltro.appendChild(option);
  });
}

function limparTodosFiltros() {
  filtroAtivo = "";
  buscaAtiva = "";
  dataInicioAtiva = "";
  dataFimAtiva = "";
  fonteAtiva = "";
  ordenacaoAtiva = "recentes";
  paginaAtual = 1;

  const busca = document.getElementById("busca");
  const dataInicio = document.getElementById("dataInicio");
  const dataFim = document.getElementById("dataFim");
  const fonteFiltro = document.getElementById("fonteFiltro");
  const ordenacaoFiltro = document.getElementById("ordenacaoFiltro");

  if (busca) busca.value = "";
  if (dataInicio) dataInicio.value = "";
  if (dataFim) dataFim.value = "";
  if (fonteFiltro) fonteFiltro.value = "";
  if (ordenacaoFiltro) ordenacaoFiltro.value = "recentes";

  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.classList.toggle("ativo", btn.dataset.v === "");
  });

  aplicarFiltros();
}

function aplicarFiltros() {
  filtradas = todasAnalises.filter(a => {
    const matchFiltro = filtroAtivo === "" || a.veracity === filtroAtivo;
    const matchBusca  = !buscaAtiva ||
      normalizarTexto(a.title).includes(buscaAtiva) ||
      normalizarTexto(a.url).includes(buscaAtiva) ||
      normalizarTexto(a.summary || "").includes(buscaAtiva) ||
      normalizarTexto(a.date || "").includes(buscaAtiva) ||
      normalizarTexto(a.date ? formatarData(a.date) : "").includes(buscaAtiva) ||
      (a.sources || []).some(fonte => normalizarTexto(fonte).includes(buscaAtiva));
    const matchData = dentroDoPeriodo(a.date);
    const matchFonte = fonteCombinaFiltro(a, fonteAtiva);
    return matchFiltro && matchBusca && matchData && matchFonte;
  });
  filtradas = ordenarAnalises(filtradas);
  renderizarStats(filtradas);
  renderizarGrid(paginaAtual);
  renderizarPaginacao();
}

function dentroDoPeriodo(dateStr) {
  if (!dataInicioAtiva && !dataFimAtiva) return true;
  if (!dateStr) return false;

  if (dataInicioAtiva && dateStr < dataInicioAtiva) return false;
  if (dataFimAtiva && dateStr > dataFimAtiva) return false;
  return true;
}

function ordenarAnalises(lista) {
  const ordenadas = [...lista];
  const pesoVeracidade = { true: 1, mixed: 2, false: 3 };

  ordenadas.sort((a, b) => {
    if (ordenacaoAtiva === "antigas") {
      return (a.date || "").localeCompare(b.date || "");
    }

    if (ordenacaoAtiva === "titulo") {
      return (a.title || "").localeCompare(b.title || "", "pt-BR");
    }

    if (ordenacaoAtiva === "veracidade") {
      return (pesoVeracidade[a.veracity] || 99) - (pesoVeracidade[b.veracity] || 99);
    }

    return (b.date || "").localeCompare(a.date || "");
  });

  return ordenadas;
}

// ─── Grid ──────────────────────────────────────────────────────────────────
function renderizarGrid(pagina) {
  const grid = document.getElementById("grid");
  ocultarPreviewCard();
  grid.innerHTML = "";

  if (filtradas.length === 0) {
    grid.innerHTML = `
      <div class="vazio">
        <p>Nenhuma análise encontrada para os filtros selecionados.</p>
      </div>`;
    return;
  }

  const inicio = (pagina - 1) * POR_PAGINA;
  const slice  = filtradas.slice(inicio, inicio + POR_PAGINA);

  slice.forEach((analise, i) => {
    const card = criarCard(analise, i);
    grid.appendChild(card);
  });

  observarAnimacoes(grid);
}

function criarCard(a, i) {
  const div = document.createElement("div");
  div.className = "card reveal-card";
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  div.setAttribute("aria-label", `Abrir analise: ${a.title || "noticia"}`);
  div.style.animationDelay = `${i * 0.06}s`;
  div.style.setProperty("--reveal-delay", `${i * 55}ms`);

  const label = { true: "✅ Verdadeiro", false: "❌ Falso", mixed: "⚠️ Misto" };
  const host  = a.veiculo || tentarHost(a.url);
  const data  = a.date ? formatarData(a.date) : "";
  div.innerHTML = `
    <div class="card-header">
      <span class="card-veracity ${a.veracity}">${label[a.veracity] || a.veracity}</span>
      <span class="card-source">${host}</span>
    </div>
    <h2>${escapeHTML(a.title)}</h2>
    ${a.summary ? `<p class="card-summary">${escapeHTML(a.summary)}</p>` : ""}
    <div class="card-footer">
      <span class="card-date">${data}</span>
      <span class="card-reacoes">
        <span class="card-likes" title="${a.total_likes} ${a.total_likes === 1 ? "curtida" : "curtidas"}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          ${a.total_likes}
        </span>
        <span class="card-dislikes" title="${a.total_dislikes} ${a.total_dislikes === 1 ? "descurtida" : "descurtidas"}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
          ${a.total_dislikes}
        </span>
      </span>
      <span class="card-arrow" aria-hidden="true">→</span>
    </div>
  `;

  div.addEventListener("mouseenter", () => mostrarPreviewCard(div, a));
  div.addEventListener("mousemove", () => posicionarPreviewCard(div));
  div.addEventListener("mouseleave", ocultarPreviewCard);
  div.addEventListener("focus", () => mostrarPreviewCard(div, a));
  div.addEventListener("blur", ocultarPreviewCard);
  div.addEventListener("click", () => {
    ocultarPreviewCard();
    abrirModal(a);
  });
  div.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    ocultarPreviewCard();
    abrirModal(a);
  });
  return div;
}

function garantirPreviewCard() {
  if (previewCardEl && document.body.contains(previewCardEl)) {
    return previewCardEl;
  }

  previewCardEl = document.createElement("div");
  previewCardEl.id = "site-card-preview";
  previewCardEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(previewCardEl);
  return previewCardEl;
}

function montarPreviewCard(a) {
  const label = { true: "Verdadeiro", false: "Falso", mixed: "Misto" };
  const data = a.date ? formatarData(a.date) : "";
  const resumo = a.summary || "Resumo indisponivel para esta analise.";
  const fontes = Array.isArray(a.sources) ? a.sources.slice(0, 3) : [];

  return `
    <div class="card-preview-meta">
      <span>${escapeHTML(label[a.veracity] || a.veracity || "Analise")}</span>
      ${data ? `<time>${escapeHTML(data)}</time>` : ""}
    </div>
    <strong>${escapeHTML(a.title)}</strong>
    <p>${escapeHTML(resumo)}</p>
    ${fontes.length ? `
      <div class="card-preview-sources">
        ${fontes.map(s => `<span>${escapeHTML(s)}</span>`).join("")}
      </div>
    ` : ""}
  `;
}

function mostrarPreviewCard(card, analise) {
  const preview = garantirPreviewCard();
  previewCardAtivo = card;
  preview.innerHTML = montarPreviewCard(analise);
  preview.classList.remove("visivel", "preview-left", "preview-top", "preview-bottom");
  preview.style.left = "0px";
  preview.style.top = "0px";

  if (previewFrameId) cancelAnimationFrame(previewFrameId);
  previewFrameId = requestAnimationFrame(() => {
    previewFrameId = null;
    if (previewCardAtivo !== card) return;
    posicionarPreviewCard(card);
    preview.classList.add("visivel");
  });
}

function posicionarPreviewCard(card) {
  const preview = previewCardEl;
  if (!preview) return;

  const gap = 14;
  const margin = 12;
  const rect = card.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const previewWidth = previewRect.width || 360;
  const previewHeight = previewRect.height || 190;
  const rightSpace = window.innerWidth - rect.right - margin;
  const leftSpace = rect.left - margin;
  let left = rect.right + gap;
  let top = rect.top + rect.height / 2 - previewHeight / 2;
  let placement = "right";

  if (rightSpace >= previewWidth + gap) {
    placement = "right";
  } else if (leftSpace >= previewWidth + gap) {
    left = rect.left - previewWidth - gap;
    placement = "left";
  } else {
    left = rect.left + rect.width / 2 - previewWidth / 2;
    top = rect.top - previewHeight - gap;
    placement = "top";

    if (top < margin) {
      top = rect.bottom + gap;
      placement = "bottom";
    }
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - previewWidth - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - previewHeight - margin));

  preview.classList.toggle("preview-left", placement === "left");
  preview.classList.toggle("preview-top", placement === "top");
  preview.classList.toggle("preview-bottom", placement === "bottom");
  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
}

function ocultarPreviewCard() {
  previewCardAtivo = null;
  if (previewFrameId) {
    cancelAnimationFrame(previewFrameId);
    previewFrameId = null;
  }
  if (!previewCardEl) return;
  previewCardEl.classList.remove("visivel");
}

// ─── Paginação ─────────────────────────────────────────────────────────────
function configurarLinkPreview() {
  document.addEventListener("mouseover", iniciarLinkPreviewPorEvento, true);
  document.addEventListener("mousemove", moverLinkPreviewPorEvento, true);
  document.addEventListener("mouseout", sairLinkPreviewPorEvento, true);
  document.addEventListener("focusin", iniciarLinkPreviewPorEvento, true);
  document.addEventListener("focusout", sairLinkPreviewPorEvento, true);
  window.addEventListener("scroll", ocultarLinkPreview, true);
  window.addEventListener("resize", ocultarLinkPreview);
}

function garantirLinkPreview() {
  if (linkPreviewEl && document.body.contains(linkPreviewEl)) {
    return linkPreviewEl;
  }

  linkPreviewEl = document.createElement("div");
  linkPreviewEl.id = "site-link-preview";
  linkPreviewEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(linkPreviewEl);
  return linkPreviewEl;
}

function buscarAnchorPreview(target) {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!anchor) return null;
  if (anchor.closest("#site-link-preview")) return null;
  if (anchor.closest("#site-card-preview")) return null;
  return anchor;
}

function safePreviewUrl(anchor) {
  if (!anchor) return "";
  const href = anchor.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return "";

  try {
    const url = new URL(href, window.location.href);
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function getPreviewDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getAnchorPreviewTitle(anchor, url) {
  const explicit = anchor?.dataset?.previewTitle?.trim();
  if (explicit) return explicit;

  const text = anchor?.textContent?.trim();
  if (!text) return "";

  const domain = getPreviewDomain(url);
  return text !== url && text !== domain ? text : "";
}

function atualizarMousePreview(anchor, event) {
  if (
    typeof event.clientX === "number" &&
    typeof event.clientY === "number" &&
    (event.clientX || event.clientY)
  ) {
    linkPreviewLastMouse = { x: event.clientX, y: event.clientY };
    return;
  }

  const rect = anchor.getBoundingClientRect();
  linkPreviewLastMouse = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function iniciarLinkPreviewPorEvento(event) {
  const anchor = buscarAnchorPreview(event.target);
  const url = safePreviewUrl(anchor);
  if (!anchor || !url) return;

  atualizarMousePreview(anchor, event);
  clearTimeout(linkPreviewHideTimer);

  if (linkPreviewAnchor === anchor && linkPreviewUrl === url) {
    posicionarLinkPreview(linkPreviewLastMouse.x, linkPreviewLastMouse.y);
    return;
  }

  clearTimeout(linkPreviewTimer);
  linkPreviewAnchor = anchor;
  linkPreviewUrl = url;

  linkPreviewTimer = setTimeout(() => {
    if (linkPreviewAnchor !== anchor || linkPreviewUrl !== url) return;
    renderizarLinkPreviewSkeleton(anchor, url);
    carregarLinkPreviewMetadata(url);
  }, LINK_PREVIEW_DELAY);
}

function moverLinkPreviewPorEvento(event) {
  if (!linkPreviewUrl) return;
  const anchor = buscarAnchorPreview(event.target);
  if (!anchor || anchor !== linkPreviewAnchor) return;
  atualizarMousePreview(anchor, event);
  posicionarLinkPreview(linkPreviewLastMouse.x, linkPreviewLastMouse.y);
}

function sairLinkPreviewPorEvento(event) {
  const anchor = buscarAnchorPreview(event.target);
  if (!anchor || anchor !== linkPreviewAnchor) return;

  const related = event.relatedTarget;
  if (related instanceof Node && anchor.contains(related)) return;

  agendarOcultarLinkPreview();
}

function renderizarLinkPreviewSkeleton(anchor, url) {
  const preview = garantirLinkPreview();
  const label =
    getAnchorPreviewTitle(anchor, url) ||
    anchor.textContent?.trim() ||
    getPreviewDomain(url);

  preview.className = "";
  preview.innerHTML = `
    <div class="slp-head">
      <span>${escapeHTML(getPreviewDomain(url))}</span>
    </div>
    <div class="slp-image">
      <div class="slp-loading" aria-label="Carregando preview"></div>
      <span>${escapeHTML(label)}</span>
    </div>
    <div class="slp-copy">
      <strong>${escapeHTML(label)}</strong>
      <p>${escapeHTML(url)}</p>
    </div>
  `;

  posicionarLinkPreview(linkPreviewLastMouse.x, linkPreviewLastMouse.y);
  requestAnimationFrame(() => preview.classList.add("visivel"));
}

function atualizarLinkPreview(url, data) {
  if (!linkPreviewEl || linkPreviewUrl !== url) return;

  const finalUrl = data?.url || url;
  const domain = data?.domain || getPreviewDomain(finalUrl);
  const title = getAnchorPreviewTitle(linkPreviewAnchor, url) || data?.title || domain;
  const description = data?.description || finalUrl;
  const image = data?.image || "";
  const imageEl = linkPreviewEl.querySelector(".slp-image");
  const imageLabel = linkPreviewEl.querySelector(".slp-image span");

  linkPreviewEl.querySelector(".slp-head span").textContent = domain;
  linkPreviewEl.querySelector(".slp-copy strong").textContent = title;
  linkPreviewEl.querySelector(".slp-copy p").textContent = description;
  linkPreviewEl.querySelector(".slp-loading")?.remove();

  if (image && imageEl) {
    imageEl.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
    linkPreviewEl.classList.add("tem-imagem");
    if (imageLabel) imageLabel.style.display = "none";
  } else if (imageEl && imageLabel) {
    imageEl.style.backgroundImage = "";
    imageLabel.textContent = title || domain;
    imageLabel.style.display = "";
    linkPreviewEl.classList.remove("tem-imagem");
  }

  posicionarLinkPreview(linkPreviewLastMouse.x, linkPreviewLastMouse.y);
}

async function carregarLinkPreviewMetadata(url) {
  if (linkPreviewCache.has(url)) {
    atualizarLinkPreview(url, linkPreviewCache.get(url));
    return;
  }

  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    const json = await res.json();
    const data = json?.data || { url, domain: getPreviewDomain(url) };
    linkPreviewCache.set(url, data);
    atualizarLinkPreview(url, data);
  } catch (err) {
    atualizarLinkPreview(url, {
      url,
      domain: getPreviewDomain(url),
      title: getPreviewDomain(url),
      description: "Preview indisponivel no momento.",
    });
  }
}

function posicionarLinkPreview(x, y) {
  if (!linkPreviewEl) return;

  const gap = 16;
  const margin = 12;
  const rect = linkPreviewEl.getBoundingClientRect();
  const width = rect.width || 340;
  const height = rect.height || 270;
  let left = x + gap;
  let top = y + gap;

  if (left + width > window.innerWidth - margin) {
    left = x - width - gap;
  }

  if (top + height > window.innerHeight - margin) {
    top = y - height - gap;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

  linkPreviewEl.style.left = `${left}px`;
  linkPreviewEl.style.top = `${top}px`;
}

function agendarOcultarLinkPreview() {
  clearTimeout(linkPreviewHideTimer);
  linkPreviewHideTimer = setTimeout(ocultarLinkPreview, 140);
}

function ocultarLinkPreview() {
  clearTimeout(linkPreviewTimer);
  clearTimeout(linkPreviewHideTimer);
  linkPreviewAnchor = null;
  linkPreviewUrl = "";
  if (linkPreviewEl) linkPreviewEl.classList.remove("visivel");
}

function renderizarPaginacao() {
  const pag = document.getElementById("paginacao");
  const totalPags = Math.ceil(filtradas.length / POR_PAGINA);
  pag.innerHTML = "";
  pag.classList.remove("in-view");
  pag.classList.remove("reveal-section");
  delete pag.dataset.revealObserved;

  if (totalPags <= 1) return;

  pag.classList.add("reveal-section");

  const btnAnterior = document.createElement("button");
  btnAnterior.className = "pag-btn";
  btnAnterior.textContent = "←";
  btnAnterior.disabled = paginaAtual === 1;
  btnAnterior.addEventListener("click", () => irPagina(paginaAtual - 1));
  pag.appendChild(btnAnterior);

  for (let p = 1; p <= totalPags; p++) {
    if (
      p === 1 || p === totalPags ||
      (p >= paginaAtual - 1 && p <= paginaAtual + 1)
    ) {
      const btn = document.createElement("button");
      btn.className = "pag-btn" + (p === paginaAtual ? " ativo" : "");
      btn.textContent = p;
      btn.addEventListener("click", () => irPagina(p));
      pag.appendChild(btn);
    } else if (
      p === paginaAtual - 2 || p === paginaAtual + 2
    ) {
      const ell = document.createElement("span");
      ell.textContent = "…";
      ell.style.cssText = "font-family:var(--font-mono);padding:0 0.3rem;opacity:.5";
      pag.appendChild(ell);
    }
  }

  const btnProx = document.createElement("button");
  btnProx.className = "pag-btn";
  btnProx.textContent = "→";
  btnProx.disabled = paginaAtual === totalPags;
  btnProx.addEventListener("click", () => irPagina(paginaAtual + 1));
  pag.appendChild(btnProx);

  observarAnimacoes(pag);
}

function irPagina(p) {
  paginaAtual = p;
  renderizarGrid(p);
  renderizarPaginacao();
  window.scrollTo({ top: document.querySelector(".grid").offsetTop - 100, behavior: "smooth" });
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function configurarModal() {
  document.getElementById("modalFechar").addEventListener("click", fecharModal);
  document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modalOverlay")) fecharModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") fecharModal();
  });
}

async function carregarDetalheAnalise(analise) {
  if (analise.resultado) return analise;
  const res = await fetch(`/api/analises/detalhe?url=${encodeURIComponent(analise.url)}`);
  if (!res.ok) throw new Error("Detalhe nao encontrado");
  const data = await res.json();
  return normalizarAnaliseApi({
    ...analise,
    ...(data.analise || {}),
    resultado: data.resultado || data.analise?.resultado || null,
  });
}

async function abrirModal(a) {
  const overlay = document.getElementById("modalOverlay");
  overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";
  renderizarModalAnalise(a);

  try {
    const detalhe = await carregarDetalheAnalise(a);
    preservarFeedbackAtual(a.url);
    if (overlay.classList.contains("aberta")) {
      renderizarModalAnalise(detalhe);
    }
  } catch (err) {
    console.warn("[site] detalhe indisponivel:", err);
  }
}

function obterBuildFinalResultado(resultado) {
  if (!resultado || typeof resultado !== "object") return {};
  if (resultado.etapa === "buildFinal") return resultado;
  return (
    resultado.etapa10_buildFinal ||
    resultado.buildFinal ||
    resultado.resultado?.etapa10_buildFinal ||
    resultado.data?.etapa10_buildFinal ||
    resultado
  );
}

function arraySeguro(valor) {
  return Array.isArray(valor) ? valor : [];
}

function numeroConfianca(valor, fallback) {
  if (typeof valor === "string") {
    const normalizado = valor.trim().replace(",", ".").replace("%", "");
    const parsed = Number(normalizado);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function tokenClasse(valor) {
  return String(valor || "indefinido")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function labelVereditoDetalhe(valor) {
  const labels = {
    confirmado: "Confirmado",
    confirmada: "Confirmada",
    provavelmente_confirmado: "Provavelmente confirmado",
    parcialmente_confirmado: "Parcialmente confirmado",
    parcialmente_confirmada: "Parcialmente confirmada",
    inconclusivo: "Inconclusivo",
    inconclusiva: "Inconclusiva",
    nao_confirmado: "Nao confirmado",
    nao_confirmada: "Nao confirmada",
    contradito: "Contradito",
    contradita: "Contradita",
    provavelmente_falso: "Provavelmente falso",
    falso: "Falso",
    falsa: "Falsa",
  };
  const chave = normalizarTexto(valor).replace(/\s+/g, "_");
  return labels[chave] || valor || "Inconclusivo";
}

function labelStatusClaimDetalhe(valor) {
  const labels = {
    confirmada: "Confirmada",
    parcialmente_confirmada: "Parcialmente confirmada",
    inconclusiva: "Inconclusiva",
    nao_confirmada: "Nao confirmada",
    contradita: "Contradita",
    erro_na_verificacao: "Erro na verificacao",
  };
  const chave = normalizarTexto(valor).replace(/\s+/g, "_");
  return labels[chave] || valor || "Inconclusiva";
}

function labelNivelDetalhe(valor) {
  const labels = {
    alta: "Alta",
    boa: "Boa",
    moderada: "Moderada",
    baixa: "Baixa",
    muito_baixa: "Muito baixa",
  };
  const chave = normalizarTexto(valor).replace(/\s+/g, "_");
  return labels[chave] || valor || "-";
}

function formatarDataLivre(valor) {
  if (!valor) return "";
  try {
    const texto = String(valor);
    const data = /^\d{4}-\d{2}-\d{2}$/.test(texto)
      ? new Date(`${texto}T12:00:00`)
      : new Date(texto);
    if (Number.isNaN(data.getTime())) return String(valor);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data);
  } catch {
    return String(valor);
  }
}

function renderizarMetaDetalhe(resultado, analise) {
  const itens = [
    ["Fonte", resultado.veiculo || tentarHost(analise.url)],
    ["Publicado", formatarDataLivre(resultado.dataPublicacao || analise.publishedDate)],
    ["Tipo", resultado.tipoConteudo || ""],
    ["Assunto", resultado.assuntoPrincipal || ""],
  ].filter(([, value]) => value);

  if (!itens.length) return "";

  return `
    <div class="modal-meta">
      ${itens.map(([label, value]) => `
        <span><strong>${escapeHTML(label)}:</strong> ${escapeHTML(value)}</span>
      `).join("")}
    </div>
  `;
}

function renderizarListaModal(itens, className = "modal-list") {
  const lista = arraySeguro(itens).filter(Boolean);
  if (!lista.length) return "";
  return `
    <ul class="${className}">
      ${lista.map(item => `<li>${escapeHTML(item)}</li>`).join("")}
    </ul>
  `;
}

function labelCampoDetalhe(campo) {
  const labels = {
    origemPrincipal: "Origem principal",
    usouSimpleCheckClaims: "Usou checagem de claims",
    vereditoFoiAjustado: "Veredito ajustado",
    motivoAjuste: "Motivo do ajuste",
    totalClaims: "Total de claims",
    confirmadas: "Confirmadas",
    parcialmenteConfirmadas: "Parcialmente confirmadas",
    inconclusivas: "Inconclusivas",
    naoConfirmadas: "Nao confirmadas",
    contraditas: "Contraditas",
    comErro: "Com erro",
  };

  if (labels[campo]) return labels[campo];

  return String(campo || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, letra => letra.toUpperCase());
}

function valorDetalheLegivel(campo, valor) {
  const valoresMapeados = {
    origemPrincipal: {
      analise_para_build_final: "Analise final consolidada",
      buildFinal: "Resultado final consolidado",
    },
  };

  if (valoresMapeados[campo]?.[valor]) return valoresMapeados[campo][valor];

  if (typeof valor === "boolean") return valor ? "Sim" : "Nao";
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return valor.filter(Boolean).join(", ");
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

function renderizarFatosModal(dados) {
  if (!dados || typeof dados !== "object") return "";

  const entradas = Object.entries(dados)
    .map(([campo, valor]) => [campo, valorDetalheLegivel(campo, valor)])
    .filter(([, valor]) => valor !== "");

  if (!entradas.length) return "";

  return `
    <div class="modal-facts">
      ${entradas.map(([campo, valor]) => `
        <div>
          <small>${escapeHTML(labelCampoDetalhe(campo))}</small>
          <span>${escapeHTML(valor)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderizarBaseDoVeredito(baseDoVeredito) {
  if (!baseDoVeredito) return "";

  if (typeof baseDoVeredito !== "object") {
    return `<p class="modal-body">${escapeHTML(baseDoVeredito)}</p>`;
  }

  return renderizarFatosModal(baseDoVeredito);
}

function renderizarAvisoAtualizacao(aviso) {
  if (!aviso || aviso.ativo !== true) return "";

  const novasInformacoes = arraySeguro(aviso.novasInformacoes).filter(Boolean);
  const confianca = aviso.confiancaSimilaridade !== undefined
    ? `${escapeHTML(String(aviso.confiancaSimilaridade))}%`
    : "";

  return `
    <section class="modal-update-warning">
      <div class="modal-update-head">
        <strong>Aviso de atualizacao</strong>
        ${confianca ? `<span>${confianca} de semelhanca</span>` : ""}
      </div>
      <p>${escapeHTML(aviso.mensagem || "Esta noticia parece atualizar uma analise ja publicada no site.")}</p>
      <div class="modal-update-summaries">
        ${aviso.resumoAntigo ? `
          <article>
            <small>Resumo antigo</small>
            <p>${escapeHTML(aviso.resumoAntigo)}</p>
          </article>
        ` : ""}
        ${aviso.resumoNovo ? `
          <article>
            <small>Resumo novo</small>
            <p>${escapeHTML(aviso.resumoNovo)}</p>
          </article>
        ` : ""}
      </div>
      ${novasInformacoes.length ? `
        <div class="modal-update-new">
          <small>Novas informacoes adicionadas</small>
          <ul>
            ${novasInformacoes.map(item => `<li>${escapeHTML(item)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${aviso.tituloAnterior || aviso.tituloNovo ? `
        <div class="modal-update-links">
          ${aviso.tituloAnterior ? `<span><strong>Anterior:</strong> ${escapeHTML(aviso.tituloAnterior)}</span>` : ""}
          ${aviso.tituloNovo ? `<span><strong>Nova:</strong> ${escapeHTML(aviso.tituloNovo)}</span>` : ""}
        </div>
      ` : ""}
    </section>
  `;
}

function renderizarAchadosModal(resultado) {
  const grupos = [
    ["Confirmado", "confirmed", resultado.oQueFoiConfirmado],
    ["Inconclusivo", "unknown", resultado.oQueFicouInconclusivo],
    ["Contradito", "disputed", resultado.oQueFoiContradito],
  ].filter(([, , itens]) => arraySeguro(itens).filter(Boolean).length);

  if (!grupos.length) return "";

  return `
    <p class="modal-section-title">O que a analise encontrou</p>
    <div class="modal-findings">
      ${grupos.map(([label, tipo, itens]) => `
        <section class="modal-finding modal-finding-${tipo}">
          <strong>${escapeHTML(label)}</strong>
          ${renderizarListaModal(itens, "modal-list")}
        </section>
      `).join("")}
    </div>
  `;
}

function renderizarEvidenciasClaim(evidencias) {
  const fontes = normalizarFontesConsultadas(evidencias);
  if (!fontes.length) return "";

  return `
    <div class="modal-claim-evidence">
      <span>Evidencias</span>
      <ul>
        ${fontes.map(fonte => {
          const label = fonte.titulo || fonte.fonte || fonte.dominio || fonte.url || "Fonte";
          const relacao = fonte.relacaoComClaim || fonte.papelNaVerificacao || fonte.relevancia || "";
          const resumo = fonte.resumo || fonte.resumoEvidencia || "";
          const titulo = fonte.url
            ? `<a href="${escapeHTML(fonte.url)}" data-preview-title="${escapeHTML(label)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`
            : `<strong>${escapeHTML(label)}</strong>`;

          return `
            <li>
              ${titulo}
              ${relacao ? `<small>${escapeHTML(relacao)}</small>` : ""}
              ${resumo ? `<p>${escapeHTML(resumo)}</p>` : ""}
            </li>
          `;
        }).join("")}
      </ul>
    </div>
  `;
}

function renderizarClaimsDetalhadas(claims) {
  const lista = arraySeguro(claims);
  if (!lista.length) return "";

  return `
    <p class="modal-section-title">Claims analisadas</p>
    <div class="modal-claims">
      ${lista.map((claim, index) => {
        const status = claim.statusNormalizado || claim.statusOriginal || "inconclusiva";
        const texto = claim.textoFinal || claim.textoOriginal || "";
        return `
          <article class="modal-claim modal-claim-${tokenClasse(status)}">
            <div class="modal-claim-head">
              <span>Claim ${escapeHTML(claim.id || index + 1)}</span>
              <strong>${escapeHTML(labelStatusClaimDetalhe(status))}</strong>
            </div>
            ${texto ? `<p>${escapeHTML(texto)}</p>` : ""}
            ${claim.explicacao ? `<small>${escapeHTML(claim.explicacao)}</small>` : ""}
            ${renderizarEvidenciasClaim(claim.evidencias)}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function nivelAvaliacaoFonteLabel(nivel) {
  if (nivel === "denuncia") return "Fonte com denúncias";
  if (nivel === "negativa") return "Fonte mal avaliada";
  return "Fonte bem avaliada";
}

function mensagemAvaliacaoFonte(av) {
  if (av?.mensagem) return av.mensagem;
  const partes = [];
  const likes = Number(av?.likes || 0);
  const dislikes = Number(av?.dislikes || 0);
  const denuncias = Number(av?.denuncias || 0);
  if (likes > 0) partes.push(`${likes} ${likes === 1 ? "usuário gosta" : "usuários gostam"} dela`);
  if (dislikes > 0) partes.push(`${dislikes} não ${dislikes === 1 ? "gosta" : "gostam"} dela`);
  if (denuncias > 0) partes.push(`${denuncias} ${denuncias === 1 ? "denúncia" : "denúncias"}`);
  return partes.join(" · ");
}

function renderizarAvaliacoesFontes(resultado) {
  const lista = arraySeguro(resultado?.avaliacoesFontes).filter(
    (av) => av && av.dominio,
  );
  if (!lista.length) return "";

  return `
    <section class="modal-fontes-alerta">
      <p class="modal-section-title">Avaliações da comunidade sobre as fontes</p>
      <div class="mfa-lista">
        ${lista
          .map((av) => {
            const nivel = tokenClasse(av.nivel || "positiva");
            return `
            <div class="mfa-item mfa-${nivel}">
              <div class="mfa-cab">
                <a class="mfa-dominio" href="https://${escapeHTML(av.dominio)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHTML(av.dominio)}${av.principal ? `<span class="mfa-tag">fonte da notícia</span>` : ""}
                </a>
                <span class="mfa-nivel">${escapeHTML(nivelAvaliacaoFonteLabel(av.nivel))}</span>
              </div>
              <div class="mfa-numeros">
                <span class="mfa-n mfa-n-like" title="Gostam">👍 ${Number(av.likes || 0)}</span>
                <span class="mfa-n mfa-n-dislike" title="Não gostam">👎 ${Number(av.dislikes || 0)}</span>
                ${Number(av.denuncias || 0) > 0 ? `<span class="mfa-n mfa-n-denuncia" title="Denúncias">⚑ ${Number(av.denuncias)}</span>` : ""}
              </div>
              <p class="mfa-msg">${escapeHTML(mensagemAvaliacaoFonte(av))}</p>
            </div>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderizarFontesDetalhadas(fontes) {
  const lista = normalizarFontesConsultadas(fontes);
  if (!lista.length) return "";

  return `
    <p class="modal-section-title">Fontes principais</p>
    <div class="modal-source-cards">
      ${lista.map(fonte => {
        const label = fonte.titulo || fonte.fonte || fonte.dominio || fonte.url || "Fonte";
        const meta = [fonte.tipoFonte || "", fonte.relevancia || "", fonte.dominio || ""]
          .filter(Boolean)
          .join(" · ");
        const titulo = fonte.url
          ? `<a class="modal-source-title" href="${escapeHTML(fonte.url)}" data-preview-title="${escapeHTML(label)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`
          : `<strong class="modal-source-title">${escapeHTML(label)}</strong>`;

        const av = fonte.avaliacaoComunidade;
        const avBadge = av
          ? `<span class="modal-source-aval modal-source-aval-${tokenClasse(av.nivel || "positiva")}" title="${escapeHTML(mensagemAvaliacaoFonte(av))}">
               👍 ${Number(av.likes || 0)} · 👎 ${Number(av.dislikes || 0)}${Number(av.denuncias || 0) > 0 ? ` · ⚑ ${Number(av.denuncias)}` : ""}
             </span>`
          : "";

        return `
          <article class="modal-source-card">
            ${titulo}
            ${meta ? `<span>${escapeHTML(meta)}</span>` : ""}
            ${avBadge}
            ${fonte.papelNaVerificacao ? `<p>${escapeHTML(fonte.papelNaVerificacao)}</p>` : ""}
            ${fonte.resumo ? `<p>${escapeHTML(fonte.resumo)}</p>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderizarAlertasModal(alertas) {
  const lista = arraySeguro(alertas).filter(alerta => alerta && (alerta.mensagem || alerta.tipo || alerta.impacto));
  if (!lista.length) return "";

  return `
    <p class="modal-section-title">Alertas</p>
    <ul class="modal-alerts">
      ${lista.map(alerta => `
        <li class="modal-alert modal-alert-${tokenClasse(alerta.gravidade || "media")}">
          <strong>${escapeHTML(alerta.gravidade || "media")}</strong>
          <span>${escapeHTML(alerta.mensagem || alerta.tipo || "")}</span>
          ${alerta.impacto ? `<em>${escapeHTML(alerta.impacto)}</em>` : ""}
        </li>
      `).join("")}
    </ul>
  `;
}

function renderizarModalAnalise(a, alvo) {
  const label = { true: "Verdadeiro", false: "Falso", mixed: "Misto" };
  const resultado = obterBuildFinalResultado(a.resultado || {});
  const conteudo = alvo || document.getElementById("modalConteudo");
  if (!conteudo) return;
  const claims = Array.isArray(resultado.claimsAnalisadas)
    ? resultado.claimsAnalisadas
    : [];
  const fontes = normalizarFontesConsultadas(
    Array.isArray(resultado.fontesPrincipais) && resultado.fontesPrincipais.length
      ? resultado.fontesPrincipais
      : Array.isArray(a.fontesConsultadas) && a.fontesConsultadas.length
        ? a.fontesConsultadas
        : a.sources
  );
  const entidades = normalizarEntidadesMencionadas(
    Array.isArray(resultado.entidadesMencionadas) && resultado.entidadesMencionadas.length
      ? resultado.entidadesMencionadas
      : a.entidadesMencionadas
  );
  const score = a.score ?? numeroConfianca(resultado.scoreConfiabilidade, null);
  const titulo = resultado.tituloFinal || a.title;
  // Nome legível da origem (ex.: "Instagram", "G1") em vez da URL crua.
  // Usa o veículo entregue pela IA, com fallback para o domínio do link.
  const origemNome = resultado.veiculo || tentarHost(a.url) || a.url;
  const resumoCurto = resultado.resumoCurto || a.summary;
  const vereditoTexto = resultado.vereditoGeral
    ? labelVereditoDetalhe(resultado.vereditoGeral)
    : (label[a.veracity] || a.veracity);
  const pontosImportantesHTML = renderizarListaModal(
    resultado.pontosImportantes,
    "modal-list modal-list-points"
  );
  const claimsResumoHTML = renderizarFatosModal(resultado.claimsResumo);

  conteudo.innerHTML = `
    <span class="modal-veracity ${a.veracity}">${label[a.veracity] || a.veracity}</span>
    <h2>${escapeHTML(titulo)}</h2>
    ${renderizarMetaDetalhe(resultado, a)}
    <a class="modal-url" href="${escapeHTML(a.url)}" title="${escapeHTML(a.url)}" data-preview-title="${escapeHTML(a.title)}" target="_blank" rel="noopener noreferrer">${escapeHTML(origemNome)} <span class="modal-url-ext" aria-hidden="true">↗</span></a>
    <div class="modal-actions">
      <button type="button" class="modal-share-btn" aria-label="Compartilhar veredito como imagem">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line>
        </svg>
        <span class="modal-share-label">Compartilhar veredito</span>
      </button>
    </div>
    ${renderizarAvaliacoesFontes(resultado)}
    ${renderizarAvisoAtualizacao(resultado.avisoAtualizacao || a.avisoAtualizacao)}
    ${score !== null && score !== undefined ? `
      <section class="modal-verdict modal-verdict-${tokenClasse(resultado.vereditoGeral || a.veracity)}">
        <div>
          <span>Veredito geral</span>
          <strong>${escapeHTML(vereditoTexto)}</strong>
        </div>
        <div class="modal-score" style="--modal-score:${Math.max(0, Math.min(100, numeroConfianca(score, 0)))}%">
          <span>${escapeHTML(String(Math.round(numeroConfianca(score, 0))))}%</span>
          <small>${escapeHTML(labelNivelDetalhe(resultado.nivelConfiabilidade || a.nivelConfiabilidade))}</small>
        </div>
      </section>
    ` : ""}
    ${resultado.mensagemPrincipalUsuario ? `
      <p class="modal-main-message">${sanitizarHTMLInline(resultado.mensagemPrincipalUsuario)}</p>
    ` : ""}
    ${resumoCurto ? `
      <p class="modal-section-title">Resumo da analise</p>
      <p class="modal-body">${escapeHTML(resumoCurto)}</p>
    ` : ""}
    ${resultado.resumoDetalhado ? `
      <p class="modal-section-title">Detalhes da analise</p>
      <p class="modal-body">${escapeHTML(resultado.resumoDetalhado)}</p>
    ` : ""}
    ${resultado.baseDoVeredito ? `
      <p class="modal-section-title">Base do veredito</p>
      ${renderizarBaseDoVeredito(resultado.baseDoVeredito)}
    ` : ""}
    ${claimsResumoHTML ? `
      <p class="modal-section-title">Resumo das claims</p>
      ${claimsResumoHTML}
    ` : ""}
    ${pontosImportantesHTML ? `
      <p class="modal-section-title">Pontos importantes</p>
      ${pontosImportantesHTML}
    ` : ""}
    ${renderizarAchadosModal(resultado)}
    ${renderizarClaimsDetalhadas(claims)}
    ${renderizarFontesDetalhadas(fontes)}
    ${renderizarAlertasModal(resultado.alertasGerais)}
    ${entidades.length ? `
      <p class="modal-section-title">Entidades mencionadas</p>
      <div class="modal-entities">
        ${renderizarEntidades(entidades)}
      </div>
    ` : ""}
    ${resultado.textoFinalSemHtml ? `
      <p class="modal-section-title">Conclusao</p>
      <p class="modal-body">${escapeHTML(resultado.textoFinalSemHtml)}</p>
    ` : ""}
    ${renderizarFeedbackNoticia(a)}
    ${a.publishedDate ? `<p class="modal-section-title" style="margin-top:1.5rem">Data de publicacao: ${escapeHTML(formatarDataLivre(a.publishedDate))}</p>` : ""}
    ${a.date ? `<p class="modal-section-title" style="margin-top:1rem">Data da verificacao: ${formatarData(a.date)}</p>` : ""}
  `;
  configurarFeedbackNoticia(a);

  const shareBtn = conteudo.querySelector(".modal-share-btn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => compartilharCartao(a, shareBtn));
  }
}

// ─── Card de veredito compartilhavel (PNG) ──────────────────────────────────
const CARTAO_MARCA_AZUL = "#02519b";
const CARTAO_MARCA_VERMELHO = "#d3392d";
const CARTAO_MARCA_TINTA = "#171715";
const CARTAO_AMARELO = "#d79a00";
const CARTAO_LOGO_SRC = "/assets/icons/IconVerusAi.png";

// Veredito nas cores da logo (azul/vermelho); o caso "misto" usa a exclamacao
// amarela. A porcentagem e a barra usam sempre a cor padrao da marca (azul).
const TEMA_CARTAO = {
  true: { accent: CARTAO_MARCA_AZUL, tint: "#e7f0f8", glyph: "✓" },
  false: { accent: CARTAO_MARCA_VERMELHO, tint: "#fbe7e5", glyph: "✕" },
  mixed: { accent: CARTAO_AMARELO, tint: "#fcf3da", glyph: "!" },
};

function dadosCartaoCompartilhar(a) {
  const resultado = obterBuildFinalResultado(a.resultado || {});
  const veracity = ["true", "false", "mixed"].includes(a.veracity)
    ? a.veracity
    : "mixed";
  const score = numeroConfianca(a.score ?? resultado.scoreConfiabilidade, null);
  const fontes = normalizarFontesConsultadas(
    Array.isArray(resultado.fontesPrincipais) && resultado.fontesPrincipais.length
      ? resultado.fontesPrincipais
      : Array.isArray(a.fontesConsultadas) && a.fontesConsultadas.length
        ? a.fontesConsultadas
        : a.sources,
  )
    .map((f) => f.fonte || f.titulo || f.dominio || (f.url ? tentarHost(f.url) : ""))
    .filter(Boolean)
    .slice(0, 4);

  return {
    veracity,
    titulo: resultado.tituloFinal || a.title || "Sem titulo",
    veredito: resultado.vereditoGeral
      ? labelVereditoDetalhe(resultado.vereditoGeral)
      : ({ true: "Verdadeiro", false: "Falso", mixed: "Misto" }[veracity] || "Misto"),
    score: score === null ? null : Math.max(0, Math.min(100, Math.round(score))),
    nivel: labelNivelDetalhe(resultado.nivelConfiabilidade || a.nivelConfiabilidade),
    resumo:
      resultado.resumoCurto ||
      resultado.mensagemPrincipalUsuario ||
      a.summary ||
      resultado.resumoDetalhado ||
      "",
    veiculo: resultado.veiculo || tentarHost(a.url || ""),
    data: a.date ? formatarData(a.date) : "",
    fontes,
    url: a.url || "",
  };
}

function quebrarLinhasCanvas(ctx, texto, maxLargura, maxLinhas) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";

  for (const palavra of palavras) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > maxLargura && atual) {
      linhas.push(atual);
      atual = palavra;
      if (linhas.length === maxLinhas) break;
    } else {
      atual = teste;
    }
  }

  if (linhas.length < maxLinhas && atual) linhas.push(atual);

  if (linhas.length === maxLinhas && atual && linhas[maxLinhas - 1] !== atual) {
    let ultima = linhas[maxLinhas - 1];
    while (ultima && ctx.measureText(`${ultima}…`).width > maxLargura) {
      ultima = ultima.slice(0, -1).trimEnd();
    }
    linhas[maxLinhas - 1] = `${ultima}…`;
  }

  return linhas;
}

function truncarTextoCanvas(ctx, texto, maxLargura) {
  let valor = String(texto || "");
  if (ctx.measureText(valor).width <= maxLargura) return valor;
  while (valor && ctx.measureText(`${valor}…`).width > maxLargura) {
    valor = valor.slice(0, -1);
  }
  return `${valor.trimEnd()}…`;
}

async function carregarFontesCartao() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load('900 96px "Playfair Display"'),
      document.fonts.load('700 48px "Playfair Display"'),
      document.fonts.load('700 24px "Space Mono"'),
      document.fonts.load('400 24px "Space Mono"'),
    ]);
    await document.fonts.ready;
  } catch (err) {
    console.warn("[cartao] fontes nao carregadas:", err);
  }
}

function carregarImagemCartao(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function gerarCartaoCompartilhavel(dados) {
  const [logo] = await Promise.all([
    carregarImagemCartao(CARTAO_LOGO_SRC),
    carregarFontesCartao(),
  ]);

  const W = 1080;
  const H = 1350;
  const M = 80;
  const cw = W - M * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const tema = TEMA_CARTAO[dados.veracity] || TEMA_CARTAO.mixed;
  const podeEspacar = "letterSpacing" in ctx;
  const setLS = (valor) => {
    if (podeEspacar) ctx.letterSpacing = valor;
  };

  const caixaArredondada = (x, yy, w, h, r) => {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, yy, w, h, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, yy, w, h);
    }
  };

  // Fundo "papel" (sem moldura)
  ctx.fillStyle = "#f4ecdf";
  ctx.fillRect(0, 0, W, H);

  // ── Cabecalho: "Verificador de noticia" + logo menor ──
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  setLS("3px");
  ctx.fillStyle = CARTAO_MARCA_TINTA;
  ctx.font = '700 26px "Space Mono", monospace';
  ctx.fillText("VERIFICADOR DE NOTICIA", M, 112);
  setLS("0px");

  if (logo && logo.width) {
    const logoH = 60;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, W - M - logoW, 102 - logoH / 2, logoW, logoH);
  } else {
    ctx.textAlign = "right";
    ctx.fillStyle = CARTAO_MARCA_AZUL;
    ctx.font = '700 28px "Space Mono", monospace';
    ctx.fillText("VerusAI", W - M, 112);
    ctx.textAlign = "left";
  }

  // separacao
  ctx.strokeStyle = CARTAO_MARCA_TINTA;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(M, 144);
  ctx.lineTo(W - M, 144);
  ctx.stroke();

  // ── Titulo (h1) ──
  ctx.fillStyle = CARTAO_MARCA_TINTA;
  ctx.font = '900 58px "Playfair Display", Georgia, serif';
  const linhasTitulo = quebrarLinhasCanvas(ctx, dados.titulo, cw, 3);
  let y = 226;
  for (const linha of linhasTitulo) {
    ctx.fillText(linha, M, y);
    y += 70;
  }
  let cursor = y - 70 + 56;

  // ── Card de veredito (medio) ──
  const cardY = cursor + 24;
  const cardH = 230;
  ctx.fillStyle = tema.tint;
  caixaArredondada(M, cardY, cw, cardH, 16);
  ctx.fillStyle = tema.accent;
  ctx.fillRect(M, cardY, 10, cardH);

  // selo circular com glyph (exclamacao amarela no caso misto)
  const seloR = 58;
  const seloCx = M + 44 + seloR;
  const seloCy = cardY + cardH / 2;
  ctx.beginPath();
  ctx.arc(seloCx, seloCy, seloR, 0, Math.PI * 2);
  ctx.fillStyle = tema.accent;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 70px "Space Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tema.glyph, seloCx, seloCy + 4);

  const textoX = seloCx + seloR + 44;
  const colW = W - M - textoX;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // rotulo + veredito nas cores da logo
  setLS("2px");
  ctx.fillStyle = "#6b6b66";
  ctx.font = '700 24px "Space Mono", monospace';
  ctx.fillText("VEREDITO", textoX, cardY + 56);
  setLS("0px");

  ctx.fillStyle = tema.accent;
  ctx.font = '900 52px "Playfair Display", Georgia, serif';
  ctx.fillText(
    truncarTextoCanvas(ctx, dados.veredito, colW),
    textoX,
    cardY + 110,
  );

  if (dados.score !== null) {
    // porcentagem + barra nas cores padrao da marca (azul)
    ctx.fillStyle = CARTAO_MARCA_AZUL;
    ctx.font = '900 54px "Playfair Display", Georgia, serif';
    const scoreTxt = `${dados.score}%`;
    ctx.fillText(scoreTxt, textoX, cardY + 178);
    const scoreW = ctx.measureText(scoreTxt).width;

    ctx.fillStyle = "#6b6b66";
    ctx.font = '400 22px "Space Mono", monospace';
    const nivelTxt =
      dados.nivel && dados.nivel !== "-"
        ? `confiabilidade · ${dados.nivel.toLowerCase()}`
        : "de confiabilidade";
    ctx.fillText(nivelTxt, textoX + scoreW + 16, cardY + 178);

    const barY = cardY + 196;
    ctx.fillStyle = "rgba(23,23,21,0.12)";
    caixaArredondada(textoX, barY, colW, 12, 6);
    ctx.fillStyle = CARTAO_MARCA_AZUL;
    caixaArredondada(textoX, barY, Math.max(0.02, dados.score / 100) * colW, 12, 6);
  }

  cursor = cardY + cardH + 64;

  // ── Fontes consultadas: um quadrado cinza por fonte, lado a lado ──
  setLS("2px");
  ctx.fillStyle = CARTAO_MARCA_TINTA;
  ctx.font = '700 24px "Space Mono", monospace';
  ctx.fillText("FONTES CONSULTADAS", M, cursor);
  setLS("0px");
  cursor += 30;

  if (dados.fontes.length) {
    const chipH = 60;
    const padX = 22;
    const gap = 16;
    let cx = M;
    ctx.font = '700 22px "Space Mono", monospace';
    for (const fonte of dados.fontes) {
      const texto = truncarTextoCanvas(ctx, fonte, cw - padX * 2);
      const chipW = Math.min(ctx.measureText(texto).width + padX * 2, cw);
      if (cx + chipW > W - M) {
        cx = M;
        cursor += chipH + gap;
      }
      ctx.fillStyle = "#d9d3c6";
      caixaArredondada(cx, cursor, chipW, chipH, 8);
      ctx.fillStyle = "#3a3a36";
      ctx.textBaseline = "middle";
      ctx.fillText(texto, cx + padX, cursor + chipH / 2 + 1);
      ctx.textBaseline = "alphabetic";
      cx += chipW + gap;
    }
    cursor += chipH + 56;
  } else {
    ctx.fillStyle = "#3a3a36";
    ctx.font = 'italic 26px "Libre Baskerville", Georgia, serif';
    ctx.fillText("Analise automatizada por inteligencia artificial.", M, cursor + 36);
    cursor += 90;
  }

  // ── Resumo da noticia ──
  if (dados.resumo) {
    setLS("2px");
    ctx.fillStyle = CARTAO_MARCA_TINTA;
    ctx.font = '700 24px "Space Mono", monospace';
    ctx.fillText("RESUMO DA NOTICIA", M, cursor);
    setLS("0px");
    cursor += 46;

    ctx.fillStyle = "#2e2e2b";
    ctx.font = '400 26px "Libre Baskerville", Georgia, serif';
    const linhasResumo = quebrarLinhasCanvas(ctx, dados.resumo, cw, 3);
    for (const linha of linhasResumo) {
      ctx.fillText(linha, M, cursor);
      cursor += 38;
    }
  }

  // ── separacao + selo VerusAI (como ja estava) ──
  ctx.strokeStyle = CARTAO_MARCA_TINTA;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(M, H - 150);
  ctx.lineTo(W - M, H - 150);
  ctx.stroke();

  ctx.fillStyle = "#2e2e2b";
  ctx.font = '400 24px "Space Mono", monospace';
  const rodapeEsq = [dados.veiculo, dados.data].filter(Boolean).join("  ·  ");
  ctx.fillText(truncarTextoCanvas(ctx, rodapeEsq, cw - 260), M, H - 108);

  ctx.textAlign = "right";
  ctx.fillStyle = CARTAO_MARCA_AZUL;
  ctx.font = '700 26px "Space Mono", monospace';
  ctx.fillText("verusai ✓", W - M, H - 108);
  ctx.textAlign = "left";
  ctx.fillStyle = "#6b6b66";
  ctx.font = '400 20px "Space Mono", monospace';
  ctx.fillText(
    "Veredito gerado por IA — confira sempre as fontes originais.",
    M,
    H - 76,
  );

  return canvas;
}

function cartaoParaBlob(canvas) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } else {
      const dataUrl = canvas.toDataURL("image/png");
      const bin = atob(dataUrl.split(",")[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: "image/png" }));
    }
  });
}

function mostrarToastCompartilhar(mensagem) {
  let toast = document.getElementById("compartilharToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "compartilharToast";
    toast.className = "compartilhar-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = mensagem;
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 3200);
}

function nomeArquivoCartao(dados) {
  const base = normalizarTexto(dados.titulo)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "veredito";
  return `verusai-${base}.png`;
}

async function compartilharCartao(a, botao) {
  const label = botao ? botao.querySelector(".modal-share-label") : null;
  const textoOriginal = label ? label.textContent : "";
  if (botao) botao.disabled = true;
  if (label) label.textContent = "Gerando imagem…";

  try {
    const dados = dadosCartaoCompartilhar(a);
    const canvas = await gerarCartaoCompartilhavel(dados);
    const blob = await cartaoParaBlob(canvas);
    if (!blob) throw new Error("Falha ao gerar a imagem.");

    const nomeArquivo = nomeArquivoCartao(dados);
    const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
    const textoShare = [
      dados.titulo,
      `Veredito: ${dados.veredito}${dados.score !== null ? ` · ${dados.score}% de confiabilidade` : ""}`,
      "Verificado por VerusAI",
    ].join("\n");

    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({
        files: [arquivo],
        title: "VerusAI — Verificacao de noticia",
        text: textoShare,
      });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      mostrarToastCompartilhar("Imagem do veredito baixada ✓");
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    console.error("[cartao] erro ao compartilhar:", err);
    mostrarToastCompartilhar("Nao foi possivel gerar a imagem.");
  } finally {
    if (botao) botao.disabled = false;
    if (label) label.textContent = textoOriginal || "Compartilhar veredito";
  }
}

function renderizarFeedbackNoticia(a) {
  const url = a?.url || "";
  if (!url) return "";

  return `
    <section class="modal-feedback" data-feedback-url="${escapeHTML(url)}" aria-labelledby="modalFeedbackTitulo">

      <!-- ── Cabeçalho do chat ── -->
      <div class="mf-header">
        <div class="mf-header-left">
          <div class="mf-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <p class="mf-title" id="modalFeedbackTitulo" data-feedback-title>Discussão</p>
            <p class="mf-subtitle" data-feedback-intro>Deixe sua opinião sobre esta análise.</p>
          </div>
        </div>
        <div class="mf-counts" aria-live="polite">
          <span class="mf-count mf-count-like" data-feedback-like-count title="Likes">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            0
          </span>
          <span class="mf-count mf-count-dislike" data-feedback-dislike-count title="Dislikes">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            0
          </span>
          <span class="mf-count mf-count-comments" data-feedback-comment-count title="Comentários">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            0
          </span>
        </div>
      </div>

      <!-- ── Formulário de reação ── -->
      <div class="mf-form" data-feedback-form>
        <div class="mf-reactions" role="group" aria-label="Reação sobre a notícia">
          <button type="button" class="mf-reaction-btn mf-reaction-like" data-feedback-reacao="like" aria-pressed="false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            <span>Concordo</span>
          </button>
          <button type="button" class="mf-reaction-btn mf-reaction-dislike" data-feedback-reacao="dislike" aria-pressed="false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            <span>Discordo</span>
          </button>
        </div>

        <div class="mf-compose">
          <label class="mf-compose-label" for="modalFeedbackComentario">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            O que você achou?
          </label>
          <div class="mf-compose-box">
            <textarea id="modalFeedbackComentario" maxlength="1000" placeholder="Escreva sua opinião sobre esta análise…" rows="3"></textarea>
            <div class="mf-compose-bar">
              <small class="mf-char-counter"><span data-feedback-char-count>0</span><em>/1000</em></small>
              <div class="mf-compose-actions">
                <button type="button" class="mf-btn-ghost" data-feedback-cancelar hidden>Cancelar</button>
                <button type="button" class="mf-btn-send" data-feedback-salvar>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  <span data-feedback-save-label>Publicar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Status e ações secundárias ── -->
      <div class="mf-status-row">
        <p class="mf-status" data-feedback-status aria-live="polite">Carregando…</p>
        <button type="button" class="mf-btn-ghost mf-edit-main" data-feedback-editar-geral hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar opinião
        </button>
      </div>

      <!-- ── Nova informação ── -->
      <div class="mf-new-info" data-new-info>
        <button type="button" class="mf-new-info-toggle" data-new-info-toggle>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Avisar o site sobre uma nova informação
        </button>
        <div class="mf-new-info-form" data-new-info-form hidden>
          <div class="mf-new-info-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Surgiu um novo fato sobre esta notícia?</span>
          </div>
          <p class="mf-new-info-desc">
            Use este espaço para avisar a equipe do VerusAI de que existem
            informações novas ou atualizações sobre esta notícia. Vamos analisar
            o que você enviar e, se for o caso, atualizar a verificação.
          </p>
          <div class="mf-compose-box">
            <textarea id="modalNovaInformacao" maxlength="3000" placeholder="Conte qual novo fato ou atualização surgiu sobre esta notícia…" rows="3"></textarea>
            <div class="mf-compose-bar">
              <small class="mf-char-counter"><span data-new-info-count>0</span><em>/3000</em></small>
              <div class="mf-compose-actions">
                <button type="button" class="mf-btn-ghost" data-new-info-cancelar>Cancelar</button>
                <button type="button" class="mf-btn-send" data-new-info-enviar>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Enviar
                </button>
              </div>
            </div>
          </div>
          <p class="mf-status" data-new-info-status aria-live="polite"></p>
        </div>
      </div>

      <!-- ── Lista de comentários ── -->
      <div class="mf-comments-section">
        <div class="mf-comments-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Comentários da comunidade</span>
        </div>
        <div class="mf-comments-list" data-feedback-comments aria-live="polite">
          <p class="mf-empty">Carregando comentários…</p>
        </div>
      </div>

    </section>
  `;
}

function normalizarAuthFeedback(auth = {}) {
  const authToken = String(auth.authToken || "").trim();
  const email = String(auth.email || "").trim().toLowerCase();
  const nome = String(auth.nome || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return {
    carregado: true,
    logado: auth.logado === true && Boolean(authToken),
    email,
    nome: nome || (email ? email.split("@")[0] : ""),
    authToken,
  };
}

function atualizarAuthFeedback(auth = {}) {
  feedbackAuthState = normalizarAuthFeedback(auth);
  const waiters = feedbackAuthWaiters;
  feedbackAuthWaiters = [];
  waiters.forEach(resolve => resolve(feedbackAuthState));
  return feedbackAuthState;
}

function solicitarAuthFeedback() {
  if (feedbackAuthState.carregado) {
    return Promise.resolve(feedbackAuthState);
  }

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      atualizarAuthFeedback({ logado: false });
    }, 600);

    feedbackAuthWaiters.push((auth) => {
      clearTimeout(timeout);
      resolve(auth);
    });

    try {
      if (window.chrome?.storage?.local) {
        window.chrome.storage.local.get(
          ["logado", "email", "nome", "authToken"],
          atualizarAuthFeedback,
        );
      }
    } catch (err) {}

    window.postMessage(
      { source: "VerusSite", type: "VERUS_AUTH_REQUEST" },
      window.location.origin,
    );
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "VerusAIExtension") return;
  if (event.data?.type !== "VERUS_AUTH_STATE") return;
  const auth = atualizarAuthFeedback(event.data.payload || {});
  document.querySelectorAll(".modal-feedback").forEach(section => {
    const url = section.dataset.feedbackUrl || "";
    if (url) aplicarFeedbackNaUI(section, lerFeedbackLocal(url), auth);
  });
  // Se o usuário está na aba "Minha atividade", recarrega com o login recebido.
  if (document.body.classList.contains("view-atividade")) {
    iniciarAtividade();
  }
});

function chaveFeedbackLocal(url) {
  return `${FEEDBACK_STORAGE_PREFIX}${url}`;
}

function normalizarFeedbackLocal(feedback = {}) {
  return {
    reacao: feedback.reacao === "like" || feedback.reacao === "dislike"
      ? feedback.reacao
      : "",
    comentario: String(feedback.comentario || "").slice(0, 1000),
    resumo: normalizarResumoFeedback(feedback.resumo),
    atualizadoEm: feedback.atualizadoEm || "",
  };
}

function normalizarResumoFeedback(resumo = {}) {
  return {
    likes: Math.max(0, Number(resumo.likes || 0)),
    dislikes: Math.max(0, Number(resumo.dislikes || 0)),
    comentarios: Math.max(0, Number(resumo.comentarios || 0)),
  };
}

function normalizarComentariosFeedback(comentarios = []) {
  if (!Array.isArray(comentarios)) return [];
  return comentarios
    .map((comentario) => ({
      id: comentario?.id ?? null,
      reacao:
        comentario?.reacao === "like" || comentario?.reacao === "dislike"
          ? comentario.reacao
          : "",
      comentario: String(comentario?.comentario || "").trim().slice(0, 1000),
      usuarioNome: String(comentario?.usuarioNome || "Usuário")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "Usuário",
      proprioUsuario: comentario?.proprioUsuario === true,
      editado: comentario?.editado === true,
      atualizadoEm: comentario?.atualizadoEm || "",
      likes: Math.max(0, Number(comentario?.likes || 0)),
      dislikes: Math.max(0, Number(comentario?.dislikes || 0)),
      votoUsuario:
        comentario?.votoUsuario === "like" || comentario?.votoUsuario === "dislike"
          ? comentario.votoUsuario
          : "",
      selos: Array.isArray(comentario?.selos)
        ? comentario.selos
            .filter((s) => s && SELO_ICONES[s.id])
            .map((s) => ({ id: String(s.id), nome: String(s.nome || "") }))
        : [],
    }))
    .filter((comentario) => comentario.comentario);
}

// Mini-selos exibidos ao lado do nome no comentário. Mostra até 4 ícones e
// resume o excedente em "+N" para não poluir.
function selosComentarioHTML(selos = []) {
  if (!Array.isArray(selos) || !selos.length) return "";
  const MAX = 4;
  const icones = selos
    .slice(0, MAX)
    .map((s) => {
      const arquivo = SELO_ICONES[s.id];
      if (!arquivo) return "";
      const elite = SELOS_ELITE.has(s.id) ? " mf-selo-elite" : "";
      return `<img class="mf-selo${elite}" src="/assets/selos/${arquivo}" alt=""
                   title="${escapeHTML(s.nome || "")}" loading="lazy" onerror="this.remove()">`;
    })
    .join("");
  const resto = selos.length - MAX;
  const mais =
    resto > 0
      ? `<span class="mf-selo-mais" title="Mais ${resto} selo${resto === 1 ? "" : "s"}">+${resto}</span>`
      : "";
  if (!icones && !mais) return "";
  return `<span class="mf-selos" aria-label="Selos da comunidade">${icones}${mais}</span>`;
}

function feedbackEstaSalvo(feedback = {}) {
  return Boolean(
    feedback.atualizadoEm && (feedback.reacao || feedback.comentario),
  );
}

function lerFeedbackLocal(url) {
  try {
    return normalizarFeedbackLocal(
      JSON.parse(localStorage.getItem(chaveFeedbackLocal(url)) || "{}"),
    );
  } catch (err) {
    return normalizarFeedbackLocal();
  }
}

function salvarFeedbackLocal(url, feedback) {
  try {
    localStorage.setItem(
      chaveFeedbackLocal(url),
      JSON.stringify(normalizarFeedbackLocal(feedback)),
    );
  } catch (err) {}
}

function capturarFeedbackAtual(url) {
  const section = document.querySelector(".modal-feedback");
  if (!section || section.dataset.feedbackUrl !== url) return null;

  const ativo = section.querySelector(".mf-reaction-btn.ativo, .modal-feedback-btn.ativo");
  const textarea = section.querySelector("#modalFeedbackComentario");

  return normalizarFeedbackLocal({
    ...lerFeedbackLocal(url),
    reacao: ativo?.dataset.feedbackReacao || "",
    comentario: textarea?.value || "",
  });
}

function preservarFeedbackAtual(url) {
  const atual = capturarFeedbackAtual(url);
  if (!atual) return;
  if (atual.reacao || atual.comentario) salvarFeedbackLocal(url, atual);
}

function formatarContagemFeedback(valor, singular, plural) {
  const total = Math.max(0, Number(valor || 0));
  return `${total} ${total === 1 ? singular : plural}`;
}

function atualizarResumoFeedback(section, resumo = {}) {
  const dados = normalizarResumoFeedback(resumo);
  const likes = section.querySelector("[data-feedback-like-count]");
  const dislikes = section.querySelector("[data-feedback-dislike-count]");
  const comentarios = section.querySelector("[data-feedback-comment-count]");

  if (likes) likes.textContent = Math.max(0, Number(dados.likes || 0));
  if (dislikes) dislikes.textContent = Math.max(0, Number(dados.dislikes || 0));
  if (comentarios) comentarios.textContent = Math.max(0, Number(dados.comentarios || 0));
}

function atualizarFormularioFeedback(section, feedback = {}, auth = feedbackAuthState) {
  const logado = auth?.logado === true && Boolean(auth.authToken);
  const salvo = feedbackEstaSalvo(feedback);
  const editando = section.dataset.feedbackEditando === "true";
  const form = section.querySelector("[data-feedback-form]");
  const titulo = section.querySelector("[data-feedback-title]");
  const intro = section.querySelector("[data-feedback-intro]");
  const salvarBtn = section.querySelector("[data-feedback-salvar]");
  const cancelarBtn = section.querySelector("[data-feedback-cancelar]");
  const editarGeralBtn = section.querySelector("[data-feedback-editar-geral]");

  section.dataset.feedbackSalvo = salvo ? "true" : "false";
  section.dataset.feedbackLogado = logado ? "true" : "false";
  if (form) form.hidden = !logado || (salvo && !editando);
  if (salvarBtn) {
    const salvarLabel = salvarBtn.querySelector("[data-feedback-save-label]");
    if (salvarLabel) salvarLabel.textContent = editando ? "Atualizar" : "Publicar";
    else salvarBtn.textContent = editando ? "Atualizar" : "Publicar";
  }
  if (cancelarBtn) cancelarBtn.hidden = !editando;
  if (editarGeralBtn) editarGeralBtn.hidden = !logado || !salvo || editando;
  if (titulo) {
    titulo.textContent = editando
      ? "Editar opinião"
      : logado && !salvo
        ? "Sua opinião"
        : "Comentários da notícia";
  }
  if (intro) {
    if (!logado) {
      intro.textContent = "Entre na extensão para deixar sua opinião.";
    } else if (editando) {
      intro.textContent = "Altere sua reação ou comentário e salve novamente.";
    } else if (salvo) {
      intro.textContent = "Sua opinião já foi salva. Você pode editá-la pelo seu comentário.";
    } else {
      intro.textContent = `Você está opinando como ${auth.nome || auth.email.split("@")[0]}.`;
    }
  }
}

function atualizarBotoesFeedback(section, reacao) {
  section.querySelectorAll(".mf-reaction-btn").forEach(btn => {
    const ativo = btn.dataset.feedbackReacao === reacao;
    btn.classList.toggle("ativo", ativo);
    btn.setAttribute("aria-pressed", ativo ? "true" : "false");
  });
}

function atualizarContadorFeedback(section) {
  const textarea = section.querySelector("#modalFeedbackComentario");
  const contador = section.querySelector("[data-feedback-char-count]");
  if (textarea && contador) contador.textContent = String(textarea.value.length);
}

function formatarDataFeedback(value) {
  if (!value) return "";
  const normalizada = String(value).includes("T")
    ? String(value)
    : `${String(value).replace(" ", "T")}Z`;
  const data = new Date(normalizada);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelReacaoFeedback(reacao) {
  if (reacao === "like") return "Like";
  if (reacao === "dislike") return "Dislike";
  return "Opinião";
}

function iniciaisUsuarioFeedback(nome) {
  const partes = String(nome || "Usuario")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (!partes.length) return "U";
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
  return `${primeira}${ultima}`.toUpperCase();
}

function renderizarComentariosFeedback(comentarios = []) {
  const lista = normalizarComentariosFeedback(comentarios);
  if (!lista.length) {
    return `<p class="mf-empty">Nenhum comentário ainda. Seja o primeiro!</p>`;
  }

  return lista
    .map((comentario) => {
      const data = formatarDataFeedback(comentario.atualizadoEm);
      const reacao = labelReacaoFeedback(comentario.reacao);
      const autor = comentario.proprioUsuario ? "Você" : comentario.usuarioNome;
      const classe = comentario.proprioUsuario ? " proprio" : "";
      const reacaoClasse = tokenClasse(comentario.reacao || "opiniao");
      const iniciais = iniciaisUsuarioFeedback(autor);
      const id = comentario.id;
      const votos = id
        ? `
            <div class="mf-comment-votes" role="group" aria-label="Avaliar comentário">
              <button type="button" class="mf-cv-btn mf-cv-like${comentario.votoUsuario === "like" ? " ativo" : ""}"
                data-comentario-voto="like" data-comentario-id="${id}"
                aria-pressed="${comentario.votoUsuario === "like"}" title="Curtir comentário">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                <span data-cv-likes>${comentario.likes}</span>
              </button>
              <button type="button" class="mf-cv-btn mf-cv-dislike${comentario.votoUsuario === "dislike" ? " ativo" : ""}"
                data-comentario-voto="dislike" data-comentario-id="${id}"
                aria-pressed="${comentario.votoUsuario === "dislike"}" title="Descurtir comentário">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                <span data-cv-dislikes>${comentario.dislikes}</span>
              </button>
            </div>
          `
        : "";
      return `
        <article class="mf-comment mf-comment-${reacaoClasse}${classe}"${id ? ` data-comentario-row="${id}"` : ""}>
          <div class="mf-comment-avatar" aria-hidden="true">${escapeHTML(iniciais)}</div>
          <div class="mf-comment-body">
            <div class="mf-comment-head">
              <div class="mf-comment-author">
                <strong>${escapeHTML(autor)}</strong>
                ${comentario.proprioUsuario ? `<span class="mf-badge mf-badge-you">Você</span>` : ""}
                ${selosComentarioHTML(comentario.selos)}
              </div>
              <div class="mf-comment-meta">
                ${comentario.reacao === "like" ? `<span class="mf-badge mf-badge-like">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  Concordo</span>` : comentario.reacao === "dislike" ? `<span class="mf-badge mf-badge-dislike">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  Discordo</span>` : ""}
                ${comentario.editado ? `<span class="mf-badge mf-badge-edited">editado</span>` : ""}
                ${data ? `<time class="mf-time">${escapeHTML(data)}</time>` : ""}
              </div>
            </div>
            <p class="mf-comment-text">${escapeHTML(comentario.comentario)}</p>
            <div class="mf-comment-actions">
              ${votos}
              ${comentario.proprioUsuario ? `
                <button type="button" class="mf-btn-ghost mf-btn-edit-inline" data-feedback-editar>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
              ` : ""}
              ${!comentario.proprioUsuario && id ? `
                <button type="button" class="mf-btn-ghost mf-btn-denunciar"
                  data-denunciar-usuario data-comentario-id="${id}"
                  data-usuario-nome="${escapeHTML(autor)}" title="Denunciar usuário">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  Denunciar
                </button>
              ` : ""}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function atualizarComentariosFeedback(section, comentarios = []) {
  const lista = section.querySelector("[data-feedback-comments]");
  if (!lista) return;
  lista.innerHTML = renderizarComentariosFeedback(comentarios);
}

function setComentariosFeedbackMensagem(section, mensagem) {
  const lista = section.querySelector("[data-feedback-comments]");
  if (!lista) return;
  lista.innerHTML = `<p class="mf-empty">${escapeHTML(mensagem)}</p>`;
}

async function votarComentario(section, comentarioId, reacao, auth) {
  const id = Number(comentarioId);
  if (!id || (reacao !== "like" && reacao !== "dislike")) return;

  if (!auth?.logado || !auth.authToken) {
    setStatusFeedback(section, "Entre na extensão para avaliar um comentário.", "erro");
    return;
  }

  try {
    const res = await fetch("/api/analises/comentario/voto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken: auth.authToken, comentarioId: id, reacao }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || "Não foi possível avaliar o comentário.");
    atualizarVotoComentarioUI(section, id, data);
  } catch (err) {
    setStatusFeedback(section, err.message || "Não foi possível avaliar agora.", "erro");
  }
}

function atualizarVotoComentarioUI(section, comentarioId, data) {
  const article = section.querySelector(
    `.mf-comment[data-comentario-row="${comentarioId}"]`,
  );
  if (!article) return;

  const likesEl = article.querySelector("[data-cv-likes]");
  const dislikesEl = article.querySelector("[data-cv-dislikes]");
  if (likesEl) likesEl.textContent = Number(data.likes || 0);
  if (dislikesEl) dislikesEl.textContent = Number(data.dislikes || 0);

  const likeBtn = article.querySelector(".mf-cv-like");
  const dislikeBtn = article.querySelector(".mf-cv-dislike");
  if (likeBtn) {
    const on = data.votoUsuario === "like";
    likeBtn.classList.toggle("ativo", on);
    likeBtn.setAttribute("aria-pressed", String(on));
  }
  if (dislikeBtn) {
    const on = data.votoUsuario === "dislike";
    dislikeBtn.classList.toggle("ativo", on);
    dislikeBtn.setAttribute("aria-pressed", String(on));
  }
}

function aplicarFeedbackNaUI(section, feedback = {}, auth = feedbackAuthState) {
  const dados = normalizarFeedbackLocal(feedback);
  const textarea = section.querySelector("#modalFeedbackComentario");

  atualizarBotoesFeedback(section, dados.reacao);
  atualizarResumoFeedback(section, dados.resumo);
  atualizarFormularioFeedback(section, dados, auth);

  if (textarea && section.dataset.feedbackEditado !== "true") {
    textarea.value = dados.comentario;
  }

  atualizarContadorFeedback(section);
}

function setStatusFeedback(section, mensagem, tipo = "") {
  const status = section.querySelector("[data-feedback-status]");
  if (!status) return;
  status.textContent = mensagem;
  status.dataset.tipo = tipo;
}

async function carregarFeedbackServidor(url, authToken = "") {
  const params = new URLSearchParams({ url });
  if (authToken) params.set("authToken", authToken);
  const res = await fetch(`/api/analises/feedback?${params.toString()}`);
  if (!res.ok) throw new Error("Não foi possível carregar o feedback.");
  return res.json();
}

async function salvarFeedbackServidor(analise, feedback, auth) {
  const res = await fetch("/api/analises/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: analise.url,
      titulo: analise.title || analise.titulo || "",
      authToken: auth?.authToken || "",
      reacao: feedback.reacao,
      comentario: feedback.comentario,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.erro || "Não foi possível salvar a opinião.");
  }
  return data;
}

async function enviarNovaInformacaoServidor(analise, mensagem, auth) {
  const res = await fetch("/api/analises/nova-informacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: analise.url,
      titulo: analise.title || analise.titulo || "",
      authToken: auth?.authToken || "",
      mensagem,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.erro || "Não foi possível enviar a informação.");
  }
  return data;
}

function setStatusNovaInformacao(section, mensagem, tipo = "") {
  const status = section.querySelector("[data-new-info-status]");
  if (!status) return;
  status.textContent = mensagem;
  status.dataset.tipo = tipo;
}

function atualizarContadorNovaInformacao(section) {
  const textarea = section.querySelector("#modalNovaInformacao");
  const contador = section.querySelector("[data-new-info-count]");
  if (textarea && contador) contador.textContent = String(textarea.value.length);
}

function fecharNovaInformacao(section) {
  const form = section.querySelector("[data-new-info-form]");
  const textarea = section.querySelector("#modalNovaInformacao");
  if (form) form.hidden = true;
  if (textarea) textarea.value = "";
  atualizarContadorNovaInformacao(section);
  setStatusNovaInformacao(section, "", "");
}

function iniciarEdicaoFeedback(section, feedback, auth) {
  if (!auth?.logado || !auth.authToken) {
    setStatusFeedback(section, "Entre na extensão para editar sua opinião.", "erro");
    return;
  }

  section.dataset.feedbackEditando = "true";
  section.dataset.feedbackEditado = "";
  aplicarFeedbackNaUI(section, feedback, auth);

  const textarea = section.querySelector("#modalFeedbackComentario");
  if (textarea) {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  setStatusFeedback(section, "Editando sua opinião.", "");
}

function configurarFeedbackNoticia(a) {
  const section = document.querySelector(".modal-feedback");
  if (!section || !a?.url) return;

  const url = a.url;
  let authAtual = feedbackAuthState;
  let feedbackAtual = lerFeedbackLocal(url);

  aplicarFeedbackNaUI(section, feedbackAtual, authAtual);

  section.querySelectorAll(".mf-reaction-btn, .modal-feedback-btn").forEach(btn => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const novaReacao = btn.dataset.feedbackReacao;
      section.dataset.feedbackEditado = "true";
      feedbackAtual = normalizarFeedbackLocal({
        ...feedbackAtual,
        reacao: feedbackAtual.reacao === novaReacao ? "" : novaReacao,
      });
      salvarFeedbackLocal(url, feedbackAtual);
      aplicarFeedbackNaUI(section, feedbackAtual, authAtual);
    });
  });

  const textarea = section.querySelector("#modalFeedbackComentario");
  if (textarea) {
    textarea.addEventListener("input", () => {
      section.dataset.feedbackEditado = "true";
      feedbackAtual = normalizarFeedbackLocal({
        ...feedbackAtual,
        comentario: textarea.value,
      });
      salvarFeedbackLocal(url, feedbackAtual);
      atualizarContadorFeedback(section);
    });
  }

  const comentariosEl = section.querySelector("[data-feedback-comments]");
  if (comentariosEl) {
    comentariosEl.addEventListener("click", (event) => {
      const votoBtn = event.target.closest("[data-comentario-voto]");
      if (votoBtn) {
        votarComentario(
          section,
          votoBtn.dataset.comentarioId,
          votoBtn.dataset.comentarioVoto,
          authAtual,
        );
        return;
      }

      const denunciarBtn = event.target.closest("[data-denunciar-usuario]");
      if (denunciarBtn) {
        abrirDenunciaUsuario(
          denunciarBtn.dataset.comentarioId,
          denunciarBtn.dataset.usuarioNome,
        );
        return;
      }

      const editarBtn = event.target.closest("[data-feedback-editar]");
      if (!editarBtn) return;
      iniciarEdicaoFeedback(section, feedbackAtual, authAtual);
    });
  }

  const cancelarBtn = section.querySelector("[data-feedback-cancelar]");
  if (cancelarBtn) {
    cancelarBtn.addEventListener("click", () => {
      section.dataset.feedbackEditando = "";
      section.dataset.feedbackEditado = "";
      aplicarFeedbackNaUI(section, feedbackAtual, authAtual);
      setStatusFeedback(section, "Edição cancelada.", "");
    });
  }

  const editarGeralBtn = section.querySelector("[data-feedback-editar-geral]");
  if (editarGeralBtn) {
    editarGeralBtn.addEventListener("click", () => {
      iniciarEdicaoFeedback(section, feedbackAtual, authAtual);
    });
  }

  const novaInfoForm = section.querySelector("[data-new-info-form]");
  const novaInfoTextarea = section.querySelector("#modalNovaInformacao");
  const novaInfoToggle = section.querySelector("[data-new-info-toggle]");
  const novaInfoCancelar = section.querySelector("[data-new-info-cancelar]");
  const novaInfoEnviar = section.querySelector("[data-new-info-enviar]");

  if (novaInfoTextarea) {
    novaInfoTextarea.addEventListener("input", () => {
      atualizarContadorNovaInformacao(section);
    });
  }

  if (novaInfoToggle) {
    novaInfoToggle.addEventListener("click", () => {
      if (!authAtual.logado || !authAtual.authToken) {
        setStatusNovaInformacao(
          section,
          "Entre na extensão para enviar uma nova informação.",
          "erro",
        );
        return;
      }

      if (novaInfoForm) novaInfoForm.hidden = false;
      setStatusNovaInformacao(section, "", "");
      atualizarContadorNovaInformacao(section);
      if (novaInfoTextarea) novaInfoTextarea.focus();
    });
  }

  if (novaInfoCancelar) {
    novaInfoCancelar.addEventListener("click", () => {
      fecharNovaInformacao(section);
    });
  }

  if (novaInfoEnviar) {
    novaInfoEnviar.addEventListener("click", async () => {
      if (!authAtual.logado || !authAtual.authToken) {
        setStatusNovaInformacao(
          section,
          "Entre na extensão para enviar uma nova informação.",
          "erro",
        );
        return;
      }

      const mensagem = (novaInfoTextarea?.value || "").trim();
      if (mensagem.length < 10) {
        setStatusNovaInformacao(
          section,
          "Descreva a nova informação com pelo menos 10 caracteres.",
          "erro",
        );
        return;
      }

      novaInfoEnviar.disabled = true;
      setStatusNovaInformacao(section, "Enviando informação...", "");

      try {
        await enviarNovaInformacaoServidor(a, mensagem, authAtual);
        fecharNovaInformacao(section);
        setStatusNovaInformacao(
          section,
          "Informação enviada para a empresa.",
          "sucesso",
        );
      } catch (err) {
        setStatusNovaInformacao(
          section,
          err.message || "Não foi possível enviar agora.",
          "erro",
        );
      } finally {
        novaInfoEnviar.disabled = false;
      }
    });
  }

  const salvarBtn = section.querySelector("[data-feedback-salvar]");
  if (salvarBtn) {
    salvarBtn.addEventListener("click", async () => {
      if (!authAtual.logado || !authAtual.authToken) {
        setStatusFeedback(section, "Entre na extensão para salvar sua opinião.", "erro");
        return;
      }

      feedbackAtual = normalizarFeedbackLocal({
        ...feedbackAtual,
        comentario: textarea ? textarea.value.trim() : "",
      });

      if (!feedbackAtual.reacao && !feedbackAtual.comentario) {
        setStatusFeedback(section, "Escolha like ou dislike, ou escreva uma opinião.", "erro");
        return;
      }

      salvarBtn.disabled = true;
      setStatusFeedback(section, "Salvando opinião...", "");

      try {
        const estavaEditando = section.dataset.feedbackEditando === "true";
        const data = await salvarFeedbackServidor(a, feedbackAtual, authAtual);
        feedbackAtual = normalizarFeedbackLocal({
          ...(data.feedback || feedbackAtual),
          resumo: data.resumo || feedbackAtual.resumo,
        });
        section.dataset.feedbackEditado = "";
        section.dataset.feedbackEditando = "";
        salvarFeedbackLocal(url, feedbackAtual);
        aplicarFeedbackNaUI(section, feedbackAtual, authAtual);
        atualizarComentariosFeedback(section, data.comentarios || []);
        setStatusFeedback(
          section,
          estavaEditando ? "Opinião atualizada." : "Opinião salva.",
          "sucesso",
        );
      } catch (err) {
        salvarFeedbackLocal(url, feedbackAtual);
        setStatusFeedback(
          section,
          err.message || "Não foi possível enviar agora. Tente novamente.",
          "erro",
        );
      } finally {
        salvarBtn.disabled = false;
      }
    });
  }

  solicitarAuthFeedback()
    .then(auth => {
      authAtual = auth;
      aplicarFeedbackNaUI(section, feedbackAtual, authAtual);
      return carregarFeedbackServidor(url, authAtual.authToken);
    })
    .then(data => {
      if (!document.body.contains(section) || section.dataset.feedbackUrl !== url) return;

      const resumo = data.resumo || {};
      if (section.dataset.feedbackEditado === "true") {
        feedbackAtual = normalizarFeedbackLocal({ ...feedbackAtual, resumo });
        atualizarResumoFeedback(section, resumo);
        atualizarFormularioFeedback(section, feedbackAtual, authAtual);
        atualizarComentariosFeedback(section, data.comentarios || []);
        salvarFeedbackLocal(url, feedbackAtual);
        return;
      }

      feedbackAtual = normalizarFeedbackLocal({
        ...(data.feedback || feedbackAtual),
        resumo,
      });
      salvarFeedbackLocal(url, feedbackAtual);
      aplicarFeedbackNaUI(section, feedbackAtual, authAtual);
      atualizarComentariosFeedback(section, data.comentarios || []);
      if (!authAtual.logado) {
        setStatusFeedback(section, "Entre na extensão para deixar sua opinião.", "");
      } else {
        setStatusFeedback(
          section,
          data.feedback ? "Sua opinião já foi salva." : "Você ainda não avaliou esta notícia.",
          "",
        );
      }
    })
    .catch(() => {
      setComentariosFeedbackMensagem(section, "Não foi possível carregar comentários agora.");
      setStatusFeedback(section, "Sua opinião fica salva neste navegador se a conexão falhar.", "");
    });
}

function fecharModal() {
  document.getElementById("modalOverlay").classList.remove("aberta");
  document.body.style.overflow = "";
}

window.addEventListener("scroll", ocultarPreviewCard, true);
window.addEventListener("resize", ocultarPreviewCard);

// ─── Admin ─────────────────────────────────────────────────────────────────
function configurarSobre() {
  const btn = document.getElementById("sobreBtn");
  if (!btn) return;

  btn.addEventListener("click", abrirSobre);
}

function abrirSobre() {
  const overlay = document.getElementById("modalOverlay");
  const conteudo = document.getElementById("modalConteudo");
  if (!overlay || !conteudo) return;

  conteudo.innerHTML = `
    <span class="modal-veracity sobre-chip">Sobre</span>
    <h2>Como o VerusAI trabalha</h2>
    <p class="modal-body">
      O VerusAI organiza noticias verificadas para ajudar a entender o que
      circula online com mais contexto, fontes e clareza.
    </p>
    <div class="sobre-flow">
      <span>Coletamos a noticia</span>
      <span>Comparamos com fontes</span>
      <span>Classificamos o resultado</span>
      <span>Mostramos resumo e evidencias</span>
    </div>
    <p class="modal-body">
      A ideia e simples: quando uma informacao parecer duvidosa, voce consegue
      consultar uma analise resumida e ver quais referencias sustentam a
      classificacao.
    </p>
  `;

  overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";
}

function configurarAdmin() {
  const toggle = document.getElementById("adminToggle");
  const panel  = document.getElementById("adminPanel");

  toggle.addEventListener("click", () => {
    panel.classList.toggle("visivel");
  });

  document.getElementById("adminRemover").addEventListener("click", async () => {
    const key = document.getElementById("adminKey").value.trim();
    const url = document.getElementById("adminUrl").value.trim();
    const msg = document.getElementById("adminMsg");

    if (!key) { msg.textContent = "⚠ Informe a chave admin."; return; }
    if (!url)  { msg.textContent = "⚠ Informe a URL a remover."; return; }

    try {
      const res = await fetch("/api/analises", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey: key, url }),
      });

      if (!res.ok) throw new Error("Nao foi possivel remover a analise.");

      todasAnalises = todasAnalises.filter(a => a.url !== url);
      aplicarFiltros();
      msg.textContent = "✅ Análise removida com sucesso.";
      document.getElementById("adminUrl").value = "";
    } catch (err) {
      console.error("[site] erro ao remover analise:", err);
      msg.textContent = "❌ Não foi possível remover essa análise.";
    }
  });
}

// ─── Utilitários ───────────────────────────────────────────────────────────
function normalizarAnaliseApi(item) {
  const sources = Array.isArray(item.sources)
    ? item.sources
    : Array.isArray(item.fontes)
      ? item.fontes
      : [];
  const fontesConsultadas = normalizarFontesConsultadas(
    item.fontesConsultadas || item.fontes_consultadas || item.fontesPrincipais || []
  );
  const entidadesMencionadas = normalizarEntidadesMencionadas(
    item.entidadesMencionadas || item.entidades || []
  );

  return {
    id: item.id || item.url || "",
    url: item.url || "",
    title: item.title || item.titulo || item.url || "Analise sem titulo",
    summary: item.summary || item.resumo || "",
    veracity: item.veracity || item.veredito || "mixed",
    vereditoGeral: item.vereditoGeral || "",
    veiculo: item.veiculo || item.paginaOrigem || item.resultado?.veiculo || "",
    score: item.score ?? null,
    nivelConfiabilidade: item.nivelConfiabilidade || "",
    sources,
    fontesConsultadas,
    entidadesMencionadas,
    total_likes: Math.max(0, Number(item.total_likes ?? item.totalLikes ?? 0)),
    total_dislikes: Math.max(0, Number(item.total_dislikes ?? item.totalDislikes ?? 0)),
    date: item.date || normalizarDataPublica(item.createdAt || item.checkedAt),
    checkedAt: item.checkedAt || item.createdAt || "",
    publishedDate: item.publishedDate || "",
    resultado: item.resultado || null,
    avisoAtualizacao:
      item.avisoAtualizacao ||
      item.aviso_atualizacao ||
      item.resultado?.avisoAtualizacao ||
      null,
  };
}

function normalizarDataPublica(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  } catch {}
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function tentarHost(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url.slice(0, 30); }
}

function formatarData(dateStr) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "short", year: "numeric"
    }).format(new Date(dateStr + "T12:00:00"));
  } catch { return dateStr; }
}

function normalizarTexto(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizarFonte(fonte) {
  const chave = String(fonte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return FONTE_ALIASES[chave] || chave;
}

function valorFonteFiltro(fonte) {
  return fonte === null ? FONTE_NULA : normalizarFonte(fonte);
}

function listarFontesAnalise(analise) {
  if (Array.isArray(analise.sources)) return analise.sources;
  if (analise.sources !== undefined && analise.sources !== null) return [analise.sources];
  return [];
}

function fonteCombinaFiltro(analise, filtro) {
  if (!filtro) return true;

  const fontes = listarFontesAnalise(analise);

  if (filtro === FONTE_NULA) {
    return fontes.length === 0 ||
      fontes.some(fonte => fonte === null || fonte === undefined || normalizarFonte(fonte) === "null");
  }

  if (filtro === "outro") {
    return fontes.some(fonte => {
      const normalizada = normalizarFonte(fonte);
      return normalizada === "outro" ||
        Boolean(normalizada && normalizada !== "null" && !FONTES_OFICIAIS_NORMALIZADAS.has(normalizada));
    });
  }

  return fontes.some(fonte => normalizarFonte(fonte) === filtro);
}

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ─── Ranking de Fontes ───────────────────────────────────────────────────────
const FONTES_POR_PAGINA = 10;
let fontesCarregado = false;
let fontesDados = [];
let fonteDenunciaAtual = "";
let fontesFiltro = "todas";
let fontesBusca = "";
let fontesPaginaAtual = 1;

function configurarFontes() {
  const refresh = document.getElementById("fontesRefresh");
  if (refresh) refresh.addEventListener("click", () => carregarFontes(true));

  const filtros = document.getElementById("fontesFiltros");
  if (filtros) {
    filtros.querySelectorAll(".fontes-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chip.classList.contains("ativo")) return;
        filtros
          .querySelectorAll(".fontes-chip")
          .forEach((c) => c.classList.remove("ativo"));
        chip.classList.add("ativo");
        fontesFiltro = chip.dataset.fonteFiltro || "todas";
        fontesPaginaAtual = 1;
        renderizarFontes(fontesDados);
      });
    });
  }

  const busca = document.getElementById("fontesBusca");
  if (busca) {
    busca.addEventListener("input", (e) => {
      fontesBusca = normalizarTexto(e.target.value);
      fontesPaginaAtual = 1;
      renderizarFontes(fontesDados);
    });
  }

  const lista = document.getElementById("fontesLista");
  if (lista) {
    lista.addEventListener("click", (event) => {
      const voteBtn = event.target.closest("[data-fonte-voto]");
      if (voteBtn) {
        votarFonte(voteBtn.dataset.fonteDominio, voteBtn.dataset.fonteVoto);
        return;
      }
      const denunciaBtn = event.target.closest("[data-fonte-denunciar]");
      if (denunciaBtn) {
        abrirDenunciaFonte(denunciaBtn.dataset.fonteDominio);
        return;
      }
      const analisesBtn = event.target.closest("[data-fonte-analises]");
      if (analisesBtn) {
        abrirAnalisesFonte(analisesBtn.dataset.fonteAnalises);
      }
    });
  }

  configurarModalDenuncia();
  configurarModalDenunciaUsuario();
  configurarModalAnalises();
  configurarParceiros();
}

function iniciarFontes() {
  if (!fontesCarregado) {
    fontesCarregado = true;
    carregarFontes();
  }
}

function setFontesStatus(mensagem) {
  const status = document.getElementById("fontesStatus");
  if (status) status.textContent = mensagem;
}

function encontrarFonteCard(dominio) {
  return (
    Array.from(document.querySelectorAll(".fonte-card")).find(
      (card) => card.dataset.fonteRow === dominio,
    ) || null
  );
}

async function carregarFontes(forcar = false) {
  const lista = document.getElementById("fontesLista");
  const status = document.getElementById("fontesStatus");
  if (!lista) return;

  if (status) status.textContent = "Carregando…";
  if (forcar || !lista.querySelector(".fonte-card")) {
    lista.innerHTML = `<div class="loading">Carregando fontes…</div>`;
  }

  try {
    const auth = await solicitarAuthFeedback();
    const params = new URLSearchParams();
    if (auth?.authToken) params.set("authToken", auth.authToken);
    const qs = params.toString();
    const res = await fetch(`/api/fontes${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error("Falha ao carregar fontes");
    const data = await res.json();
    fontesDados = Array.isArray(data.fontes) ? data.fontes : [];
    renderizarFontes(fontesDados);
    if (status) {
      status.textContent = `${fontesDados.length} ${fontesDados.length === 1 ? "fonte" : "fontes"}`;
    }
  } catch (err) {
    console.error("[fontes] erro:", err);
    lista.innerHTML = `
      <div class="vazio"><p>Não foi possível carregar o ranking agora.</p></div>`;
    if (status) status.textContent = "Erro ao carregar";
  }
}

function filtrarFontes(fontes) {
  let resultado = fontes;

  if (fontesFiltro === "analisadas") {
    resultado = resultado.filter((f) => f.analisada);
  } else if (fontesFiltro === "nao_analisadas") {
    resultado = resultado.filter((f) => !f.analisada);
  }

  if (fontesBusca) {
    resultado = resultado.filter((f) =>
      normalizarTexto(f.dominio).includes(fontesBusca),
    );
  }

  return resultado;
}

function renderizarFontesStats(fontes) {
  const el = document.getElementById("fontesStats");
  if (!el) return;

  const totalFontes = fontes.length;
  const totalAnalisadas = fontes.filter((f) => f.analisada).length;
  const totalDenuncias = fontes.reduce((s, f) => s + (f.denuncias || 0), 0);

  el.innerHTML = `
    <div class="fontes-stat">
      <span class="fontes-stat-num">${totalFontes}</span>
      <span class="fontes-stat-label">Fontes</span>
    </div>
    <div class="fontes-stat">
      <span class="fontes-stat-num">${totalAnalisadas}</span>
      <span class="fontes-stat-label">Analisadas</span>
    </div>
    <div class="fontes-stat">
      <span class="fontes-stat-num">${totalDenuncias}</span>
      <span class="fontes-stat-label">Denúncias</span>
    </div>
  `;
}

function renderizarFontes(fontes) {
  const lista = document.getElementById("fontesLista");
  if (!lista) return;
  renderizarFontesStats(fontes);

  if (!fontes.length) {
    lista.innerHTML = `
      <div class="vazio"><p>Nenhuma fonte cadastrada ainda.</p></div>`;
    renderizarFontesPaginacao(0);
    return;
  }

  const visiveis = filtrarFontes(fontes);
  if (!visiveis.length) {
    const msg = fontesBusca
      ? "Nenhuma fonte encontrada para esta busca."
      : `Nenhuma fonte ${
          fontesFiltro === "analisadas" ? "analisada" : "sem análise"
        } no momento.`;
    lista.innerHTML = `<div class="vazio"><p>${escapeHTML(msg)}</p></div>`;
    renderizarFontesPaginacao(0);
    return;
  }

  const totalPaginas = Math.ceil(visiveis.length / FONTES_POR_PAGINA);
  if (fontesPaginaAtual > totalPaginas) fontesPaginaAtual = totalPaginas;
  if (fontesPaginaAtual < 1) fontesPaginaAtual = 1;

  const inicio = (fontesPaginaAtual - 1) * FONTES_POR_PAGINA;
  const pagina = visiveis.slice(inicio, inicio + FONTES_POR_PAGINA);

  lista.innerHTML = pagina
    .map((fonte, i) => criarFonteCardHTML(fonte, inicio + i + 1))
    .join("");

  renderizarFontesPaginacao(totalPaginas);
}

function renderizarFontesPaginacao(totalPaginas) {
  const pag = document.getElementById("fontesPaginacao");
  if (!pag) return;
  pag.innerHTML = "";

  if (totalPaginas <= 1) return;

  const btnAnterior = document.createElement("button");
  btnAnterior.className = "pag-btn";
  btnAnterior.textContent = "←";
  btnAnterior.disabled = fontesPaginaAtual === 1;
  btnAnterior.addEventListener("click", () => irFontesPagina(fontesPaginaAtual - 1));
  pag.appendChild(btnAnterior);

  for (let p = 1; p <= totalPaginas; p++) {
    if (
      p === 1 ||
      p === totalPaginas ||
      (p >= fontesPaginaAtual - 1 && p <= fontesPaginaAtual + 1)
    ) {
      const btn = document.createElement("button");
      btn.className = "pag-btn" + (p === fontesPaginaAtual ? " ativo" : "");
      btn.textContent = p;
      btn.addEventListener("click", () => irFontesPagina(p));
      pag.appendChild(btn);
    } else if (p === fontesPaginaAtual - 2 || p === fontesPaginaAtual + 2) {
      const ell = document.createElement("span");
      ell.textContent = "…";
      ell.style.cssText =
        "font-family:var(--font-mono);padding:0 0.3rem;opacity:.5";
      pag.appendChild(ell);
    }
  }

  const btnProx = document.createElement("button");
  btnProx.className = "pag-btn";
  btnProx.textContent = "→";
  btnProx.disabled = fontesPaginaAtual === totalPaginas;
  btnProx.addEventListener("click", () => irFontesPagina(fontesPaginaAtual + 1));
  pag.appendChild(btnProx);
}

function irFontesPagina(p) {
  fontesPaginaAtual = p;
  renderizarFontes(fontesDados);
  const secao = document.getElementById("fontesView");
  if (secao) {
    window.scrollTo({ top: secao.offsetTop - 80, behavior: "smooth" });
  }
}

function criarFonteCardHTML(f, posicao) {
  const dominio = escapeHTML(f.dominio);
  const likeAtivo = f.reacaoUsuario === "like" ? " ativo" : "";
  const dislikeAtivo = f.reacaoUsuario === "dislike" ? " ativo" : "";
  const denunciaInfo =
    f.denuncias > 0
      ? `<span class="fonte-denuncia-count" title="${f.denuncias} denúncia(s)">⚑ ${f.denuncias}</span>`
      : "";
  const semAnaliseTag = f.analisada
    ? ""
    : `<span class="fonte-tag-sem-analise">sem análises</span>`;
  const logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(f.dominio)}&sz=64`;
  const iniciais = escapeHTML(f.dominio.charAt(0).toUpperCase() || "?");
  const siteUrl = `https://${dominio}`;

  return `
    <article class="fonte-card${f.analisada ? "" : " fonte-card-sem-analise"}" data-fonte-row="${dominio}">
      <div class="fonte-rank">${posicao}</div>
      <a class="fonte-logo" href="${siteUrl}" target="_blank" rel="noopener noreferrer"
        title="Abrir ${dominio} em nova aba" aria-label="Abrir ${dominio} em nova aba">
        <span class="fonte-logo-fallback">${iniciais}</span>
        <img src="${logoUrl}" alt="" loading="lazy"
          onload="this.parentElement.classList.add('tem-logo')"
          onerror="this.remove()" />
      </a>
      <div class="fonte-main">
        <div class="fonte-head">
          <a class="fonte-dominio" href="${siteUrl}" target="_blank" rel="noopener noreferrer"
            title="Abrir ${dominio} em nova aba">${dominio}<span class="fonte-ext" aria-hidden="true">↗</span></a>
          ${semAnaliseTag}
          ${denunciaInfo}
        </div>
        <div class="fonte-metrics">
          ${
            f.analisada
              ? `<span>${f.totalAnalises} análise${f.totalAnalises === 1 ? "" : "s"}</span>
          <span class="fonte-veracidade">
            <span class="fv-true" title="Verdadeiras">✅ ${f.verdadeiras}</span>
            <span class="fv-mixed" title="Mistas">⚠️ ${f.mistas}</span>
            <span class="fv-false" title="Falsas">❌ ${f.falsas}</span>
          </span>
          <span title="Confiabilidade média">${f.mediaScore}% conf.</span>`
              : `<span>Nenhuma notícia desta fonte foi analisada ainda</span>`
          }
        </div>
        ${
          f.analisada
            ? `<button type="button" class="fonte-ver-analises"
                data-fonte-analises="${dominio}">
                Ver notícias analisadas (${f.totalAnalises})
              </button>`
            : ""
        }
      </div>
      <div class="fonte-acoes">
        <div class="fonte-votos">
          <button type="button" class="fonte-voto fonte-like${likeAtivo}"
            data-fonte-voto="like" data-fonte-dominio="${dominio}"
            aria-pressed="${f.reacaoUsuario === "like"}" title="Confiável">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            <span data-fonte-likes>${f.likes}</span>
          </button>
          <button type="button" class="fonte-voto fonte-dislike${dislikeAtivo}"
            data-fonte-voto="dislike" data-fonte-dominio="${dominio}"
            aria-pressed="${f.reacaoUsuario === "dislike"}" title="Pouco confiável">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            <span data-fonte-dislikes>${f.dislikes}</span>
          </button>
        </div>
        <button type="button" class="fonte-denunciar"
          data-fonte-denunciar data-fonte-dominio="${dominio}">⚑ Denunciar</button>
      </div>
    </article>
  `;
}

async function votarFonte(dominio, reacao) {
  if (!dominio || (reacao !== "like" && reacao !== "dislike")) return;

  const auth = await solicitarAuthFeedback();
  if (!auth?.logado || !auth.authToken) {
    setFontesStatus("Entre na extensão para avaliar uma fonte.");
    return;
  }

  try {
    const res = await fetch("/api/fontes/voto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken: auth.authToken, dominio, reacao }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || "Não foi possível avaliar.");
    atualizarFonteVotoCard(dominio, data);
  } catch (err) {
    setFontesStatus(err.message || "Não foi possível avaliar agora.");
  }
}

function atualizarFonteVotoCard(dominio, data) {
  const item = fontesDados.find((f) => f.dominio === dominio);
  if (item) {
    item.likes = Number(data.likes || 0);
    item.dislikes = Number(data.dislikes || 0);
    item.saldo = Number(data.saldo || 0);
    item.reacaoUsuario = data.reacaoUsuario || "";
  }

  const card = encontrarFonteCard(dominio);
  if (!card) return;

  const likesEl = card.querySelector("[data-fonte-likes]");
  const dislikesEl = card.querySelector("[data-fonte-dislikes]");
  if (likesEl) likesEl.textContent = Number(data.likes || 0);
  if (dislikesEl) dislikesEl.textContent = Number(data.dislikes || 0);

  const likeBtn = card.querySelector(".fonte-like");
  const dislikeBtn = card.querySelector(".fonte-dislike");
  if (likeBtn) {
    const on = data.reacaoUsuario === "like";
    likeBtn.classList.toggle("ativo", on);
    likeBtn.setAttribute("aria-pressed", String(on));
  }
  if (dislikeBtn) {
    const on = data.reacaoUsuario === "dislike";
    dislikeBtn.classList.toggle("ativo", on);
    dislikeBtn.setAttribute("aria-pressed", String(on));
  }
}

// ── Denúncia de usuário (a partir de um comentário) ──────────────────────────
let usuarioDenunciaAtual = null;

function configurarModalDenunciaUsuario() {
  const overlay = document.getElementById("usuarioDenunciaOverlay");
  if (!overlay) return;

  const fechar = document.getElementById("usuarioDenunciaFechar");
  const cancelar = document.getElementById("usuarioDenunciaCancelar");
  const enviar = document.getElementById("usuarioDenunciaEnviar");

  if (fechar) fechar.addEventListener("click", fecharDenunciaUsuario);
  if (cancelar) cancelar.addEventListener("click", fecharDenunciaUsuario);
  if (enviar) enviar.addEventListener("click", enviarDenunciaUsuario);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharDenunciaUsuario();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("aberta")) {
      fecharDenunciaUsuario();
    }
  });
}

async function abrirDenunciaUsuario(comentarioId, nome) {
  const id = Number(comentarioId);
  if (!id) return;
  usuarioDenunciaAtual = id;

  const overlay = document.getElementById("usuarioDenunciaOverlay");
  const nomeEl = document.getElementById("udNome");
  const motivo = document.getElementById("udMotivo");
  const comentario = document.getElementById("udComentario");
  const status = document.getElementById("udStatus");

  if (nomeEl) nomeEl.textContent = nome || "este usuário";
  if (motivo) motivo.value = "";
  if (comentario) comentario.value = "";
  if (status) {
    status.textContent = "";
    status.dataset.tipo = "";
  }

  if (overlay) overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";

  // Avisa se não estiver logado (o envio também revalida).
  const auth = await solicitarAuthFeedback();
  if ((!auth?.logado || !auth.authToken) && status) {
    status.textContent = "Entre pela extensão para concluir a denúncia.";
    status.dataset.tipo = "erro";
  }
}

function fecharDenunciaUsuario() {
  const overlay = document.getElementById("usuarioDenunciaOverlay");
  if (overlay) overlay.classList.remove("aberta");
  document.body.style.overflow = "";
  usuarioDenunciaAtual = null;
}

async function enviarDenunciaUsuario() {
  const status = document.getElementById("udStatus");
  const enviar = document.getElementById("usuarioDenunciaEnviar");
  const motivo = document.getElementById("udMotivo")?.value || "";
  const comentario = document.getElementById("udComentario")?.value || "";

  function setStatusLocal(mensagem, tipo = "") {
    if (status) {
      status.textContent = mensagem;
      status.dataset.tipo = tipo;
    }
  }

  if (!usuarioDenunciaAtual) return;
  if (!motivo) {
    setStatusLocal("Selecione um motivo para a denúncia.", "erro");
    return;
  }

  const auth = await solicitarAuthFeedback();
  if (!auth?.logado || !auth.authToken) {
    setStatusLocal("Entre na extensão para denunciar.", "erro");
    return;
  }

  if (enviar) enviar.disabled = true;
  setStatusLocal("Enviando denúncia…");

  try {
    const res = await fetch("/api/usuarios/denuncia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authToken: auth.authToken,
        comentarioId: usuarioDenunciaAtual,
        motivo,
        comentario,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || "Não foi possível denunciar.");

    setStatusLocal(data.mensagem || "Denúncia registrada. Obrigado!", "sucesso");
    setTimeout(fecharDenunciaUsuario, 1200);
  } catch (err) {
    setStatusLocal(err.message || "Não foi possível denunciar agora.", "erro");
  } finally {
    if (enviar) enviar.disabled = false;
  }
}

function configurarModalDenuncia() {
  const overlay = document.getElementById("fonteDenunciaOverlay");
  if (!overlay) return;

  const fechar = document.getElementById("fonteDenunciaFechar");
  const cancelar = document.getElementById("fonteDenunciaCancelar");
  const enviar = document.getElementById("fonteDenunciaEnviar");

  if (fechar) fechar.addEventListener("click", fecharDenunciaFonte);
  if (cancelar) cancelar.addEventListener("click", fecharDenunciaFonte);
  if (enviar) enviar.addEventListener("click", enviarDenunciaFonte);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharDenunciaFonte();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("aberta")) {
      fecharDenunciaFonte();
    }
  });
}

async function abrirDenunciaFonte(dominio) {
  if (!dominio) return;

  const auth = await solicitarAuthFeedback();
  if (!auth?.logado || !auth.authToken) {
    setFontesStatus("Entre na extensão para denunciar uma fonte.");
    return;
  }

  fonteDenunciaAtual = dominio;
  const overlay = document.getElementById("fonteDenunciaOverlay");
  const dominioEl = document.getElementById("fdDominio");
  const motivo = document.getElementById("fdMotivo");
  const comentario = document.getElementById("fdComentario");
  const status = document.getElementById("fdStatus");

  if (dominioEl) dominioEl.textContent = dominio;
  if (motivo) motivo.value = "";
  if (comentario) comentario.value = "";
  if (status) {
    status.textContent = "";
    status.dataset.tipo = "";
  }

  if (overlay) overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";
}

function fecharDenunciaFonte() {
  const overlay = document.getElementById("fonteDenunciaOverlay");
  if (overlay) overlay.classList.remove("aberta");
  document.body.style.overflow = "";
  fonteDenunciaAtual = "";
}

async function enviarDenunciaFonte() {
  const status = document.getElementById("fdStatus");
  const enviar = document.getElementById("fonteDenunciaEnviar");
  const motivo = document.getElementById("fdMotivo")?.value || "";
  const comentario = document.getElementById("fdComentario")?.value || "";

  function setStatus(mensagem, tipo = "") {
    if (status) {
      status.textContent = mensagem;
      status.dataset.tipo = tipo;
    }
  }

  if (!fonteDenunciaAtual) return;
  if (!motivo) {
    setStatus("Selecione um motivo para a denúncia.", "erro");
    return;
  }

  const auth = await solicitarAuthFeedback();
  if (!auth?.logado || !auth.authToken) {
    setStatus("Entre na extensão para denunciar.", "erro");
    return;
  }

  if (enviar) enviar.disabled = true;
  setStatus("Enviando denúncia…");

  try {
    const res = await fetch("/api/fontes/denuncia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authToken: auth.authToken,
        dominio: fonteDenunciaAtual,
        motivo,
        comentario,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || "Não foi possível denunciar.");

    const item = fontesDados.find((f) => f.dominio === fonteDenunciaAtual);
    const totalDenuncias = Number(
      data.denuncias ?? (item ? item.denuncias + 1 : 1),
    );
    if (item) item.denuncias = totalDenuncias;
    atualizarFonteDenunciaCard(fonteDenunciaAtual, totalDenuncias);
    renderizarFontesStats(fontesDados);

    setStatus(data.mensagem || "Denúncia registrada. Obrigado!", "sucesso");
    setTimeout(fecharDenunciaFonte, 1200);
  } catch (err) {
    setStatus(err.message || "Não foi possível denunciar agora.", "erro");
  } finally {
    if (enviar) enviar.disabled = false;
  }
}

function atualizarFonteDenunciaCard(dominio, denuncias) {
  const card = encontrarFonteCard(dominio);
  if (!card) return;

  const head = card.querySelector(".fonte-head");
  let countEl = card.querySelector(".fonte-denuncia-count");
  const total = Number(denuncias || 0);

  if (total <= 0) {
    if (countEl) countEl.remove();
    return;
  }

  if (!countEl) {
    countEl = document.createElement("span");
    countEl.className = "fonte-denuncia-count";
    if (head) head.appendChild(countEl);
  }
  countEl.title = `${total} denúncia(s)`;
  countEl.textContent = `⚑ ${total}`;
}

// ─── Modal: notícias analisadas de uma fonte ─────────────────────────────────
function configurarModalAnalises() {
  const overlay = document.getElementById("fonteAnalisesOverlay");
  if (!overlay) return;

  const fechar = document.getElementById("fonteAnalisesFechar");
  if (fechar) fechar.addEventListener("click", fecharAnalisesFonte);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharAnalisesFonte();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("aberta")) {
      fecharAnalisesFonte();
    }
  });

  // Cada notícia abre a análise completa (mesmo modal do histórico).
  const lista = document.getElementById("faLista");
  if (lista) {
    lista.addEventListener("click", (event) => {
      const item = event.target.closest("[data-fa-url]");
      if (!item) return;
      const analise = todasAnalises.find((a) => a.url === item.dataset.faUrl);
      if (analise) {
        fecharAnalisesFonte();
        abrirModal(analise);
      }
    });
  }
}

function abrirAnalisesFonte(dominio) {
  if (!dominio) return;

  const overlay = document.getElementById("fonteAnalisesOverlay");
  const dominioEl = document.getElementById("faDominio");
  const lista = document.getElementById("faLista");
  if (!overlay || !lista) return;

  if (dominioEl) dominioEl.textContent = dominio;

  const analises = todasAnalises
    .filter((a) => tentarHost(a.url) === dominio)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  if (!analises.length) {
    lista.innerHTML = `
      <div class="fa-vazio">As análises desta fonte não estão disponíveis no momento.</div>`;
  } else {
    const label = { true: "✅ Verdadeiro", false: "❌ Falso", mixed: "⚠️ Misto" };
    lista.innerHTML = analises
      .map((a) => {
        const data = a.date ? formatarData(a.date) : "";
        return `
          <button type="button" class="fa-item" data-fa-url="${escapeHTML(a.url)}">
            <span class="fa-item-vered ${a.veracity}">${label[a.veracity] || a.veracity}</span>
            <span class="fa-item-corpo">
              <span class="fa-item-titulo">${escapeHTML(a.title)}</span>
              <span class="fa-item-meta">${data ? escapeHTML(data) : ""}${
                a.score != null ? `${data ? " · " : ""}${a.score}% conf.` : ""
              }</span>
            </span>
            <span class="fa-item-seta" aria-hidden="true">→</span>
          </button>`;
      })
      .join("");
  }

  overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";
}

function fecharAnalisesFonte() {
  const overlay = document.getElementById("fonteAnalisesOverlay");
  if (overlay) overlay.classList.remove("aberta");
  document.body.style.overflow = "";
}

// ─── Abas (Análises / Ao Vivo) ───────────────────────────────────────────────
function configurarAbas() {
  const tabs = document.getElementById("tabs");
  if (!tabs) return;

  tabs.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const view = btn.dataset.view;

      if (view === "analises") {
        // A aba "Análises" é uma cascata: entra na aba e abre o menu.
        const jaNaAba =
          document.querySelector("#tabs .tab-btn.ativo")?.dataset.view ===
          "analises";
        setMainView("analises");
        if (jaNaAba) {
          abrirMenuAnalises(); // já estava aqui: só alterna o menu
        } else {
          setSubAba("lista"); // entrou agora: começa na lista
          abrirMenuAnalises(true);
        }
        e.stopPropagation();
        return;
      }

      setMainView(view);
      abrirMenuAnalises(false);
    });
  });

  // Itens do menu cascata (lista x dashboard).
  const menu = document.getElementById("analisesMenu");
  if (menu) {
    menu.querySelectorAll(".tab-menu-item").forEach(item => {
      item.addEventListener("click", e => {
        e.stopPropagation();
        setSubAba(item.dataset.sub);
        abrirMenuAnalises(false);
      });
    });
  }

  // Clique fora fecha o menu cascata.
  document.addEventListener("click", e => {
    const dd = document.getElementById("analisesDropdown");
    if (dd && !dd.contains(e.target)) abrirMenuAnalises(false);
  });

  // Ícone de usuário no cabeçalho: logado abre "Minha atividade"; deslogado
  // mostra um aviso pedindo para entrar pela extensão.
  const userBtn = document.getElementById("userBtn");
  if (userBtn) {
    userBtn.addEventListener("click", async () => {
      if (!feedbackAuthState.carregado) await solicitarAuthFeedback();
      if (!feedbackAuthState.logado || !feedbackAuthState.authToken) {
        mostrarToastCompartilhar(
          "Entre na sua conta pela extensão VerusAI para ver sua atividade.",
        );
        return;
      }
      setMainView("atividade");
    });
  }
}

function setMainView(view) {
  const tabs = document.getElementById("tabs");
  if (tabs) {
    tabs
      .querySelectorAll(".tab-btn")
      .forEach(b => b.classList.toggle("ativo", b.dataset.view === view));
  }
  trocarView(view);
}

// CTAs da aba "Parceiros" que levam o usuário a outras views do site.
function configurarParceiros() {
  const view = document.getElementById("parceirosView");
  if (!view) return;
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ir-view]");
    if (!btn) return;
    setMainView(btn.dataset.irView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function trocarView(view) {
  // Ao sair de "Análises", volta a sub-aba para a lista e fecha a cascata.
  if (view !== "analises") {
    setSubAba("lista");
    abrirMenuAnalises(false);
  }

  const aoVivo = view === "aovivo";
  const fontes = view === "fontes";
  const analisar = view === "analisar";
  const transparencia = view === "transparencia";
  const atividade = view === "atividade";
  const aprender = view === "aprender";
  const comunidade = view === "comunidade";
  const parceiros = view === "parceiros";
  document.body.classList.toggle("view-aovivo", aoVivo);
  document.body.classList.toggle("view-fontes", fontes);
  document.body.classList.toggle("view-analisar", analisar);
  document.body.classList.toggle("view-transparencia", transparencia);
  document.body.classList.toggle("view-atividade", atividade);
  document.body.classList.toggle("view-aprender", aprender);
  document.body.classList.toggle("view-comunidade", comunidade);
  document.body.classList.toggle("view-parceiros", parceiros);

  const secaoAoVivo = document.getElementById("aoVivo");
  if (secaoAoVivo) secaoAoVivo.hidden = !aoVivo;
  const secaoFontes = document.getElementById("fontesView");
  if (secaoFontes) secaoFontes.hidden = !fontes;
  const secaoAnalisar = document.getElementById("analisarView");
  if (secaoAnalisar) secaoAnalisar.hidden = !analisar;
  const secaoTransp = document.getElementById("transpView");
  if (secaoTransp) secaoTransp.hidden = !transparencia;
  const secaoAtividade = document.getElementById("atividadeView");
  if (secaoAtividade) secaoAtividade.hidden = !atividade;
  const userBtn = document.getElementById("userBtn");
  if (userBtn) userBtn.classList.toggle("ativo", atividade);
  const secaoAprender = document.getElementById("aprenderView");
  if (secaoAprender) secaoAprender.hidden = !aprender;
  const secaoComunidade = document.getElementById("comunidadeView");
  if (secaoComunidade) secaoComunidade.hidden = !comunidade;
  const secaoParceiros = document.getElementById("parceirosView");
  if (secaoParceiros) secaoParceiros.hidden = !parceiros;

  if (aoVivo) {
    iniciarAoVivo();
  } else {
    pararAutoRefreshAoVivo();
  }

  if (fontes) {
    iniciarFontes();
  }

  if (transparencia) {
    iniciarTransparencia();
  }

  if (atividade) {
    iniciarAtividade();
  }

  if (aprender) {
    iniciarAprender();
  }

  if (comunidade) {
    iniciarComunidade();
  }
}

// ─── Comunidade (ranking, selos e atividade) ─────────────────────────────────
function iniciarComunidade() {
  const view = document.getElementById("comunidadeView");
  if (!view) return;
  view.innerHTML = `<div class="loading">Carregando a comunidade…</div>`;
  fetch("/api/comunidade")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
    .then((data) => renderizarComunidade(view, data))
    .catch(() => {
      view.innerHTML = `<div class="vazio"><p>Não foi possível carregar a
        comunidade agora. Tente novamente em instantes.</p></div>`;
    });
}

function renderizarComunidade(view, data) {
  const totalMembros = Number(data.totalMembros || 0).toLocaleString("pt-BR");

  const ranking = (data.ranking || []).length
    ? data.ranking
        .map((m, i) => {
          const pos = i + 1;
          const top = pos <= 3 ? ` com-rank-top com-rank-${pos}` : "";
          return `
          <li class="com-rank-item${top}">
            <span class="com-rank-pos">${pos}</span>
            <span class="com-rank-avatar" aria-hidden="true">${escapeHTML(iniciaisUsuarioFeedback(m.nome))}</span>
            <div class="com-rank-info">
              <span class="com-rank-nome">${escapeHTML(m.nome)}</span>
              ${selosComentarioHTML(m.selos)}
            </div>
            <div class="com-rank-stats">
              <span class="com-rank-pontos">${Number(m.pontos || 0).toLocaleString("pt-BR")} pts</span>
              <span class="com-rank-selos">${m.totalSelos} selo${m.totalSelos === 1 ? "" : "s"}</span>
            </div>
          </li>`;
        })
        .join("")
    : `<li class="com-vazio">Ainda não há participação suficiente para um
       ranking. Seja o primeiro a comentar e avaliar!</li>`;

  const selos = (data.catalogo || [])
    .map((s) => {
      const arquivo = SELO_ICONES[s.id];
      const elite = SELOS_ELITE.has(s.id) ? " com-selo-elite" : "";
      const img = arquivo
        ? `<img class="com-selo-img" src="/assets/selos/${arquivo}" alt="" loading="lazy" onerror="this.remove()">`
        : "";
      return `
      <div class="com-selo${elite}" title="${escapeHTML(s.descricao)}">
        ${img}
        <span class="com-selo-nome">${escapeHTML(s.nome)}</span>
        <span class="com-selo-desc">${escapeHTML(s.descricao)}</span>
      </div>`;
    })
    .join("");

  const atividade = (data.atividade || []).length
    ? data.atividade
        .map((a) => {
          const dataTxt = formatarDataFeedback(a.data);
          return `
          <li class="com-ativ-item">
            <div class="com-ativ-head">
              <span class="com-ativ-nome">${escapeHTML(a.nome)}</span>
              ${selosComentarioHTML(a.selos)}
              ${dataTxt ? `<time class="com-ativ-data">${escapeHTML(dataTxt)}</time>` : ""}
            </div>
            <p class="com-ativ-texto">${escapeHTML(a.comentario)}</p>
            ${a.titulo ? `<span class="com-ativ-fonte">em “${escapeHTML(a.titulo)}”</span>` : ""}
          </li>`;
        })
        .join("")
    : `<li class="com-vazio">Nenhum comentário ainda. Que tal começar?</li>`;

  view.innerHTML = `
    <header class="com-hero">
      <span class="com-hero-tag">Comunidade VerusAI</span>
      <h2 class="com-hero-titulo">Quem faz a checagem acontecer</h2>
      <p class="com-hero-sub">
        <strong>${totalMembros}</strong> pessoas já participam verificando
        notícias, avaliando fontes e debatendo cada análise.
      </p>
    </header>

    <div class="com-colunas">
      <section class="com-bloco">
        <h3 class="com-titulo">🏆 Ranking de engajamento</h3>
        <ol class="com-rank-lista">${ranking}</ol>
      </section>

      <section class="com-bloco">
        <h3 class="com-titulo">💬 Atividade recente</h3>
        <ul class="com-ativ-lista">${atividade}</ul>
      </section>
    </div>

    <section class="com-bloco">
      <h3 class="com-titulo">⭐ Selos da comunidade</h3>
      <p class="com-selos-intro">
        Contribua para desbloquear os ${(data.catalogo || []).length} selos —
        os dourados são os mais raros.
      </p>
      <div class="com-selos-grid">${selos}</div>
    </section>`;
}

// ─── Minha atividade (perfil do usuário com contribuições) ───────────────────
const AT_MOTIVOS = {
  desinformacao: "Desinformação",
  sensacionalismo: "Sensacionalismo",
  sem_fontes: "Sem fontes",
  conteudo_ofensivo: "Conteúdo ofensivo",
  spam: "Spam",
  outro: "Outro",
};

// Ícone (selo ilustrado) de cada badge da comunidade. A chave é o `id` definido
// em definirBadgesAtividade() no servidor; o valor é o arquivo em /assets/selos.
const SELO_ICONES = {
  primeiros_passos: "PrimeirosPassos.png",
  primeira_opiniao: "PrimeiraOpniao.png",
  comentarista: "Comentarista.png",
  voz_ativa: "VozAtiva.png",
  comentarista_elite: "ComentaristaDeElite.png",
  curador: "Curador.png",
  curador_dedicado: "CuradorDedicado.png",
  avaliador_fontes: "OlhoClinico.png",
  critico_fontes: "CriticoDeFontes.png",
  guardiao: "Guardiao.png",
  fiscal: "Fiscal.png",
  apoiador: "Apoiador.png",
  engajado: "Engajado.png",
  querido: "VozRespeitada.png",
  influente: "Influente.png",
  idolo: "IdoloDaComunidade.png",
  veterano: "Veterano.png",
  lenda: "Lenda.png",
};

// Selos de elite (os mais difíceis) — ganham destaque dourado.
const SELOS_ELITE = new Set(["lenda", "idolo", "veterano"]);

async function iniciarAtividade() {
  const view = document.getElementById("atividadeView");
  if (!view) return;
  view.innerHTML = `<div class="loading">Carregando sua atividade…</div>`;

  // Garante que o estado de login já chegou pela ponte com a extensão.
  if (!feedbackAuthState.carregado) await solicitarAuthFeedback();
  if (!feedbackAuthState.logado) await aguardarAuthLogado(2500);

  const auth = feedbackAuthState;
  if (!auth.logado || !auth.authToken) {
    renderizarAtividadeDeslogado(view);
    return;
  }
  carregarAtividade(auth.authToken);
}

function renderizarAtividadeDeslogado(view) {
  view.innerHTML = `
    <div class="at-deslogado">
      <h2>Minha atividade</h2>
      <p>Entre na sua conta pela extensão VerusAI para ver e acompanhar suas
         contribuições — comentários, avaliações, denúncias e seus selos.</p>
      <button class="at-retry" id="atRetry" type="button">Já entrei, atualizar</button>
    </div>`;
  const btn = document.getElementById("atRetry");
  if (btn) {
    btn.addEventListener("click", async () => {
      await aguardarAuthLogado(3000);
      iniciarAtividade();
    });
  }
}

async function carregarAtividade(token) {
  const view = document.getElementById("atividadeView");
  if (!view) return;
  try {
    const res = await fetch(
      `/api/usuario/atividade?authToken=${encodeURIComponent(token)}`,
    );
    if (res.status === 401) return renderizarAtividadeDeslogado(view);
    if (!res.ok) throw new Error("falha");
    const data = await res.json();
    renderizarAtividade(view, data);
  } catch {
    view.innerHTML = `
      <div class="vazio"><p>Não foi possível carregar sua atividade agora.
      Tente novamente em instantes.</p></div>`;
  }
}

function renderizarAtividade(view, data) {
  const r = data.resumo || {};
  const nome = data.usuario?.nome || "Usuário";
  const email = data.usuario?.email || "";
  const iniciais = iniciaisUsuarioFeedback(nome);

  const conquistados = (data.badges || []).filter(b => b.conquistado).length;

  const stats = [
    { n: r.comentarios, l: "Comentários" },
    { n: r.reacoesNoticias, l: "Reações em notícias" },
    { n: r.reacoesFontes, l: "Fontes avaliadas" },
    { n: r.denuncias, l: "Denúncias" },
    { n: r.votosComentarios, l: "Votos em comentários" },
    { n: r.curtidasRecebidas, l: "Curtidas recebidas" },
  ]
    .map(
      s => `
      <div class="at-stat">
        <span class="at-stat-num">${Number(s.n || 0)}</span>
        <span class="at-stat-label">${escapeHTML(s.l)}</span>
      </div>`,
    )
    .join("");

  const selos = (data.badges || [])
    .map(b => {
      const pct = b.meta ? Math.round((b.progresso / b.meta) * 100) : 0;
      const icone = SELO_ICONES[b.id];
      const marca = icone
        ? `<img class="at-selo-img" src="/assets/selos/${icone}" alt=""
               loading="lazy" onerror="this.remove()">`
        : `<span class="at-selo-mark" aria-hidden="true">${b.conquistado ? "★" : "☆"}</span>`;
      return `
      <div class="at-selo ${b.conquistado ? "conquistado" : "bloqueado"}${SELOS_ELITE.has(b.id) ? " elite" : ""}"
           title="${escapeHTML(b.descricao)}">
        ${marca}
        <span class="at-selo-nome">${escapeHTML(b.nome)}</span>
        <span class="at-selo-desc">${escapeHTML(b.descricao)}</span>
        ${
          b.conquistado
            ? `<span class="at-selo-tag">Conquistado</span>`
            : `<span class="at-selo-prog"><span style="width:${pct}%"></span></span>
               <span class="at-selo-meta">${b.progresso}/${b.meta}</span>`
        }
      </div>`;
    })
    .join("");

  const comentarios = (data.comentarios || []).length
    ? (data.comentarios || [])
        .map(c => {
          const reacao =
            c.reacao === "like"
              ? "curtiu"
              : c.reacao === "dislike"
                ? "não curtiu"
                : "";
          const dataTxt = formatarDataFeedback(c.data);
          return `
          <li class="at-coment">
            <button class="at-coment-titulo" type="button" data-url="${escapeHTML(c.url)}">
              ${escapeHTML(c.titulo)}
            </button>
            <p class="at-coment-texto">${escapeHTML(c.comentario)}</p>
            <div class="at-coment-meta">
              ${reacao ? `<span>${reacao}</span>` : ""}
              ${dataTxt ? `<time>${escapeHTML(dataTxt)}</time>` : ""}
              <span>${c.likes} curtida${c.likes === 1 ? "" : "s"}</span>
            </div>
          </li>`;
        })
        .join("")
    : `<li class="at-vazio">Você ainda não comentou em nenhuma análise.</li>`;

  const fontes = (data.fontesAvaliadas || []).length
    ? (data.fontesAvaliadas || [])
        .map(f => {
          const r2 = f.reacao === "like" ? "confiável" : "duvidosa";
          return `<li class="at-fonte"><span class="at-fonte-dom">${escapeHTML(f.dominio)}</span>
                  <span class="at-fonte-tag ${f.reacao}">${r2}</span></li>`;
        })
        .join("")
    : `<li class="at-vazio">Você ainda não avaliou nenhuma fonte.</li>`;

  const denuncias = (data.denuncias || []).length
    ? (data.denuncias || [])
        .map(d => {
          const motivo = AT_MOTIVOS[d.motivo] || d.motivo || "Outro";
          return `<li class="at-denuncia"><span class="at-fonte-dom">${escapeHTML(d.dominio)}</span>
                  <span class="at-denuncia-motivo">${escapeHTML(motivo)}</span></li>`;
        })
        .join("")
    : `<li class="at-vazio">Você ainda não denunciou nenhuma fonte.</li>`;

  view.innerHTML = `
    <header class="at-perfil">
      <span class="at-avatar" aria-hidden="true">${escapeHTML(iniciais)}</span>
      <div class="at-perfil-info">
        <h2 class="at-nome">${escapeHTML(nome)}</h2>
        ${email ? `<p class="at-email">${escapeHTML(email)}</p>` : ""}
        <p class="at-total">
          <strong>${Number(r.totalContribuicoes || 0)}</strong> contribuições ·
          <strong>${conquistados}</strong> selo${conquistados === 1 ? "" : "s"}
        </p>
      </div>
    </header>

    <h3 class="at-titulo">Selos</h3>
    <div class="at-selos">${selos}</div>

    <h3 class="at-titulo">Resumo</h3>
    <div class="at-stats">${stats}</div>

    <h3 class="at-titulo">Meus comentários</h3>
    <ul class="at-lista">${comentarios}</ul>

    <div class="at-colunas">
      <div>
        <h3 class="at-titulo">Fontes que avaliei</h3>
        <ul class="at-lista at-lista-compacta">${fontes}</ul>
      </div>
      <div>
        <h3 class="at-titulo">Minhas denúncias</h3>
        <ul class="at-lista at-lista-compacta">${denuncias}</ul>
      </div>
    </div>`;

  view.querySelectorAll(".at-coment-titulo").forEach(btn => {
    btn.addEventListener("click", () => abrirAnalisePorUrl(btn.dataset.url));
  });

  observarAnimacoes(view);
}

// Abre o modal da análise a partir só da URL (usado pela lista de comentários).
async function abrirAnalisePorUrl(url) {
  if (!url) return;
  try {
    const res = await fetch(
      `/api/analises/detalhe?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.analise) abrirModal(data.analise);
  } catch {}
}

// ─── Aprender: aula "Como analisar uma notícia" (passo a passo + quiz) ───────
// Tela de abertura (por que importa) → passos com resumo + pergunta → resultado
// final com a revisão de todas as questões.
const APRENDER_AULA = [
  {
    n: "01",
    titulo: "Leia além do título",
    resumo:
      "Manchetes são feitas para chamar atenção e muitas vezes exageram ou distorcem o conteúdo. Antes de acreditar ou compartilhar, leia a matéria inteira — o texto pode contradizer ou matizar o que o título promete.",
    pergunta: "Você vê uma manchete chocante nas redes. Qual é o primeiro passo?",
    opcoes: [
      "Compartilhar logo para avisar todo mundo",
      "Ler a matéria inteira antes de tirar conclusões",
      "Acreditar, porque a manchete parece convincente",
    ],
    correta: 1,
    exp: "A manchete pode exagerar ou distorcer. Leia o texto completo antes de concluir ou compartilhar.",
  },
  {
    n: "02",
    titulo: "Identifique a fonte",
    resumo:
      "Veja quem publicou: é um veículo conhecido, com página \"Sobre\", expediente e contato? Desconfie de domínios estranhos que imitam nomes famosos (ex.: \"g1-noticias.info\") e de perfis anônimos.",
    pergunta:
      "Um site com endereço \"g1-noticias-brasil.info\" imitando um veículo famoso é sinal de quê?",
    opcoes: [
      "Nada de mais, é só um endereço diferente",
      "Possível fonte falsa tentando se passar por confiável",
      "Que é a versão oficial mais rápida do veículo",
    ],
    correta: 1,
    exp: "Domínios que imitam nomes conhecidos são uma tática comum de sites falsos. Confira o endereço oficial.",
  },
  {
    n: "03",
    titulo: "Confira a data",
    resumo:
      "Notícias verdadeiras, mas antigas, voltam a circular fora de contexto e parecem atuais. Sempre verifique a data de publicação e se o fato ainda é válido hoje.",
    pergunta: "Por que vale a pena verificar a data de uma notícia?",
    opcoes: [
      "A data não importa para o conteúdo",
      "Porque notícias antigas podem recircular fora de contexto",
      "Só para saber se o site é novo",
    ],
    correta: 1,
    exp: "Fatos reais, porém antigos, voltam a circular como se fossem atuais. A data ajuda a evitar esse engano.",
  },
  {
    n: "04",
    titulo: "Cheque as evidências",
    resumo:
      "Boas reportagens citam fontes, dados e documentos, e trazem links que sustentam as afirmações. Frases vagas como \"especialistas dizem\", sem nomes, são um alerta.",
    pergunta: "Uma notícia que não cita nenhuma fonte, dado ou evidência deve ser:",
    opcoes: [
      "Aceita, se o título for convincente",
      "Tratada com desconfiança até ser confirmada",
      "Compartilhada para outros avaliarem",
    ],
    correta: 1,
    exp: "Sem fontes verificáveis, não há como sustentar a afirmação. Desconfie e busque confirmação.",
  },
  {
    n: "05",
    titulo: "Busque outras fontes",
    resumo:
      "Se um fato importante é real, vários veículos confiáveis costumam noticiá-lo. Se só um site obscuro publica algo bombástico, desconfie. Comparar fontes é a forma mais simples de confirmar.",
    pergunta: "Qual a melhor forma de confirmar se um fato é verdadeiro?",
    opcoes: [
      "Ver se tem muitas curtidas e compartilhamentos",
      "Buscar o mesmo fato em várias fontes confiáveis",
      "Confiar porque um amigo enviou",
    ],
    correta: 1,
    exp: "Quando algo é real e relevante, costuma aparecer em vários veículos confiáveis. Comparar fontes é essencial.",
  },
  {
    n: "06",
    titulo: "Reconheça os seus vieses",
    resumo:
      "Tendemos a acreditar mais facilmente no que confirma o que já pensamos — é o viés de confirmação. Conteúdo \"bom demais\" para o seu lado, ou \"revoltante demais\" contra o outro, pede um olhar ainda mais crítico.",
    pergunta: "O que é o \"viés de confirmação\"?",
    opcoes: [
      "A tendência de acreditar no que confirma o que já pensamos",
      "Um selo de confiança dos veículos",
      "Uma ferramenta de checagem de imagens",
    ],
    correta: 0,
    exp: "É a tendência de aceitar mais facilmente o que reforça nossas crenças — por isso é preciso ter ainda mais cautela nesses casos.",
  },
  {
    n: "07",
    titulo: "Cuidado com imagens e vídeos",
    resumo:
      "Fotos e vídeos podem ser editados ou usados fora de contexto (uma imagem antiga em um fato novo). Uma busca reversa de imagem ajuda a descobrir de onde aquela imagem realmente veio.",
    pergunta: "Uma imagem pode enganar quando:",
    opcoes: [
      "Nunca; foto é sempre prova definitiva",
      "É editada ou tirada de contexto (a busca reversa ajuda a checar)",
      "Apenas quando está em preto e branco",
    ],
    correta: 1,
    exp: "Imagens podem ser manipuladas ou reaproveitadas de outro contexto. A busca reversa revela a origem real.",
  },
  {
    n: "08",
    titulo: "Desconfie do apelo emocional",
    resumo:
      "A desinformação explora raiva, medo e indignação para se espalhar rápido. Mensagens que pedem \"compartilhe antes que apaguem\" são um clássico sinal de alerta.",
    pergunta:
      "Mensagens pedindo \"compartilhe urgente antes que apaguem\" geralmente são:",
    opcoes: [
      "Um aviso importante e confiável",
      "Tática para espalhar desinformação rápido",
      "Obrigatórias de repassar",
    ],
    correta: 1,
    exp: "A urgência serve para você compartilhar sem pensar. Pare e verifique antes de repassar.",
  },
  {
    n: "09",
    titulo: "Atenção a números e gráficos",
    resumo:
      "Dados impressionam, mas podem enganar: porcentagens sem base de comparação, estatísticas fora de contexto e gráficos com o eixo manipulado distorcem a realidade. Veja sempre a fonte e o período dos números.",
    pergunta: "Um gráfico cujo eixo não começa no zero pode:",
    opcoes: [
      "Exagerar visualmente diferenças que são pequenas",
      "Tornar os dados sempre mais precisos",
      "Não afetar em nada a interpretação",
    ],
    correta: 0,
    exp: "Cortar o eixo amplia visualmente as diferenças e pode induzir a uma conclusão errada. Observe a escala.",
  },
  {
    n: "10",
    titulo: "Sátira e conteúdo gerado por IA",
    resumo:
      "Sites de humor publicam notícias falsas de propósito — e podem ser confundidos com fatos reais. Além disso, textos, imagens e vídeos hoje podem ser criados por inteligência artificial (deepfakes) com aparência convincente.",
    pergunta: "Um vídeo muito realista pode ter sido inteiramente fabricado por IA?",
    opcoes: [
      "Não, vídeo é sempre prova de que algo aconteceu",
      "Sim; por isso é preciso confirmar em fontes confiáveis",
      "Só se estiver com baixa qualidade",
    ],
    correta: 1,
    exp: "Deepfakes podem imitar pessoas e cenas de forma convincente. Na dúvida, confirme em fontes confiáveis.",
  },
];

const APRENDER_ALERTAS = [
  "Título em CAIXA ALTA e com muitos pontos de exclamação",
  "Pedido para \"compartilhar antes que apaguem\"",
  "Sem data, sem autor e sem fontes citadas",
  "URL que imita um veículo famoso (com erros ou sufixos estranhos)",
  "Erros graves de português e diagramação amadora",
  "Promete revelar algo que \"a mídia esconde\"",
];

let aprenderState = {
  iniciado: false,
  passo: 0,
  respondido: false,
  escolha: -1,
  respostas: [],
};

function iniciarAprender() {
  renderAprender();
}

function renderAprender() {
  const view = document.getElementById("aprenderView");
  if (!view) return;

  if (!aprenderState.iniciado) {
    view.innerHTML = montarAprIntroHTML();
    const btn = view.querySelector("#aprComecar");
    if (btn) {
      btn.addEventListener("click", () => {
        aprenderState = {
          iniciado: true,
          passo: 0,
          respondido: false,
          escolha: -1,
          respostas: [],
        };
        renderAprender();
        view.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    observarAnimacoes(view);
    return;
  }

  if (aprenderState.passo >= APRENDER_AULA.length) {
    view.innerHTML = montarAprFinalHTML();
    const ref = view.querySelector("#aprRefazer");
    if (ref) {
      ref.addEventListener("click", () => {
        aprenderState = {
          iniciado: false,
          passo: 0,
          respondido: false,
          escolha: -1,
          respostas: [],
        };
        renderAprender();
        view.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    observarAnimacoes(view);
    return;
  }

  view.innerHTML = montarAprPassoHTML();

  const form = view.querySelector("#aprForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const sel = form.querySelector('input[name="aprOp"]:checked');
      if (!sel) {
        const aviso = form.querySelector("#aprAviso");
        if (aviso) aviso.hidden = false;
        return;
      }
      aprenderState.escolha = Number(sel.value);
      aprenderState.respondido = true;
      aprenderState.respostas[aprenderState.passo] = aprenderState.escolha;
      renderAprender();
    });
  }

  const prox = view.querySelector("#aprProximo");
  if (prox) {
    prox.addEventListener("click", () => {
      aprenderState.passo++;
      aprenderState.respondido = false;
      aprenderState.escolha = -1;
      renderAprender();
      view.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  observarAnimacoes(view);
}

function montarAprIntroHTML() {
  return `
    <div class="apr-intro-card reveal-card">
      <span class="apr-eyebrow">Aula · Educação midiática</span>
      <h2 class="apr-intro-titulo">Como analisar uma notícia</h2>
      <p class="apr-intro-texto">
        A desinformação não é um problema pequeno: notícias falsas influenciam
        eleições, atrapalham campanhas de saúde, alimentam golpes financeiros e
        já provocaram pânico e até violência. Elas se espalham mais rápido que as
        verdadeiras porque são feitas para mexer com a emoção das pessoas.
      </p>
      <p class="apr-intro-texto">
        Saber checar uma notícia antes de acreditar ou compartilhar é uma
        habilidade essencial de cidadania — protege você e quem está à sua volta.
        Nesta aula rápida, você aprende em <strong>10 passos práticos</strong> como
        fazer isso, com uma pergunta a cada passo para fixar o conteúdo.
      </p>
      <ul class="apr-intro-bullets">
        <li>Reconhecer sinais de manipulação</li>
        <li>Avaliar fontes e evidências</li>
        <li>Confirmar antes de compartilhar</li>
      </ul>
      <button type="button" class="apr-resp" id="aprComecar">Começar a aula</button>
      <p class="apr-intro-meta">${APRENDER_AULA.length} passos · cerca de 5 minutos</p>
    </div>`;
}

function montarAprPassoHTML() {
  const total = APRENDER_AULA.length;
  const i = aprenderState.passo;
  const passo = APRENDER_AULA[i];
  const pct = Math.round((i / total) * 100);
  const respondido = aprenderState.respondido;
  const escolha = aprenderState.escolha;
  const ultimo = i === total - 1;
  const acertou = respondido && escolha === passo.correta;

  const opcoes = passo.opcoes
    .map((op, j) => {
      let cls = "quiz-opcao";
      if (respondido) {
        if (j === passo.correta) cls += " correta";
        else if (j === escolha) cls += " errada";
      }
      const checked = escolha === j ? " checked" : "";
      const dis = respondido ? " disabled" : "";
      return `
        <label class="${cls}">
          <input type="radio" name="aprOp" value="${j}"${checked}${dis} />
          <span>${escapeHTML(op)}</span>
        </label>`;
    })
    .join("");

  const feedback = respondido
    ? `<p class="quiz-exp ${acertou ? "ok" : "no"}">
         <strong>${acertou ? "Correto!" : "Quase!"}</strong> ${escapeHTML(passo.exp)}
       </p>`
    : "";

  return `
    <div class="apr-top">
      <h2 class="apr-titulo-mini">Como analisar uma notícia</h2>
      <div class="apr-progresso">
        <span>Passo ${i + 1} de ${total}</span>
        <div class="apr-progresso-bar"><span style="width:${pct}%"></span></div>
      </div>
    </div>
    <article class="apr-step reveal-card">
      <span class="apr-num">Passo ${passo.n}</span>
      <h3 class="apr-step-titulo">${escapeHTML(passo.titulo)}</h3>
      <p class="apr-step-resumo">${escapeHTML(passo.resumo)}</p>
      <form class="apr-step-form" id="aprForm">
        <p class="apr-step-pergunta">${escapeHTML(passo.pergunta)}</p>
        <div class="quiz-opcoes">${opcoes}</div>
        ${feedback}
        <p class="apr-aviso" id="aprAviso" hidden>Selecione uma opção para responder.</p>
        <div class="apr-step-acoes">
          ${
            respondido
              ? `<button type="button" class="apr-resp" id="aprProximo">${ultimo ? "Ver resultado" : "Próximo →"}</button>`
              : `<button type="submit" class="apr-resp">Responder</button>`
          }
        </div>
      </form>
    </article>`;
}

function montarAprFinalHTML() {
  const total = APRENDER_AULA.length;
  const acertos = APRENDER_AULA.reduce(
    (soma, p, i) => soma + (aprenderState.respostas[i] === p.correta ? 1 : 0),
    0,
  );
  const pct = Math.round((acertos / total) * 100);

  let msg;
  if (pct === 100) msg = "Excelente! Você domina a checagem de notícias. 🏆";
  else if (pct >= 70) msg = "Muito bem! Você já sabe identificar desinformação. 👏";
  else if (pct >= 40) msg = "Bom começo — revise os passos e tente de novo. 💪";
  else msg = "Vale revisar a aula e refazer. Você consegue! 📚";

  const revisao = APRENDER_AULA.map((p, i) => {
    const escolha = aprenderState.respostas[i];
    const certo = escolha === p.correta;
    const suaResposta =
      escolha != null && escolha >= 0 ? p.opcoes[escolha] : "Sem resposta";
    return `
      <li class="apr-rev ${certo ? "ok" : "no"}">
        <span class="apr-rev-mark" aria-hidden="true">${certo ? "✓" : "✕"}</span>
        <div class="apr-rev-corpo">
          <p class="apr-rev-q">${i + 1}. ${escapeHTML(p.pergunta)}</p>
          <p class="apr-rev-sua"><span>Sua resposta:</span> ${escapeHTML(suaResposta)}</p>
          ${
            certo
              ? ""
              : `<p class="apr-rev-certa"><span>Correta:</span> ${escapeHTML(p.opcoes[p.correta])}</p>`
          }
        </div>
      </li>`;
  }).join("");

  const alertas = APRENDER_ALERTAS.map((a) => `<li>${escapeHTML(a)}</li>`).join("");

  return `
    <div class="apr-top">
      <h2 class="apr-titulo-mini">Como analisar uma notícia</h2>
      <div class="apr-progresso">
        <span>Aula concluída</span>
        <div class="apr-progresso-bar"><span style="width:100%"></span></div>
      </div>
    </div>
    <div class="apr-final reveal-card">
      <span class="apr-eyebrow">Resultado</span>
      <div class="apr-score"><strong>${acertos}/${total}</strong><span>${pct}% de acerto</span></div>
      <div class="apr-score-bar"><span style="width:${pct}%"></span></div>
      <p class="apr-score-msg">${msg}</p>
      <button type="button" class="apr-resp" id="aprRefazer">Refazer a aula</button>
    </div>

    <h3 class="apr-rev-titulo">Revisão das questões</h3>
    <ul class="apr-revisao">${revisao}</ul>

    <section class="apr-alertas">
      <h3>Sinais de alerta 🚩</h3>
      <p>Quando vários destes aparecem juntos, redobre a atenção:</p>
      <ul>${alertas}</ul>
    </section>`;
}

// ─── Transparência (deputados, senadores, prefeito de Franca-SP) ─────────────
const TRANSP_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];
const transpState = {
  iniciado: false,
  sub: "deputados",
  deputados: null,
  senadores: null,
  presidentes: null,
  franca: null,
  mencoes: null,
};
let transpPaginaAtual = 1;
const TRANSP_POR_PAGINA = 20;

// ── Favoritos (deputados/senadores fixados) — persistem em localStorage ──
const FAVORITOS_KEY = "transpFavoritos";
let transpFavoritos = carregarFavoritos();

function carregarFavoritos() {
  try {
    const v = JSON.parse(localStorage.getItem(FAVORITOS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function salvarFavoritos() {
  try {
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify(transpFavoritos));
  } catch {
    /* localStorage indisponível — ignora */
  }
}
function ehFavorito(casa, id) {
  return transpFavoritos.some((f) => f.casa === casa && String(f.id) === String(id));
}
function toggleFavorito(item) {
  const i = transpFavoritos.findIndex(
    (f) => f.casa === item.casa && String(f.id) === String(item.id),
  );
  if (i >= 0) transpFavoritos.splice(i, 1);
  else
    transpFavoritos.push({
      casa: item.casa,
      id: String(item.id),
      nome: item.nome,
      partido: item.partido || "",
      uf: item.uf || "",
      foto: item.foto || "",
    });
  salvarFavoritos();
  renderFavoritos();
}
function removerFavorito(casa, id) {
  const i = transpFavoritos.findIndex(
    (f) => f.casa === casa && String(f.id) === String(id),
  );
  if (i < 0) return;
  transpFavoritos.splice(i, 1);
  salvarFavoritos();
  renderFavoritos();
  const card = document.querySelector(
    `.transp-card[data-casa="${casa}"][data-id="${CSS.escape(String(id))}"]`,
  );
  if (card) atualizarEstrela(card, false);
}

function fmtBRL(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDataBR(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

function fmtDataHora(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Selo "Atualizado em …" — data em que o servidor buscou o dado da fonte.
function seloAtualizado(iso) {
  const txt = fmtDataHora(iso);
  return txt
    ? `<p class="transp-atualizado">Atualizado em ${escapeHTML(txt)}</p>`
    : "";
}

// Último mês do ano com lançamentos de despesa (1–12) — indica até quando a
// fonte oficial já publicou os gastos daquele parlamentar.
function ultimoMesComDados(porMes) {
  if (!Array.isArray(porMes)) return 0;
  let ultimo = 0;
  porMes.forEach((m) => {
    if ((Number(m.valor) || 0) > 0) ultimo = Math.max(ultimo, Number(m.mes) || 0);
  });
  return ultimo;
}

// Selo de cobertura dos gastos: "dados disponíveis até <mês> de <ano>", baseado
// no dado mais recente que temos daquele parlamentar (varia de um para outro).
function seloGastosAte(data, ano) {
  const m = ultimoMesComDados(data && data.porMes);
  if (!m) return seloAtualizado(data && data.atualizadoEm);
  return `<p class="transp-atualizado">Última atualização: dados disponíveis até ${escapeHTML(MESES_NOMES[m - 1])} de ${escapeHTML(String(ano))}.</p>`;
}

function configurarTransparencia() {
  const view = document.getElementById("transpView");
  if (!view) return;

  // Sub-abas (deputados / senadores / franca)
  const subtabs = document.getElementById("transpSubtabs");
  if (subtabs) {
    subtabs.querySelectorAll(".transp-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        subtabs.querySelectorAll(".transp-chip").forEach((c) =>
          c.classList.remove("ativo"),
        );
        chip.classList.add("ativo");
        transpTrocarSub(chip.dataset.transp);
      });
    });
  }

  // Filtro UF
  const ufSel = document.getElementById("transpUf");
  if (ufSel) {
    TRANSP_UFS.forEach((uf) => {
      const opt = document.createElement("option");
      opt.value = uf;
      opt.textContent = uf;
      ufSel.appendChild(opt);
    });
    ufSel.addEventListener("change", () => {
      transpPaginaAtual = 1;
      renderTranspLista();
    });
  }

  // Filtro de partido (preenchido conforme a casa carregada)
  const partidoSel = document.getElementById("transpPartido");
  if (partidoSel) {
    partidoSel.addEventListener("change", () => {
      transpPaginaAtual = 1;
      renderTranspLista();
    });
  }

  // Filtro ano (para o detalhe de gastos)
  const anoSel = document.getElementById("transpAno");
  if (anoSel) {
    const anoAtual = new Date().getFullYear();
    for (let a = anoAtual; a >= 2019; a--) {
      const opt = document.createElement("option");
      opt.value = String(a);
      opt.textContent = String(a);
      anoSel.appendChild(opt);
    }
    // Na aba de Franca o ano recarrega os gastos da Prefeitura na hora.
    anoSel.addEventListener("change", () => {
      if (transpState.sub === "franca") carregarFranca();
    });
  }

  // Busca por nome
  const busca = document.getElementById("transpBusca");
  if (busca)
    busca.addEventListener("input", () => {
      transpPaginaAtual = 1;
      if (transpState.sub === "presidentes") renderPresidentes();
      else renderTranspLista();
    });

  // Modal de detalhe
  const overlay = document.getElementById("transpModalOverlay");
  const fechar = document.getElementById("transpModalFechar");
  if (overlay)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) fecharTranspModal();
    });
  if (fechar) fechar.addEventListener("click", fecharTranspModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharTranspModal();
  });
}

function iniciarTransparencia() {
  if (transpState.iniciado) return;
  transpState.iniciado = true;
  carregarMencoes();
  transpTrocarSub("deputados");
}

// ─── Menções em notícias analisadas ──────────────────────────────────────────
// Casa as pessoas da Transparência (deputados, senadores, presidentes) com as
// entidades mencionadas nas notícias já analisadas, para exibir a notificação.
const CONECTORES_NOME = new Set(["da", "de", "do", "das", "dos", "e", "del", "la"]);
const SOBRENOMES_COMUNS = new Set([
  "silva", "santos", "oliveira", "souza", "sousa", "lima", "pereira", "costa",
  "ferreira", "alves", "rodrigues", "gomes", "ribeiro", "carvalho", "almeida",
  "araujo", "fernandes", "cardoso", "nunes", "martins", "rocha", "barbosa",
  "mendes", "junior", "filho", "neto",
]);

function normalizarNomeBusca(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensNome(s) {
  return normalizarNomeBusca(s)
    .split(" ")
    .filter((t) => t.length > 2 && !CONECTORES_NOME.has(t));
}

// Decide se o nome de uma pessoa e o de uma entidade se referem à mesma pessoa.
function nomesCombinam(pTokens, eTokens) {
  if (!pTokens.length || !eTokens.length) return false;
  const setE = new Set(eTokens);
  const comuns = pTokens.filter((t) => setE.has(t));
  if (comuns.length >= 2) return true; // dois ou mais tokens em comum (ex.: nome + sobrenome)
  const distintos = comuns.filter(
    (t) => t.length >= 4 && !SOBRENOMES_COMUNS.has(t),
  );
  // Um único token em comum (ex.: só o primeiro nome "Flávio") NÃO basta: casaria
  // homônimos diferentes (ex.: "Dr. Flávio" com "Flávio Bolsonaro"). Só vale quando
  // AMBOS os nomes são exatamente aquele único token distintivo (mononômios iguais).
  if (
    distintos.length >= 1 &&
    pTokens.length === 1 &&
    eTokens.length === 1
  ) {
    return true;
  }
  return false;
}

async function carregarMencoes() {
  try {
    const res = await fetch("/api/transparencia/mencoes");
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Falha");
    transpState.mencoes = (data.mencoes || []).map((m) => ({
      ...m,
      tokens: tokensNome(m.nome),
    }));
    // Re-renderiza a aba atual para exibir as notificações já carregadas.
    if (transpState.sub === "presidentes") renderPresidentes();
    else if (transpState.sub === "deputados" || transpState.sub === "senadores")
      renderTranspLista();
  } catch (e) {
    transpState.mencoes = []; // segue sem badges
  }
}

// Agrega as notícias em que a pessoa foi mencionada (sem duplicar por URL).
function mencoesDaPessoa(nome) {
  const idx = transpState.mencoes;
  if (!idx || !idx.length) return null;
  const pTokens = tokensNome(nome);
  if (!pTokens.length) return null;

  const noticias = [];
  const vistas = new Set();
  idx.forEach((m) => {
    if (!nomesCombinam(pTokens, m.tokens)) return;
    (m.noticias || []).forEach((n) => {
      if (!n.url || vistas.has(n.url)) return;
      vistas.add(n.url);
      noticias.push(n);
    });
  });
  if (!noticias.length) return null;
  noticias.sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  return { total: noticias.length, noticias };
}

// Botão/etiqueta de notificação exibido no card da pessoa.
function badgeMencao(nome) {
  const m = mencoesDaPessoa(nome);
  if (!m) return "";
  return `<button class="transp-mencao" data-mencao="${escapeHTML(nome)}" type="button" title="Citado(a) em ${m.total} notícia(s) analisada(s)">🔔 ${m.total}</button>`;
}

function abrirMencoesModal(nome) {
  const m = mencoesDaPessoa(nome);
  if (!m) return;
  const itens = m.noticias
    .map(
      (n) => `
      <a class="mencao-item" href="${escapeHTML(n.url)}" target="_blank" rel="noopener noreferrer">
        <span class="mencao-item-titulo">${escapeHTML(n.titulo || n.url)}</span>
        <span class="mencao-item-meta">
          ${n.veredito ? `<span class="mencao-vered">${escapeHTML(n.veredito)}</span>` : ""}
          ${n.data ? `<span class="mencao-data">${escapeHTML(fmtDataBR(n.data))}</span>` : ""}
        </span>
      </a>`,
    )
    .join("");
  abrirTranspModal(`
    <div class="transp-modal-head">
      <h3>🔔 ${escapeHTML(nome)}</h3>
      <span class="transp-modal-sub">Citado(a) em ${m.total} notícia(s) analisada(s)</span>
    </div>
    <div class="mencao-lista">${itens}</div>
    <p class="transp-fonte">Menções detectadas automaticamente nas notícias já analisadas pelo VerusAI. Pode haver homônimos.</p>
  `);
}

function transpTrocarSub(sub) {
  transpState.sub = sub;
  transpPaginaAtual = 1;
  // Franca e Presidentes não usam lista paginada; limpa os controles de página.
  if (sub === "franca" || sub === "presidentes") renderTranspPaginacao(0);
  const filtros = document.getElementById("transpFiltros");
  const busca = document.getElementById("transpBusca");
  const ufSel = document.getElementById("transpUf");
  const partidoSel = document.getElementById("transpPartido");
  const anoSel = document.getElementById("transpAno");
  const ehParlamentar = sub === "deputados" || sub === "senadores";
  const ehPresidentes = sub === "presidentes";

  // Busca: parlamentares e presidentes (filtra por nome). UF/partido só
  // parlamentares. O seletor de ano não se aplica aos presidentes.
  if (filtros) filtros.style.display = "";
  if (busca) {
    busca.style.display = ehParlamentar || ehPresidentes ? "" : "none";
    busca.placeholder = ehPresidentes ? "Buscar presidente…" : "Buscar por nome…";
    busca.value = "";
  }
  if (ufSel) {
    ufSel.style.display = ehParlamentar ? "" : "none";
    ufSel.value = "";
  }
  if (partidoSel) {
    partidoSel.style.display = ehParlamentar ? "" : "none";
    partidoSel.value = "";
  }
  if (anoSel) anoSel.style.display = ehPresidentes ? "none" : "";

  renderFavoritos();

  if (sub === "deputados") carregarDeputados();
  else if (sub === "senadores") carregarSenadores();
  else if (sub === "presidentes") carregarPresidentes();
  else carregarFranca();
}

function transpStatus(texto, erro = false) {
  const el = document.getElementById("transpStatus");
  if (!el) return;
  el.textContent = texto || "";
  el.classList.toggle("erro", Boolean(erro));
}

async function carregarDeputados() {
  const lista = document.getElementById("transpLista");
  if (transpState.deputados) return renderTranspLista();
  if (lista) lista.innerHTML = '<div class="loading">Carregando deputados…</div>';
  transpStatus("");
  try {
    const res = await fetch("/api/transparencia/deputados");
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Falha ao carregar");
    transpState.deputados = data.deputados || [];
    transpState.depAtt = data.atualizadoEm;
    renderTranspLista();
  } catch (e) {
    if (lista)
      lista.innerHTML =
        '<div class="transp-erro">Não foi possível carregar os deputados. Verifique se o servidor está rodando.</div>';
    transpStatus("Erro ao carregar deputados.", true);
  }
}

async function carregarSenadores() {
  const lista = document.getElementById("transpLista");
  if (transpState.senadores) return renderTranspLista();
  if (lista) lista.innerHTML = '<div class="loading">Carregando senadores…</div>';
  transpStatus("");
  try {
    const res = await fetch("/api/transparencia/senadores");
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Falha ao carregar");
    transpState.senadores = data.senadores || [];
    transpState.senAtt = data.atualizadoEm;
    renderTranspLista();
  } catch (e) {
    if (lista)
      lista.innerHTML =
        '<div class="transp-erro">Não foi possível carregar os senadores.</div>';
    transpStatus("Erro ao carregar senadores.", true);
  }
}

// Preenche o select de partidos com os da casa atual (só quando a casa muda).
function popularPartidos() {
  const sel = document.getElementById("transpPartido");
  if (!sel) return;
  const sub = transpState.sub;
  if (sub !== "deputados" && sub !== "senadores") return;
  if (sel.dataset.sub === sub) return; // já populado para esta casa
  const dados =
    sub === "deputados" ? transpState.deputados : transpState.senadores;
  if (!dados) return;
  const partidos = [...new Set(dados.map((p) => p.partido).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  sel.innerHTML =
    '<option value="">Todos os partidos</option>' +
    partidos
      .map((p) => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`)
      .join("");
  sel.dataset.sub = sub;
  sel.value = "";
}

function renderTranspLista() {
  const sub = transpState.sub;
  if (sub === "franca" || sub === "presidentes") return;
  const lista = document.getElementById("transpLista");
  if (!lista) return;

  const dados =
    sub === "deputados" ? transpState.deputados : transpState.senadores;
  if (!dados) return;

  popularPartidos();

  const termo = (document.getElementById("transpBusca")?.value || "")
    .trim()
    .toLowerCase();
  const uf = document.getElementById("transpUf")?.value || "";
  const partido = document.getElementById("transpPartido")?.value || "";

  const filtrados = dados.filter((p) => {
    if (uf && p.uf !== uf) return false;
    if (partido && p.partido !== partido) return false;
    if (termo && !p.nome.toLowerCase().includes(termo)) return false;
    return true;
  });

  // Status sempre reflete o filtro atual (e nunca some ao trocar de aba/filtro).
  // A data de atualização agora vive em cada parlamentar (na aba de gastos),
  // pois cada um tem a fonte publicada até um mês diferente.
  const label = sub === "deputados" ? "deputados" : "senadores";
  const filtrou = filtrados.length !== dados.length;
  transpStatus(
    (filtrou
      ? `${filtrados.length} de ${dados.length} ${label}`
      : `${dados.length} ${label} em exercício`) +
      ".",
  );

  if (!filtrados.length) {
    lista.innerHTML =
      '<div class="transp-vazio">Nenhum resultado para os filtros atuais.</div>';
    renderTranspPaginacao(0);
    return;
  }

  // Pagina de 20 em 20 para não renderizar a lista inteira de uma vez.
  const totalPaginas = Math.ceil(filtrados.length / TRANSP_POR_PAGINA);
  if (transpPaginaAtual > totalPaginas) transpPaginaAtual = totalPaginas;
  if (transpPaginaAtual < 1) transpPaginaAtual = 1;
  const inicio = (transpPaginaAtual - 1) * TRANSP_POR_PAGINA;
  const pagina = filtrados.slice(inicio, inicio + TRANSP_POR_PAGINA);

  const casa = sub === "deputados" ? "deputado" : "senador";
  lista.innerHTML =
    '<div class="transp-cards">' +
    pagina
      .map((p) =>
        cardParlamentarHTML(casa, {
          id: sub === "deputados" ? p.id : p.codigo,
          nome: p.nome,
          partido: p.partido,
          uf: p.uf,
          foto: p.foto,
        }),
      )
      .join("") +
    "</div>";

  lista.querySelectorAll(".transp-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-fav]")) return; // clique na estrela
      if (e.target.closest("[data-mencao]")) return; // clique na notificação
      abrirPerfilParlamentar(card.dataset.casa, card.dataset.id, card.dataset.nome);
    });
    const mencao = card.querySelector("[data-mencao]");
    if (mencao)
      mencao.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirMencoesModal(mencao.dataset.mencao);
      });
    const fav = card.querySelector("[data-fav]");
    if (fav)
      fav.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorito(card.dataset);
        atualizarEstrela(card, ehFavorito(card.dataset.casa, card.dataset.id));
      });
  });

  renderTranspPaginacao(totalPaginas);
}

// Card de parlamentar com botão de favoritar (círculo + estrela) no topo direito.
function cardParlamentarHTML(casa, p) {
  const fav = ehFavorito(casa, p.id);
  return `
    <div class="transp-card" data-casa="${casa}" data-id="${escapeHTML(String(p.id))}" data-nome="${escapeHTML(p.nome)}" data-partido="${escapeHTML(p.partido || "")}" data-uf="${escapeHTML(p.uf || "")}" data-foto="${escapeHTML(p.foto || "")}">
      <button class="transp-fav-btn${fav ? " ativo" : ""}" data-fav type="button" title="${fav ? "Remover dos favoritos" : "Favoritar"}" aria-label="Favoritar">${fav ? "★" : "☆"}</button>
      <img class="transp-card-foto" src="${escapeHTML(p.foto || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
      <div class="transp-card-info">
        <strong>${escapeHTML(p.nome)}</strong>
        <span class="transp-card-meta">${escapeHTML(p.partido || "—")} · ${escapeHTML(p.uf || "—")}</span>
      </div>
      ${badgeMencao(p.nome)}
      <span class="transp-card-acao">Ver perfil →</span>
    </div>`;
}

function atualizarEstrela(card, ativo) {
  const btn = card.querySelector("[data-fav]");
  if (!btn) return;
  btn.classList.toggle("ativo", ativo);
  btn.textContent = ativo ? "★" : "☆";
  btn.title = ativo ? "Remover dos favoritos" : "Favoritar";
}

// Faixa de favoritos abaixo da barra de busca. Cada casa mostra só os seus:
// os favoritos de deputados na aba de deputados e os de senadores na de senadores.
function renderFavoritos() {
  const cont = document.getElementById("transpFavoritos");
  if (!cont) return;
  const ehParlamentar =
    transpState.sub === "deputados" || transpState.sub === "senadores";
  const casaAtual = transpState.sub === "deputados" ? "deputado" : "senador";
  const favs = ehParlamentar
    ? transpFavoritos.filter((f) => f.casa === casaAtual)
    : [];
  const mostrar = favs.length > 0;
  cont.hidden = !mostrar;
  if (!mostrar) {
    cont.innerHTML = "";
    return;
  }

  cont.innerHTML = `
    <div class="transp-fav-titulo">★ Favoritos (${favs.length})</div>
    <div class="transp-fav-lista">
      ${favs
        .map(
          (f) => `
        <div class="transp-fav-chip" data-casa="${escapeHTML(f.casa)}" data-id="${escapeHTML(String(f.id))}" data-nome="${escapeHTML(f.nome)}" title="Ver perfil de ${escapeHTML(f.nome)}">
          <img src="${escapeHTML(f.foto || "")}" alt="" onerror="this.style.display='none'" />
          <div class="transp-fav-chip-info">
            <strong>${escapeHTML(f.nome)}</strong>
            <span>${escapeHTML(f.partido || "—")} · ${escapeHTML(f.uf || "—")}</span>
          </div>
          <button class="transp-fav-remover" data-remover type="button" title="Remover dos favoritos" aria-label="Remover">×</button>
        </div>`,
        )
        .join("")}
    </div>`;

  cont.querySelectorAll(".transp-fav-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (e.target.closest("[data-remover]")) return;
      abrirPerfilParlamentar(chip.dataset.casa, chip.dataset.id, chip.dataset.nome);
    });
    const rem = chip.querySelector("[data-remover]");
    if (rem)
      rem.addEventListener("click", (e) => {
        e.stopPropagation();
        removerFavorito(chip.dataset.casa, chip.dataset.id);
      });
  });
}

function renderTranspPaginacao(totalPaginas) {
  const pag = document.getElementById("transpPaginacao");
  if (!pag) return;
  pag.innerHTML = "";

  if (totalPaginas <= 1) return;

  const btnAnterior = document.createElement("button");
  btnAnterior.className = "pag-btn";
  btnAnterior.textContent = "←";
  btnAnterior.disabled = transpPaginaAtual === 1;
  btnAnterior.addEventListener("click", () => irTranspPagina(transpPaginaAtual - 1));
  pag.appendChild(btnAnterior);

  for (let p = 1; p <= totalPaginas; p++) {
    if (
      p === 1 ||
      p === totalPaginas ||
      (p >= transpPaginaAtual - 1 && p <= transpPaginaAtual + 1)
    ) {
      const btn = document.createElement("button");
      btn.className = "pag-btn" + (p === transpPaginaAtual ? " ativo" : "");
      btn.textContent = p;
      btn.addEventListener("click", () => irTranspPagina(p));
      pag.appendChild(btn);
    } else if (p === transpPaginaAtual - 2 || p === transpPaginaAtual + 2) {
      const ell = document.createElement("span");
      ell.textContent = "…";
      ell.style.cssText =
        "font-family:var(--font-mono);padding:0 0.3rem;opacity:.5";
      pag.appendChild(ell);
    }
  }

  const btnProx = document.createElement("button");
  btnProx.className = "pag-btn";
  btnProx.textContent = "→";
  btnProx.disabled = transpPaginaAtual === totalPaginas;
  btnProx.addEventListener("click", () => irTranspPagina(transpPaginaAtual + 1));
  pag.appendChild(btnProx);
}

function irTranspPagina(p) {
  transpPaginaAtual = p;
  renderTranspLista();
  const secao = document.getElementById("transpView");
  if (secao) {
    window.scrollTo({ top: secao.offsetTop - 80, behavior: "smooth" });
  }
}

// Estado do modal de perfil aberto (casa, id e cache por aba).
const perfilState = { casa: null, id: null, nome: null, cache: {} };

function abrirDetalheDeputado(id, nome) {
  abrirPerfilParlamentar("deputado", id, nome);
}
function abrirDetalheSenador(codigo, nome) {
  abrirPerfilParlamentar("senador", codigo, nome);
}

function abrirPerfilParlamentar(casa, id, nome) {
  perfilState.casa = casa;
  perfilState.id = String(id);
  perfilState.nome = nome;
  perfilState.cache = {};

  const abas =
    casa === "deputado"
      ? [["perfil", "Perfil"], ["producao", "Produção"], ["agenda", "Agenda"], ["gastos", "Gastos"]]
      : [["perfil", "Perfil"], ["producao", "Produção"], ["votacoes", "Votações"], ["gastos", "Gastos"]];
  const cargo = casa === "deputado" ? "Deputado(a) federal" : "Senador(a)";

  abrirTranspModal(`
    <div class="transp-modal-head">
      <h3>${escapeHTML(nome)}</h3>
      <span class="transp-modal-sub">${cargo}</span>
    </div>
    <div class="perfil-tabs" id="perfilTabs">
      ${abas
        .map(
          ([k, l], i) =>
            `<button class="perfil-tab${i === 0 ? " ativo" : ""}" data-aba="${k}" type="button">${l}</button>`,
        )
        .join("")}
    </div>
    <div class="perfil-conteudo" id="perfilConteudo"><div class="loading">Carregando…</div></div>
  `);

  document.querySelectorAll("#perfilTabs .perfil-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#perfilTabs .perfil-tab")
        .forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      mostrarAbaPerfil(btn.dataset.aba);
    });
  });
  mostrarAbaPerfil("perfil");
}

async function mostrarAbaPerfil(aba) {
  const alvo = document.getElementById("perfilConteudo");
  if (!alvo) return;
  alvo.innerHTML = '<div class="loading">Carregando…</div>';
  try {
    if (aba === "gastos") return await renderAbaGastos(alvo);
    const data = await carregarAbaPerfil(aba);
    if (aba === "perfil") renderAbaPerfilDados(alvo, data);
    else if (aba === "producao") renderAbaProducao(alvo, data);
    else if (aba === "agenda") renderAbaAgenda(alvo, data);
    else if (aba === "votacoes") renderAbaVotacoes(alvo, data);
  } catch (e) {
    alvo.innerHTML =
      '<div class="transp-erro">Não foi possível carregar esta seção.</div>';
  }
}

async function carregarAbaPerfil(aba) {
  if (perfilState.cache[aba]) return perfilState.cache[aba];
  const base = perfilState.casa === "deputado" ? "deputados" : "senadores";
  const res = await fetch(
    `/api/transparencia/${base}/${encodeURIComponent(perfilState.id)}/${aba}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || "Falha");
  perfilState.cache[aba] = data;
  return data;
}

// ── Aba: Perfil (dados pessoais, contato, comissões, carreira) ──
function renderAbaPerfilDados(alvo, d) {
  const linha = (rotulo, valor) =>
    valor
      ? `<div class="perfil-campo"><span>${escapeHTML(rotulo)}</span><strong>${escapeHTML(String(valor))}</strong></div>`
      : "";

  const dados = [
    linha("Partido / UF", [d.partido, d.uf].filter(Boolean).join(" · ")),
    linha("Situação", d.situacao),
    linha("Condição", d.condicao),
    linha("Nome civil", d.nomeCivil),
    linha("Nascimento", d.nascimento ? fmtDataBR(d.nascimento) : ""),
    linha("Naturalidade", d.naturalidade),
    linha("Escolaridade", d.escolaridade),
    linha("Sexo", d.sexo),
    linha("CPF", d.cpf),
  ]
    .filter(Boolean)
    .join("");

  const redes = (d.redes || [])
    .map(
      (u) =>
        `<a href="${escapeHTML(u)}" target="_blank" rel="noopener noreferrer">${escapeHTML(
          u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
        )}</a>`,
    )
    .join("");
  const tels = (d.telefones || []).join(" · ") || d.telefone || "";
  const gab = d.gabinete || {};
  const gabTxt = [gab.predio && `Prédio ${gab.predio}`, gab.sala && `sala ${gab.sala}`, gab.andar && `${gab.andar}º andar`]
    .filter(Boolean)
    .join(", ");

  const contato = [
    linha("E-mail", d.email),
    linha("Telefone", tels),
    linha("Gabinete", gabTxt),
    linha("Endereço", d.endereco),
    d.site
      ? `<div class="perfil-campo"><span>Site / página</span><strong><a href="${escapeHTML(d.site)}" target="_blank" rel="noopener noreferrer">abrir →</a></strong></div>`
      : "",
    redes ? `<div class="perfil-campo"><span>Redes</span><strong class="perfil-redes">${redes}</strong></div>` : "",
  ]
    .filter(Boolean)
    .join("");

  const comissoes = (d.comissoes || []).length
    ? `<ul class="perfil-lista">${d.comissoes
        .map(
          (c) =>
            `<li><strong>${escapeHTML(c.sigla || c.nome)}</strong>${
              c.cargo && c.cargo !== "Titular" ? ` <span class="perfil-tag">${escapeHTML(c.cargo)}</span>` : ""
            }<span class="perfil-li-sub">${escapeHTML(c.nome || "")}</span></li>`,
        )
        .join("")}</ul>`
    : '<p class="transp-vazio">Sem comissões ativas.</p>';

  const carreira =
    perfilState.casa === "senador"
      ? [
          (d.mandatos || [])
            .map(
              (m) =>
                `<div class="perfil-campo"><span>Mandato (${escapeHTML(m.participacao || "")})</span><strong>${escapeHTML(m.periodo || "")} · ${escapeHTML(m.uf || "")}</strong></div>`,
            )
            .join(""),
          (d.cargos || [])
            .map(
              (c) =>
                `<div class="perfil-campo"><span>Cargo</span><strong>${escapeHTML(c.cargo)}${c.orgao ? ` · ${escapeHTML(c.orgao)}` : ""}</strong></div>`,
            )
            .join(""),
        ].join("")
      : [
          (d.profissoes || []).length
            ? `<div class="perfil-campo"><span>Profissão</span><strong>${escapeHTML(d.profissoes.join(", "))}</strong></div>`
            : "",
          (d.ocupacoes || [])
            .map(
              (o) =>
                `<div class="perfil-campo"><span>Ocupação</span><strong>${escapeHTML(o.titulo)}${o.entidade ? ` · ${escapeHTML(o.entidade)}` : ""}${o.inicio ? ` (${escapeHTML(String(o.inicio))}${o.fim ? `–${escapeHTML(String(o.fim))}` : ""})` : ""}</strong></div>`,
            )
            .join(""),
        ].join("");

  const frentes =
    perfilState.casa === "deputado" && (d.frentes || []).length
      ? `<h4 class="transp-sec-titulo">Frentes parlamentares (${d.frentes.length})</h4>
         <details class="perfil-frentes"><summary>Ver frentes</summary><ul class="perfil-lista perfil-lista-compacta">${d.frentes
           .map((f) => `<li>${escapeHTML(f)}</li>`)
           .join("")}</ul></details>`
      : "";

  const auxilio =
    d.auxilioMoradia && perfilState.casa === "senador"
      ? `<div class="perfil-campo"><span>Auxílio-moradia</span><strong>${d.auxilioMoradia.auxilioMoradia ? "Recebe" : "Não recebe"}${d.auxilioMoradia.imovelFuncional ? " · usa imóvel funcional" : ""}</strong></div>`
      : "";

  alvo.innerHTML = `
    <div class="perfil-topo">
      ${d.foto ? `<img class="perfil-foto" src="${escapeHTML(d.foto)}" alt="" onerror="this.style.display='none'" />` : ""}
      <div class="perfil-subsidio">
        <span>Subsídio mensal (referência)</span>
        <strong>${fmtBRL(d.subsidio)}</strong>
        <small>valor fixo e igual para todos os parlamentares</small>
      </div>
    </div>

    <h4 class="transp-sec-titulo">Dados pessoais</h4>
    <div class="perfil-grid">${dados}</div>

    <h4 class="transp-sec-titulo">Contato</h4>
    <div class="perfil-grid">${contato || '<p class="transp-vazio">Sem dados de contato.</p>'}</div>

    ${carreira ? `<h4 class="transp-sec-titulo">Mandato e carreira</h4><div class="perfil-grid">${carreira}${auxilio}</div>` : auxilio ? `<div class="perfil-grid">${auxilio}</div>` : ""}

    <h4 class="transp-sec-titulo">Comissões${(d.comissoes || []).length ? ` (${d.comissoes.length})` : ""}</h4>
    ${comissoes}
    ${frentes}
    ${seloAtualizado(d.atualizadoEm)}
  `;
}

// ── Aba: Produção (proposições + discursos) ──
function renderAbaProducao(alvo, d) {
  const props = d.proposicoes || [];
  const disc = d.discursos || [];

  const propHTML = props.length
    ? `<ul class="perfil-prod">${props
        .map(
          (p) =>
            `<li><strong>${escapeHTML(p.sigla)}</strong>${p.principal === false ? ' <span class="perfil-tag">coautoria</span>' : ""}<span class="perfil-li-sub">${escapeHTML(p.ementa || "")}</span></li>`,
        )
        .join("")}</ul>`
    : '<p class="transp-vazio">Nenhuma proposição encontrada.</p>';

  const discHTML = disc.length
    ? `<ul class="perfil-prod">${disc
        .map(
          (s) =>
            `<li><strong>${escapeHTML(fmtDataBR(s.data))}${s.tipo ? ` · ${escapeHTML(s.tipo)}` : ""}</strong><span class="perfil-li-sub">${escapeHTML(s.sumario || "—")}</span>${
              s.video || s.texto
                ? `<span class="perfil-li-links">${s.texto ? `<a href="${escapeHTML(s.texto)}" target="_blank" rel="noopener noreferrer">texto</a>` : ""}${s.video ? `<a href="${escapeHTML(s.video)}" target="_blank" rel="noopener noreferrer">vídeo</a>` : ""}</span>`
                : ""
            }</li>`,
        )
        .join("")}</ul>`
    : '<p class="transp-vazio">Nenhum discurso recente.</p>';

  alvo.innerHTML = `
    <h4 class="transp-sec-titulo">Proposições de autoria (${props.length})</h4>
    ${propHTML}
    <h4 class="transp-sec-titulo">Discursos recentes (${disc.length})</h4>
    ${discHTML}
    ${seloAtualizado(d.atualizadoEm)}
  `;
}

// ── Aba: Agenda (eventos da Câmara) ──
function renderAbaAgenda(alvo, d) {
  const ev = d.eventos || [];
  const corpo = ev.length
    ? `<h4 class="transp-sec-titulo">Agenda recente (${ev.length})</h4><ul class="perfil-prod">${ev
        .map(
          (e) =>
            `<li><strong>${escapeHTML(fmtDataBR(e.data))}${e.tipo ? ` · ${escapeHTML(e.tipo)}` : ""}</strong>${
              e.situacao ? ` <span class="perfil-tag">${escapeHTML(e.situacao)}</span>` : ""
            }<span class="perfil-li-sub">${escapeHTML(e.descricao || "")}</span>${e.local ? `<span class="perfil-li-links">${escapeHTML(e.local)}</span>` : ""}</li>`,
        )
        .join("")}</ul>`
    : '<p class="transp-vazio">Sem eventos na agenda.</p>';
  alvo.innerHTML = corpo + seloAtualizado(d.atualizadoEm);
}

// ── Aba: Votações nominais (Senado) ──
function renderAbaVotacoes(alvo, d) {
  const v = d.votacoes || [];
  const votoCor = (voto) => {
    const t = (voto || "").toLowerCase();
    if (t.includes("sim")) return "sim";
    if (t.includes("não") || t.includes("nao")) return "nao";
    return "outro";
  };
  const corpo = v.length
    ? `<h4 class="transp-sec-titulo">Votações nominais recentes (${v.length})</h4><ul class="perfil-prod">${v
        .map(
          (x) =>
            `<li><strong>${escapeHTML(x.materia || "—")}</strong> <span class="perfil-voto perfil-voto-${votoCor(x.voto)}">${escapeHTML(x.voto || "—")}</span><span class="perfil-li-sub">${escapeHTML(fmtDataBR(x.data))} · ${escapeHTML(x.ementa || "")}</span></li>`,
        )
        .join("")}</ul>`
    : '<p class="transp-vazio">Sem votações registradas.</p>';
  alvo.innerHTML = corpo + seloAtualizado(d.atualizadoEm);
}

// ── Aba: Gastos (cota parlamentar) ──
async function renderAbaGastos(alvo) {
  const ano =
    document.getElementById("transpAno")?.value || String(new Date().getFullYear());
  alvo.innerHTML = '<div class="loading">Carregando gastos…</div>';
  const base = perfilState.casa === "deputado" ? "deputados" : "senadores";
  const res = await fetch(
    `/api/transparencia/${base}/${encodeURIComponent(perfilState.id)}/despesas?ano=${encodeURIComponent(ano)}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || "Falha");
  const origem =
    perfilState.casa === "deputado"
      ? { fonte: "https://dadosabertos.camara.leg.br", fonteLabel: "Dados Abertos da Câmara dos Deputados", cota: "cota parlamentar (CEAP)" }
      : {
          fonte: "https://www12.senado.leg.br/transparencia/dados-abertos-transparencia/dados-abertos-ceaps",
          fonteLabel: "Dados Abertos do Senado Federal",
          cota: "cota para o exercício da atividade parlamentar (CEAPS)",
        };
  alvo.innerHTML = montarDespesasHTML(ano, data, origem);
  ativarInteracoesGastos(alvo, data, ano, base);
}

// Liga o filtro de mês, o gráfico por ano (lazy) e o clique nas barras de ano.
function ativarInteracoesGastos(alvo, data, ano, base) {
  // Filtro de mês: destaca o mês no gráfico e mostra o valor.
  const mesSel = alvo.querySelector("#gastoMesFiltro");
  const mesInfo = alvo.querySelector("#gastoMesInfo");
  const mesInfoPadrao = mesInfo ? mesInfo.innerHTML : "";
  if (mesSel) {
    mesSel.addEventListener("change", () => {
      const m = mesSel.value;
      alvo
        .querySelectorAll("#gastoMeses .gasto-col")
        .forEach((c) => c.classList.toggle("ativo", c.dataset.mes === m && m !== ""));
      if (!m) {
        if (mesInfo) mesInfo.innerHTML = mesInfoPadrao;
        return;
      }
      const reg = (data.porMes || []).find((x) => String(x.mes) === m);
      if (mesInfo)
        mesInfo.innerHTML = `${escapeHTML(MESES_NOMES[Number(m) - 1])}: <strong>${fmtBRL(reg ? reg.valor : 0)}</strong>`;
    });
  }

  // A pizza de categorias acompanha o filtro de mês.
  if (mesSel) {
    mesSel.addEventListener("change", () => {
      const box = alvo.querySelector("#gastoPizza");
      if (box) box.innerHTML = pizzaCategorias(data, ano, mesSel.value);
    });
  }

  // Gráfico "total por ano" — carregado sob demanda e cacheado no servidor.
  const anosBox = alvo.querySelector("#gastosAnos");
  if (anosBox) {
    fetch(`/api/transparencia/${base}/${encodeURIComponent(perfilState.id)}/gastos-anos`)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.anos || !d.anos.length) {
          anosBox.innerHTML = '<p class="transp-vazio">Sem histórico por ano.</p>';
          return;
        }
        anosBox.innerHTML = graficoAnos(d.anos, ano);
        anosBox.querySelectorAll("[data-ano-bar]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const sel = document.getElementById("transpAno");
            if (sel) sel.value = btn.dataset.anoBar;
            mostrarAbaPerfil("gastos");
          });
        });
      })
      .catch(() => {
        anosBox.innerHTML = '<p class="transp-vazio">Não foi possível carregar o histórico por ano.</p>';
      });
  }
}

const MESES_CURTOS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── Helpers de gráfico (pizza/donut + barras por ano) ──
const GRAFICO_CORES = [
  "#d3392d", "#02519b", "#e0613c", "#1f7a3d", "#b07d12",
  "#6b3fa0", "#1ca3a3", "#c2477e", "#8a8d20", "#777777",
];

function donutSVG(itens, total) {
  const t = total || itens.reduce((s, x) => s + (x.valor || 0), 0) || 1;
  const sz = 150, esp = 30, r = (sz - esp) / 2, cx = sz / 2, cy = sz / 2;
  const circ = 2 * Math.PI * r;
  let off = 0;
  const segs = itens
    .map((x) => {
      const len = ((x.valor || 0) / t) * circ;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${x.cor}" stroke-width="${esp}" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${escapeHTML(x.label)}: ${fmtBRL(x.valor)}</title></circle>`;
      off += len;
      return seg;
    })
    .join("");
  return `<svg class="pizza-svg" viewBox="0 0 ${sz} ${sz}" role="img">${segs}</svg>`;
}

// itens: [{label, valor}]. Agrupa o excedente em "Outros".
function graficoPizza(itens, { titulo = "", max = 6 } = {}) {
  let arr = (itens || [])
    .map((x) => ({ label: String(x.label || ""), valor: Number(x.valor) || 0 }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  if (!arr.length) return "";
  if (arr.length > max) {
    const cabeca = arr.slice(0, max - 1);
    const resto = arr.slice(max - 1).reduce((s, x) => s + x.valor, 0);
    arr = [...cabeca, { label: "Outros", valor: resto }];
  }
  arr = arr.map((x, i) => ({ ...x, cor: GRAFICO_CORES[i % GRAFICO_CORES.length] }));
  const total = arr.reduce((s, x) => s + x.valor, 0) || 1;
  const legenda = arr
    .map(
      (x) =>
        `<li><span class="pizza-cor" style="background:${x.cor}"></span><span class="pizza-leg-nome">${escapeHTML(x.label)}</span><span class="pizza-leg-val">${fmtBRL(x.valor)} · ${((x.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></li>`,
    )
    .join("");
  return `${titulo ? `<h4 class="transp-sec-titulo">${escapeHTML(titulo)}</h4>` : ""}
    <div class="pizza"><div class="pizza-grafico">${donutSVG(arr, total)}</div><ul class="pizza-legenda">${legenda}</ul></div>`;
}

// itens: [{ano, total}]. Barras por ano, clicáveis (data-ano-bar) para filtrar.
function graficoAnos(itens, anoAtivo) {
  const arr = [...(itens || [])]
    .map((x) => ({ ano: x.ano, valor: Number(x.valor != null ? x.valor : x.total) || 0 }))
    .sort((a, b) => a.ano - b.ano);
  if (!arr.length) return "";
  const max = arr.reduce((m, x) => Math.max(m, x.valor), 0) || 1;
  return `<div class="gasto-grafico gasto-grafico-anos">${arr
    .map(
      (x) => `<div class="gasto-col gasto-col-click${String(x.ano) === String(anoAtivo) ? " ativo" : ""}" data-ano-bar="${x.ano}" role="button" tabindex="0" title="${x.ano}: ${fmtBRL(x.valor)}">
        <div class="gasto-col-tip"><strong>${x.ano}</strong>${fmtBRL(x.valor)}</div>
        <div class="gasto-col-bar"><div class="gasto-col-fill" style="height:${x.valor > 0 ? Math.max(3, (x.valor / max) * 100) : 0}%"></div></div>
        <span class="gasto-col-mes">${String(x.ano).slice(2)}</span>
      </div>`,
    )
    .join("")}</div>`;
}

// Pizza de categorias do ano inteiro (mes = "") ou de um mês específico.
function pizzaCategorias(data, ano, mes) {
  let cats, titulo;
  if (mes) {
    cats = (data.categoriasMes && data.categoriasMes[mes]) || [];
    titulo = `Distribuição por categoria — ${MESES_NOMES[Number(mes) - 1]}/${ano}`;
  } else {
    cats = data.categorias || [];
    titulo = `Distribuição por categoria — ${ano}`;
  }
  const html = graficoPizza(
    cats.map((c) => ({ label: c.categoria, valor: c.valor })),
    { titulo },
  );
  return (
    html ||
    `<h4 class="transp-sec-titulo">${escapeHTML(titulo)}</h4><p class="transp-vazio">Sem despesas neste mês.</p>`
  );
}

function montarDespesasHTML(ano, data, origem) {
  const categorias = data.categorias || [];
  const recentes = data.recentes || [];
  const porMes = data.porMes || [];
  const maxCat = categorias.reduce((m, c) => Math.max(m, c.valor), 0) || 1;

  const mesesComGasto = porMes.filter((m) => m.valor > 0);
  const maxMes = porMes.reduce((m, x) => Math.max(m, x.valor), 0) || 1;
  const mediaMensal = mesesComGasto.length
    ? data.total / mesesComGasto.length
    : 0;
  const filtroMesHTML = mesesComGasto.length
    ? `<select id="gastoMesFiltro" class="gasto-mes-filtro" aria-label="Filtrar por mês">
         <option value="">Todos os meses</option>
         ${mesesComGasto.map((m) => `<option value="${m.mes}">${escapeHTML(MESES_NOMES[m.mes - 1])}</option>`).join("")}
       </select>`
    : "";
  const graficoHTML = porMes.length
    ? `<div class="gasto-sec-head">
         <h4 class="transp-sec-titulo">Gasto mês a mês</h4>
         ${filtroMesHTML}
       </div>
       <div class="gasto-grafico" id="gastoMeses">
         ${porMes
           .map(
             (m) => `<div class="gasto-col" data-mes="${m.mes}">
             <div class="gasto-col-tip"><strong>${escapeHTML(MESES_NOMES[m.mes - 1])}</strong>${fmtBRL(m.valor)}</div>
             <div class="gasto-col-bar">
               <div class="gasto-col-fill" style="height:${m.valor > 0 ? Math.max(3, (m.valor / maxMes) * 100) : 0}%"></div>
             </div>
             <span class="gasto-col-mes">${MESES_CURTOS[m.mes - 1]}</span>
           </div>`,
           )
           .join("")}
       </div>
       <div class="gasto-grafico-resumo">
         <span id="gastoMesInfo">Média mensal: <strong>${fmtBRL(mediaMensal)}</strong></span>
         <span>${mesesComGasto.length}/12 meses com gasto</span>
       </div>`
    : "";

  const catHTML = categorias.length
    ? categorias
        .map(
          (c) => `
        <div class="transp-cat">
          <div class="transp-cat-top"><span>${escapeHTML(c.categoria)}</span><strong>${fmtBRL(c.valor)}</strong></div>
          <div class="transp-cat-bar"><div class="transp-cat-fill" style="width:${Math.max(2, (c.valor / maxCat) * 100)}%"></div></div>
        </div>`,
        )
        .join("")
    : '<p class="transp-vazio">Nenhuma despesa registrada neste ano.</p>';

  const recentesHTML = recentes.length
    ? '<table class="transp-tab"><thead><tr><th>Data</th><th>Tipo</th><th>Fornecedor</th><th>Valor</th></tr></thead><tbody>' +
      recentes
        .map(
          (r) => `<tr>
            <td>${escapeHTML(fmtDataBR(r.data))}</td>
            <td>${escapeHTML(r.tipo || "")}</td>
            <td>${escapeHTML(r.fornecedor || "")}</td>
            <td class="transp-tab-valor">${r.url ? `<a href="${escapeHTML(r.url)}" target="_blank" rel="noopener noreferrer">${fmtBRL(r.valor)}</a>` : fmtBRL(r.valor)}</td>
          </tr>`,
        )
        .join("") +
      "</tbody></table>"
    : "";

  const pizzaHTML = pizzaCategorias(data, ano, "");

  return `
    <p class="perfil-cota-nota">Gastos da ${escapeHTML(origem.cota)} — reembolsos de ${escapeHTML(String(ano))}.</p>
    ${seloGastosAte(data, ano)}
    <div class="transp-total">
      <span>Total gasto em ${escapeHTML(String(ano))}</span>
      <strong>${fmtBRL(data.total)}</strong>
      <small>${escapeHTML(String(data.qtde || 0))} documentos</small>
    </div>
    ${graficoHTML}
    <div id="gastoPizza">${pizzaHTML}</div>
    <h4 class="transp-sec-titulo">Por categoria (detalhe)</h4>
    <div class="transp-cats">${catHTML}</div>
    <h4 class="transp-sec-titulo">Total gasto por ano</h4>
    <div id="gastosAnos"><div class="loading">Carregando anos…</div></div>
    ${recentesHTML ? `<h4 class="transp-sec-titulo">Despesas recentes</h4>${recentesHTML}` : ""}
    <p class="transp-fonte">Fonte: <a href="${escapeHTML(origem.fonte)}" target="_blank" rel="noopener noreferrer">${escapeHTML(origem.fonteLabel)}</a></p>
  `;
}

async function carregarFranca() {
  const lista = document.getElementById("transpLista");
  const ano = document.getElementById("transpAno")?.value || String(new Date().getFullYear());
  if (lista) lista.innerHTML = '<div class="loading">Carregando gastos da Prefeitura…</div>';
  transpStatus("");
  try {
    const res = await fetch(`/api/transparencia/franca?ano=${encodeURIComponent(ano)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Falha");
    if (!data.disponivel) {
      lista.innerHTML = `
        <div class="transp-franca-vazio">
          <h3>Prefeitura de Franca-SP</h3>
          <p>${escapeHTML(data.motivo || "Dados indisponíveis para o período.")}</p>
          <p class="transp-franca-nota">Tente outro ano no seletor acima.</p>
        </div>`;
      transpStatus("Sem dados publicados para este ano.");
      return;
    }

    const funcoes = data.funcoes || [];
    const maxF = funcoes.reduce((m, f) => Math.max(m, f.valor), 0) || 1;
    const total = Number(data.total) || 0;
    const populacao = Number(data.populacao) || 0;
    const perCapita = populacao ? total / populacao : 0;
    const maior = funcoes[0] || null;
    const fmtPct = (v) =>
      (total ? (v / total) * 100 : 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });

    const pref = data.prefeito || null;
    const iniciais = pref
      ? pref.nome
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
          .toUpperCase()
      : "";

    lista.innerHTML = `
      <div class="franca-painel">
        <div class="franca-cabecalho">
          <div class="franca-brasao" aria-hidden="true"><img src="/assets/icons/profile_prefeituradefranca.png" alt="" /></div>
          <div class="franca-id">
            <strong>Prefeitura de Franca</strong>
            <span class="franca-id-sub">São Paulo · Execução orçamentária</span>
          </div>
          <span class="franca-ano-chip">${escapeHTML(String(data.ano))}</span>
        </div>

        ${
          pref
            ? `<div class="franca-prefeito">
          <div class="franca-prefeito-avatar" aria-hidden="true">${
            pref.foto
              ? `<img src="${escapeHTML(pref.foto)}" alt="" onerror="this.replaceWith(document.createTextNode('${escapeHTML(iniciais)}'))" />`
              : escapeHTML(iniciais)
          }</div>
          <div class="franca-prefeito-info">
            <span class="franca-prefeito-rotulo">Prefeito · gestão ${escapeHTML(pref.mandato || "")}</span>
            <strong>${escapeHTML(pref.nome)}</strong>
            <span class="franca-prefeito-partido">${escapeHTML(pref.partido || "")}</span>
          </div>
        </div>`
            : ""
        }

        <div class="franca-destaque">
          <span class="franca-destaque-label">Despesa liquidada em ${escapeHTML(String(data.ano))}</span>
          <strong class="franca-destaque-valor">${fmtBRL(total)}</strong>
          <span class="franca-destaque-meta">Posição até o ${escapeHTML(String(data.periodo))}º bimestre${populacao ? ` · ${populacao.toLocaleString("pt-BR")} habitantes` : ""}</span>
        </div>

        <div class="franca-cards">
          ${
            populacao
              ? `<div class="franca-mini">
            <span class="franca-mini-label">Por habitante</span>
            <strong>${fmtBRL(perCapita)}</strong>
            <small>despesa ÷ população</small>
          </div>`
              : ""
          }
          ${
            maior
              ? `<div class="franca-mini">
            <span class="franca-mini-label">Maior área</span>
            <strong>${escapeHTML(maior.funcao)}</strong>
            <small>${fmtBRL(maior.valor)} · ${fmtPct(maior.valor)}%</small>
          </div>`
              : ""
          }
          <div class="franca-mini">
            <span class="franca-mini-label">Áreas com gasto</span>
            <strong>${funcoes.length}</strong>
            <small>funções de governo</small>
          </div>
        </div>

        <div class="franca-graficos">
          <div class="franca-grafico-col">
            ${graficoPizza(
              funcoes.map((f) => ({ label: f.funcao, valor: f.valor })),
              { titulo: `Distribuição por função (${data.ano})`, max: 7 },
            )}
          </div>
          <div class="franca-grafico-col">
            <h4 class="transp-sec-titulo">Total liquidado por ano</h4>
            <div id="francaAnos"><div class="loading">Carregando anos…</div></div>
          </div>
        </div>

        <h4 class="transp-sec-titulo">Despesa por função de governo</h4>
        <div class="franca-funcoes">${
          funcoes.length
            ? funcoes
                .map(
                  (f, i) => `<div class="franca-funcao">
            <div class="franca-funcao-top">
              <span class="franca-funcao-nome"><span class="franca-funcao-rank">${i + 1}</span>${escapeHTML(f.funcao)}</span>
              <span class="franca-funcao-vals"><strong>${fmtBRL(f.valor)}</strong><span class="franca-funcao-pct">${fmtPct(f.valor)}%</span></span>
            </div>
            <div class="franca-funcao-bar"><div class="franca-funcao-fill" style="width:${Math.max(2, (f.valor / maxF) * 100)}%"></div></div>
          </div>`,
                )
                .join("")
            : '<p class="transp-vazio">Sem despesas por função neste período.</p>'
        }</div>

        <p class="transp-fonte">Fonte: <a href="${escapeHTML(data.fonte)}" target="_blank" rel="noopener noreferrer">${escapeHTML(data.fonteLabel || "SICONFI · Tesouro Nacional")}</a></p>
        ${seloAtualizado(data.atualizadoEm)}
      </div>`;
    transpStatus("");
    carregarFrancaAnos(data.ano);
  } catch (e) {
    lista.innerHTML =
      '<div class="transp-erro">Não foi possível carregar os dados de Franca-SP.</div>';
    transpStatus("Erro ao carregar Franca-SP.", true);
  }
}

// Gráfico "total por ano" da Franca — clicar numa barra troca o ano.
function carregarFrancaAnos(anoAtivo) {
  const box = document.getElementById("francaAnos");
  if (!box) return;
  fetch("/api/transparencia/franca/historico")
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.anos || !d.anos.length) {
        box.innerHTML = '<p class="transp-vazio">Sem histórico por ano.</p>';
        return;
      }
      box.innerHTML = graficoAnos(d.anos, anoAtivo);
      box.querySelectorAll("[data-ano-bar]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sel = document.getElementById("transpAno");
          if (sel) sel.value = btn.dataset.anoBar;
          carregarFranca();
        });
      });
    })
    .catch(() => {
      box.innerHTML = '<p class="transp-vazio">Não foi possível carregar o histórico por ano.</p>';
    });
}

// ─── Presidentes, ex-presidentes e vices (linha do tempo) ────────────────────
function iniciaisDe(nome) {
  return String(nome || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

function presAnoDe(iso) {
  return iso ? String(iso).slice(0, 4) : "";
}

// "1889–1891" / "2023–presente"
function presPeriodoAnos(p) {
  const ini = presAnoDe(p.inicio);
  const fim = p.fim ? presAnoDe(p.fim) : "presente";
  return ini ? `${ini}–${fim}` : "";
}

// "15/11/1889 — 23/11/1891" / "01/01/2023 — presente"
function presPeriodoCompleto(p) {
  const ini = p.inicio ? fmtDataBR(p.inicio) : "";
  const fim = p.fim ? fmtDataBR(p.fim) : "presente";
  return ini ? `${ini} — ${fim}` : "";
}

// Rótulo de partido/condição exibido nos cards e no detalhe.
function presPartidoLabel(p) {
  if (p.partido && p.partido !== "—") return p.partido;
  if (p.tipo === "junta") return "Junta governativa";
  if (p.tipo === "interino") return "Interino";
  return "Sem partido";
}

// Cor de cada partido para a "bandeirinha" antes do nome.
const PARTIDO_CORES = {
  PT: "#c4122f",
  PSDB: "#0a73c4",
  MDB: "#1a9c46",
  PMDB: "#1a9c46",
  PL: "#15356b",
  PSL: "#15356b",
  PRN: "#7a4ea3",
  ARENA: "#5a6b2f",
  PDS: "#5a6b2f",
  PSD: "#2f6f8f",
  PTB: "#b5471f",
  PSP: "#8a6d3b",
  PTN: "#6b8e23",
  PRP: "#7a8a3a",
  PRM: "#3a7a6a",
  PRC: "#7a3a5a",
  PRF: "#4a5a8a",
  "PR Federal": "#4a5a8a",
};

// Bandeira/etiqueta pequena do partido, exibida na frente do nome.
function presBandeira(p) {
  const partido = p.partido || "";
  if (!partido || partido === "—") {
    return `<span class="pres-bandeira pres-bandeira-sem" title="Sem partido">s/p</span>`;
  }
  const sigla = partido.split("/")[0].trim();
  const cor = PARTIDO_CORES[sigla] || PARTIDO_CORES[partido] || "#777";
  return `<span class="pres-bandeira" style="background:${cor}" title="${escapeHTML(partido)}">${escapeHTML(sigla)}</span>`;
}

function presAvatar(nome, foto, classe = "") {
  const ini = iniciaisDe(nome);
  return `<div class="pres-avatar${classe ? " " + classe : ""}">${
    foto
      ? `<img src="${escapeHTML(foto)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${escapeHTML(ini)}'))" />`
      : escapeHTML(ini)
  }</div>`;
}

async function carregarPresidentes() {
  const lista = document.getElementById("transpLista");
  if (transpState.presidentes) return renderPresidentes();
  if (lista)
    lista.innerHTML = '<div class="loading">Carregando presidentes…</div>';
  transpStatus("");
  try {
    const res = await fetch("/api/transparencia/presidentes");
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Falha");
    transpState.presidentes = data.presidentes || [];
    transpState.presAtt = data.atualizadoEm;
    renderPresidentes();
  } catch (e) {
    if (lista)
      lista.innerHTML =
        '<div class="transp-erro">Não foi possível carregar os presidentes.</div>';
    transpStatus("Erro ao carregar presidentes.", true);
  }
}

function renderPresidentes() {
  const lista = document.getElementById("transpLista");
  if (!lista) return;
  const todos = transpState.presidentes || [];
  const termo = (document.getElementById("transpBusca")?.value || "")
    .trim()
    .toLowerCase();
  const filtrados = termo
    ? todos.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (p.partido || "").toLowerCase().includes(termo),
      )
    : todos;

  if (!filtrados.length) {
    lista.innerHTML =
      '<div class="transp-vazio">Nenhum presidente para esta busca.</div>';
    transpStatus("");
    return;
  }

  // Agrupa por era preservando a ordem cronológica.
  const eras = [];
  const porEra = new Map();
  filtrados.forEach((p) => {
    if (!porEra.has(p.era)) {
      porEra.set(p.era, []);
      eras.push(p.era);
    }
    porEra.get(p.era).push(p);
  });

  transpStatus(
    `${todos.length} chefes de Estado desde 1889. Clique para ver o resumo, feitos e escândalos.`,
  );

  lista.innerHTML = `
    <div class="pres-timeline">
      ${eras
        .map(
          (era) => `
        <section class="pres-era">
          <h3 class="pres-era-titulo">${escapeHTML(era)}</h3>
          <div class="pres-itens">
            ${porEra.get(era).map(cardPresidente).join("")}
          </div>
        </section>`,
        )
        .join("")}
    </div>`;

  lista.querySelectorAll(".pres-item").forEach((el) => {
    const abrir = () => abrirPresidente(el.dataset.id, el.dataset.nome);
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-mencao]")) return; // clique na notificação
      abrir();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    });
    const mencao = el.querySelector("[data-mencao]");
    if (mencao)
      mencao.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirMencoesModal(mencao.dataset.mencao);
      });
  });
}

function cardPresidente(p) {
  const especial = p.tipo === "junta" || p.tipo === "interino";
  const vices = p.totalVices
    ? ` · ${p.totalVices} vice${p.totalVices > 1 ? "s" : ""}`
    : "";
  return `
    <div class="pres-item${especial ? " pres-item-especial" : ""}" data-id="${escapeHTML(p.id)}" data-nome="${escapeHTML(p.nome)}" role="button" tabindex="0" aria-label="Ver ${escapeHTML(p.nome)}">
      <div class="pres-marco" aria-hidden="true"></div>
      <div class="pres-card">
        ${presAvatar(p.nome, p.foto)}
        <div class="pres-card-info">
          <span class="pres-card-periodo">${escapeHTML(presPeriodoAnos(p))}</span>
          <strong class="pres-card-nome">${presBandeira(p)}${escapeHTML(p.nome)}</strong>
          <span class="pres-card-meta">${escapeHTML(presPartidoLabel(p))}${p.espectro ? ` · ${escapeHTML(p.espectro)}` : ""}${vices}</span>
        </div>
        ${badgeMencao(p.nome)}
        <span class="pres-card-acao" aria-hidden="true">→</span>
      </div>
    </div>`;
}

async function abrirPresidente(id, nome) {
  abrirTranspModal(`
    <div class="transp-modal-head">
      <h3>${escapeHTML(nome)}</h3>
      <span class="transp-modal-sub">Chefe de Estado · linha do tempo</span>
    </div>
    <div id="presDetalhe"><div class="loading">Carregando…</div></div>
  `);
  try {
    const res = await fetch(
      `/api/transparencia/presidentes/${encodeURIComponent(id)}`,
    );
    const d = await res.json();
    if (!res.ok) throw new Error(d.erro || "Falha");
    renderPresidenteDetalhe(d);
  } catch (e) {
    const alvo = document.getElementById("presDetalhe");
    if (alvo)
      alvo.innerHTML =
        '<div class="transp-erro">Não foi possível carregar este presidente.</div>';
  }
}

function renderPresidenteDetalhe(d) {
  const alvo = document.getElementById("presDetalhe");
  if (!alvo) return;
  const junta = d.tipo === "junta";
  const vices = d.vices || [];

  const vicesHTML = vices.length
    ? `<div class="pres-vices">${vices
        .map(
          (v) => `
        <div class="pres-vice">
          ${presAvatar(v.nome, v.foto, "pres-avatar-sm")}
          <div class="pres-vice-info">
            <strong>${escapeHTML(v.nome)}</strong>
            ${v.periodo ? `<span class="pres-vice-periodo">${escapeHTML(v.periodo)}</span>` : ""}
            ${v.bio ? `<p class="pres-vice-bio">${escapeHTML(v.bio)}</p>` : ""}
            ${v.url ? `<div class="pres-vice-rodape"><a href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">mais →</a></div>` : ""}
          </div>
        </div>`,
        )
        .join("")}</div>`
    : `<p class="transp-vazio">${junta ? "Governo colegiado — sem vice-presidente." : "Sem vice-presidente neste mandato (cargo vago ou extinto)."}</p>`;

  const listaBloco = (titulo, itens, classe) =>
    itens && itens.length
      ? `<h4 class="transp-sec-titulo">${escapeHTML(titulo)}</h4>
         <ul class="pres-lista ${classe}">${itens
           .map((t) => `<li>${escapeHTML(t)}</li>`)
           .join("")}</ul>`
      : "";

  const resumo = d.resumo || d.bio || "";

  // Bandeira do partido na frente do nome, no título do modal.
  const head = document.querySelector(
    "#transpModalConteudo .transp-modal-head h3",
  );
  if (head) head.innerHTML = `${presBandeira(d)}${escapeHTML(d.nome)}`;

  alvo.innerHTML = `
    <div class="pres-detalhe-topo">
      ${presAvatar(d.nome, d.foto, "pres-avatar-lg")}
      <div class="pres-detalhe-id">
        <span class="pres-detalhe-periodo">${escapeHTML(presPeriodoCompleto(d))}</span>
        <strong>${presBandeira(d)}${escapeHTML(presPartidoLabel(d))}</strong>
        <span class="pres-detalhe-era">${escapeHTML(d.era || "")}</span>
        ${d.espectro ? `<span class="pres-detalhe-espectro">Posição política (atribuída): <strong>${escapeHTML(d.espectro)}</strong></span>` : ""}
      </div>
    </div>
    <div class="pres-aviso">As informações abaixo reúnem o que foi <strong>encontrado em fontes públicas</strong> (registros históricos e Wikipédia). É um apanhado do que se diz sobre cada um — não é uma afirmação nem um juízo do VerusAI.</div>
    ${d.obs ? `<p class="pres-detalhe-obs">${escapeHTML(d.obs)}</p>` : ""}
    ${resumo ? `<h4 class="transp-sec-titulo">Resumo encontrado</h4><p class="pres-detalhe-bio">${escapeHTML(resumo)}</p>` : ""}
    ${listaBloco("Feitos atribuídos", d.feitos, "pres-lista-feitos")}
    ${listaBloco("Escândalos e polêmicas relatados", d.escandalos, "pres-lista-escandalos")}
    <h4 class="transp-sec-titulo">${junta ? "Composição" : `Vice-presidente${vices.length > 1 ? "s" : ""}`}</h4>
    ${vicesHTML}
    ${d.url ? `<p class="pres-detalhe-link"><a href="${escapeHTML(d.url)}" target="_blank" rel="noopener noreferrer">Ver biografia completa no Wikipédia →</a></p>` : ""}
    <p class="transp-fonte">Conteúdo reunido a partir do que foi encontrado em fontes públicas (registros históricos e API REST do Wikipédia, pt); a posição política é a classificação geralmente atribuída. Períodos conferidos com as listas oficiais de presidentes e vice-presidentes. Nada aqui é afirmado pelo VerusAI.</p>
    ${seloAtualizado(d.atualizadoEm)}
  `;
}

function abrirTranspModal(html) {
  const overlay = document.getElementById("transpModalOverlay");
  const conteudo = document.getElementById("transpModalConteudo");
  if (!overlay || !conteudo) return;
  conteudo.innerHTML = html;
  overlay.classList.add("ativo");
  document.body.style.overflow = "hidden";
}

function fecharTranspModal() {
  const overlay = document.getElementById("transpModalOverlay");
  if (!overlay || !overlay.classList.contains("ativo")) return;
  overlay.classList.remove("ativo");
  document.body.style.overflow = "";
}

// ─── Analisar Link ───────────────────────────────────────────────────────────
let analisarEmAndamento = false;

function configurarAnalisarLink() {
  const form = document.getElementById("analisarForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    iniciarAnalisePorLink();
  });
}

// Abre a aba "Analisar Link" ja preenchida e roda a analise quando o site e
// aberto com ?analisar=<url> (usado pelo botao "Analisar no VerusAI" que a
// extensao injeta no menu de compartilhar das paginas). Use &run=0 para apenas
// preencher sem disparar a analise.
async function configurarAnaliseViaUrl() {
  const params = new URLSearchParams(location.search);
  const alvo = (params.get("analisar") || "").trim();
  if (!alvo) return;

  let url;
  try {
    const u = new URL(alvo);
    if (!/^https?:$/i.test(u.protocol)) return;
    url = u.href;
  } catch {
    return;
  }

  // Ativa a aba "Analisar Link"
  const tabs = document.getElementById("tabs");
  const btn = tabs?.querySelector('.tab-btn[data-view="analisar"]');
  if (tabs && btn) {
    tabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("ativo"));
    btn.classList.add("ativo");
  }
  trocarView("analisar");

  const input = document.getElementById("analisarUrl");
  if (input) input.value = url;
  document.getElementById("analisarView")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  // Remove os parametros para nao reexecutar a analise ao recarregar a pagina.
  try {
    history.replaceState(null, "", location.pathname + location.hash);
  } catch {}

  if (params.get("run") === "0") return;

  const resolvida = await resolverUrlNoticia(url);
  if (resolvida !== url && input) input.value = resolvida;

  _anStatus("Conectando à extensão VerusAI…");
  await aguardarAuthLogado(6000);
  iniciarAnalisePorLink();
}

// Links de notícias do "Ao Vivo" vêm do RSS do Google Notícias, que é um
// redirecionador e não entrega o conteúdo da matéria para a análise. Resolve
// para a URL real do portal no servidor antes de analisar. Em caso de falha,
// devolve a URL original.
async function resolverUrlNoticia(url) {
  if (!/^https?:\/\/(?:[a-z0-9-]+\.)*news\.google\.com\//i.test(url)) {
    return url;
  }
  try {
    const res = await fetch(
      `/api/resolver-noticia?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) return url;
    const data = await res.json();
    return data.url || url;
  } catch {
    return url;
  }
}

// Manda uma URL (ex.: card do "Ao Vivo") para a aba "Analisar Link" e dispara a
// análise — reaproveita o mesmo fluxo do formulário de analisar link.
async function analisarUrlNoSite(url) {
  let limpa;
  try {
    const u = new URL(String(url || "").trim());
    if (!/^https?:$/i.test(u.protocol)) return;
    limpa = u.href;
  } catch {
    return;
  }

  setMainView("analisar");

  const input = document.getElementById("analisarUrl");
  if (input) input.value = limpa;
  _anStatus("Localizando a notícia no portal de origem…");
  limpa = await resolverUrlNoticia(limpa);
  if (input) input.value = limpa;
  document.getElementById("analisarView")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  _anStatus("Conectando à extensão VerusAI…");
  await aguardarAuthLogado(6000);
  iniciarAnalisePorLink();
}

// Espera o login chegar pela ponte com a extensao (a pagina pode abrir antes do
// content script responder). Reenvia o pedido periodicamente ate logar.
function aguardarAuthLogado(maxMs = 6000) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const tentar = () => {
      if (feedbackAuthState.logado) return resolve(true);
      if (Date.now() - inicio >= maxMs) return resolve(false);
      try {
        window.postMessage(
          { source: "VerusSite", type: "VERUS_AUTH_REQUEST" },
          window.location.origin,
        );
      } catch {}
      setTimeout(tentar, 500);
    };
    tentar();
  });
}

function _anStatus(texto, erro = false) {
  const el = document.getElementById("analisarStatus");
  if (!el) return;
  el.textContent = texto || "";
  el.classList.toggle("erro", Boolean(erro));
}

// Etapas do pipeline (espelha o _ETAPAS do sidebar da extensão).
// Índice 0 = captura no navegador; índices 1..11 = etapas do servidor.
const _AN_ETAPAS = [
  { label: "Capturando conteúdo do link", detail: "Lendo texto, título, links e metadados no navegador." },
  { label: "Classificando a página", detail: "Confirmando se o conteúdo principal é uma notícia analisável." },
  { label: "Extraindo afirmações verificáveis", detail: "Separando as claims que precisam de checagem." },
  { label: "Detectando o tipo das claims", detail: "Identificando datas, nomes, locais, números e prioridade." },
  { label: "Gerando consultas de busca", detail: "Preparando pesquisas específicas para cada afirmação." },
  { label: "Selecionando fontes candidatas", detail: "Filtrando resultados que parecem úteis para a verificação." },
  { label: "Verificando links encontrados", detail: "Comparando candidatos com o texto das claims." },
  { label: "Roteando evidências", detail: "Separando o que exige fonte oficial, API ou só contexto." },
  { label: "Consultando fontes oficiais", detail: "Conferindo dados em fontes institucionais quando necessário." },
  { label: "Revisando a análise final", detail: "Consolidando veredito, confiança e alertas." },
  { label: "Auditando claims", detail: "Revisando fontes, contexto e risco do veredito." },
  { label: "Montando resposta visual", detail: "Preparando o resultado final para o painel." },
];

let _anProg = null;
let _anProgTimer = null;

function _anFormatarTempo(ms) {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${min < 10 ? "0" : ""}${min}:${seg < 10 ? "0" : ""}${seg}`;
}

function _anIniciarProgresso() {
  const prog = document.getElementById("analisarProg");
  if (!prog) return;
  prog.hidden = false;
  prog.classList.remove("is-finished", "is-error");
  prog.style.setProperty("--ap-total", _AN_ETAPAS.length);

  const segs = document.getElementById("analisarProgSegments");
  if (segs) {
    segs.innerHTML = "";
    _AN_ETAPAS.forEach(() => {
      const s = document.createElement("span");
      s.className = "ap-segment";
      segs.appendChild(s);
    });
  }

  _anProg = {
    etapa: 0,
    progresso: 0,
    server: null,
    concluido: false,
    falhou: false,
    erro: "",
    inicioMs: Date.now(),
    fimMs: null,
  };

  clearInterval(_anProgTimer);
  _anProgTimer = setInterval(_anRenderProgresso, 180);
  _anRenderProgresso();
}

function _anCalcularProgresso() {
  const st = _anProg;
  if (st.concluido) return 100;
  if (st.falhou) return st.progresso;
  return Math.min(96, (st.etapa / _AN_ETAPAS.length) * 100);
}

function _anRenderProgresso() {
  const st = _anProg;
  if (!st) return;
  const etapa = _AN_ETAPAS[st.etapa] || _AN_ETAPAS[_AN_ETAPAS.length - 1];
  const alvo = _anCalcularProgresso();

  // Interpolação suave em direção ao alvo (mesma sensação do sidebar)
  if (!st.concluido && !st.falhou) st.progresso += (alvo - st.progresso) * 0.24;
  else st.progresso = alvo;

  const inteiro = Math.round(st.progresso);
  const set = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  const fill = document.getElementById("analisarProgFill");
  if (fill) fill.style.width = `${inteiro}%`;
  set("analisarProgPercent", `${inteiro}%`);

  set(
    "analisarProgStage",
    st.server && st.server.stage
      ? `Pipeline etapa ${st.server.stage} de ${st.server.totalStages || 11}`
      : `Etapa ${st.etapa + 1} de ${_AN_ETAPAS.length}`,
  );
  set(
    "analisarProgLabel",
    st.falhou
      ? "Não foi possível concluir a análise"
      : st.server?.label || etapa.label,
  );
  set(
    "analisarProgDetail",
    st.falhou
      ? st.erro || "O servidor retornou um erro."
      : st.server?.detail || etapa.detail,
  );
  set(
    "analisarProgClock",
    st.concluido ? "concluído" : st.falhou ? "interrompido" : "aguardando etapa real",
  );
  set("analisarProgTimer", _anFormatarTempo((st.fimMs || Date.now()) - st.inicioMs));

  document.querySelectorAll("#analisarProgSegments .ap-segment").forEach((seg, index) => {
    seg.classList.toggle("done", index < st.etapa || st.concluido);
    seg.classList.toggle("active", index === st.etapa && !st.concluido && !st.falhou);
  });
}

// Recebe o progress do servidor: { stage, totalStages, label, detail }
function _anAtualizarProgresso(serverProgress) {
  if (!_anProg || !serverProgress) return;
  if (serverProgress.stage) {
    const idx = Math.max(0, Math.min(serverProgress.stage, _AN_ETAPAS.length - 1));
    if (idx >= _anProg.etapa) _anProg.etapa = idx;
    _anProg.server = serverProgress;
  }
  _anRenderProgresso();
}

// Avança para um passo local (antes de o servidor responder)
function _anEtapaLocal(idx, label, detail) {
  if (!_anProg) return;
  _anProg.etapa = Math.max(_anProg.etapa, idx);
  if (label) _anProg.server = { label, detail: detail || "" };
  _anRenderProgresso();
}

function _anFinalizarProgresso() {
  if (!_anProg) return;
  _anProg.concluido = true;
  _anProg.fimMs = Date.now();
  _anProg.etapa = _AN_ETAPAS.length - 1;
  const prog = document.getElementById("analisarProg");
  if (prog) prog.classList.add("is-finished");
  _anRenderProgresso();
  clearInterval(_anProgTimer);
}

function _anFalharProgresso(mensagem) {
  if (!_anProg) return;
  _anProg.falhou = true;
  _anProg.fimMs = Date.now();
  _anProg.erro = mensagem || "O servidor retornou um erro.";
  const prog = document.getElementById("analisarProg");
  if (prog) prog.classList.add("is-error");
  _anRenderProgresso();
  clearInterval(_anProgTimer);
}

// Extrai o conteúdo do HTML (mesmo formato que o PageExtractor da extensão).
function _anGetMeta(doc, names) {
  for (const name of names) {
    const el = doc.querySelector(
      `meta[property="${name}"], meta[name="${name}"]`,
    );
    if (el?.content) return el.content;
  }
  return null;
}

function _anAbsoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function _anTextoLimpo(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function _anMainText(doc) {
  const seletores = [
    "article", "[role='main']", "main", ".article-body", ".post-content",
    ".entry-content", ".content-body", ".materia-conteudo", "#article-body", "#content",
  ];
  for (const sel of seletores) {
    const el = doc.querySelector(sel);
    if (el) {
      const texto = _anTextoLimpo(el);
      if (texto && texto.length > 200) return texto;
    }
  }
  return _anTextoLimpo(doc.body);
}

function _anPublishDate(doc) {
  const meta = _anGetMeta(doc, [
    "article:published_time", "datePublished", "article:modified_time",
    "og:updated_time", "date",
  ]);
  if (meta) return meta;

  const timeEl = doc.querySelector("time[datetime]");
  if (timeEl) return timeEl.getAttribute("datetime");

  const jsonLd = doc.querySelector("script[type='application/ld+json']");
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd.textContent);
      if (data.datePublished) return data.datePublished;
      if (data.dateModified) return data.dateModified;
    } catch {}
  }
  return null;
}

function _anExtrairPayload(html, url) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  let base = url;
  const baseEl = doc.querySelector("base[href]");
  if (baseEl) {
    const resolvida = _anAbsoluteUrl(baseEl.getAttribute("href"), url);
    if (resolvida) base = resolvida;
  }

  const text = _anMainText(doc);
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch {}

  let imagem = _anGetMeta(doc, ["og:image", "twitter:image"]);
  if (imagem) imagem = _anAbsoluteUrl(imagem, base);

  const links = Array.from(doc.querySelectorAll("a[href]"))
    .map((a) => _anAbsoluteUrl(a.getAttribute("href"), base))
    .filter((h) => h && h.startsWith("http"))
    .slice(0, 30);

  const headings = Array.from(doc.querySelectorAll("h1, h2, h3"))
    .map((h) => (h.textContent || "").trim())
    .filter(Boolean);

  return {
    url,
    title: doc.title || _anGetMeta(doc, ["og:title", "twitter:title"]) || "Sem título",
    description: _anGetMeta(doc, ["description", "og:description", "twitter:description"]),
    sitename: _anGetMeta(doc, ["og:site_name"]),
    author: _anGetMeta(doc, ["author", "article:author"]),
    publishdate: _anPublishDate(doc),
    imageurl: imagem,
    language: doc.documentElement?.lang || null,
    pagetype: _anGetMeta(doc, ["og:type"]) || "webpage",
    text,
    headings,
    links,
    textlength: text ? text.length : 0,
    domain: hostname,
  };
}

async function iniciarAnalisePorLink() {
  if (analisarEmAndamento) return;

  const input = document.getElementById("analisarUrl");
  const btn = document.getElementById("analisarBtn");
  const resultado = document.getElementById("analisarResultado");
  const urlBruta = (input?.value || "").trim();

  // Valida a URL
  let url;
  try {
    const u = new URL(urlBruta);
    if (!/^https?:$/i.test(u.protocol)) throw new Error("protocolo");
    url = u.href;
  } catch {
    _anStatus("Digite um link válido começando com http:// ou https://", true);
    return;
  }

  // Exige login (token vem da extensão VerusAI)
  const auth = await solicitarAuthFeedback();
  if (!auth?.logado || !auth.authToken) {
    _anStatus(
      "Faça login pela extensão VerusAI para analisar links.",
      true,
    );
    return;
  }

  analisarEmAndamento = true;
  let progressoIniciado = false;
  if (btn) btn.disabled = true;
  if (resultado) resultado.innerHTML = "";
  _anStatus("");
  _anIniciarProgresso();
  progressoIniciado = true;

  try {
    // 1) Baixa o HTML pelo proxy do servidor (evita CORS)
    const resHtml = await fetch(`/api/fetch-html?url=${encodeURIComponent(url)}`);
    const dataHtml = await resHtml.json();
    if (!resHtml.ok || !dataHtml.ok || !dataHtml.html) {
      throw new Error(dataHtml.erro || "Não foi possível baixar o link.");
    }

    // 2) Extrai o conteúdo no navegador
    const finalUrl = dataHtml.url || url;
    const payload = _anExtrairPayload(dataHtml.html, finalUrl);

    if (!payload.text || payload.text.length < 200) {
      throw new Error(
        "Não foi possível extrair texto suficiente deste link. Ele pode depender de JavaScript ou não ser um artigo.",
      );
    }

    _anEtapaLocal(0, "Enviando para análise", "Iniciando o pipeline de verificação.");

    // 3) Inicia o job de análise
    const resStart = await fetch("/analisar/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, authToken: auth.authToken }),
    });
    const dataStart = await resStart.json();
    if (!resStart.ok || !dataStart.ok || !dataStart.jobId) {
      throw new Error(dataStart.erro || "Não foi possível iniciar a análise.");
    }
    if (dataStart.progress) _anAtualizarProgresso(dataStart.progress);

    // 4) Faz polling do progresso até concluir
    const final = await _anAguardarAnalise(dataStart.jobId);

    await _anRenderarResultado(final, finalUrl, payload.title);
  } catch (err) {
    console.error("[site] erro ao analisar link:", err);
    if (progressoIniciado) {
      _anFalharProgresso(err.message || "Erro ao analisar o link.");
    } else {
      _anStatus(err.message || "Erro ao analisar o link.", true);
    }
  } finally {
    analisarEmAndamento = false;
    if (btn) btn.disabled = false;
  }
}

function _anAguardarAnalise(jobId) {
  const INTERVALO = 1500;

  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`/analisar/status/${jobId}`);
        const data = await res.json();

        if (data.progress) _anAtualizarProgresso(data.progress);

        if (data.status === "done") {
          resolve(data);
          return;
        }
        if (data.status === "error" || data.status === "not_found") {
          reject(new Error(data.erro || "A análise falhou."));
          return;
        }
        setTimeout(tick, INTERVALO);
      } catch (err) {
        // Falha de rede pontual: continua tentando sem desistir
        setTimeout(tick, INTERVALO);
      }
    };
    tick();
  });
}

async function _anRenderarResultado(statusFinal, urlAnalisada, titulo) {
  const container = document.getElementById("analisarResultado");
  if (!container) return;

  const resultado = statusFinal?.resultado || {};
  const publicacao = statusFinal?.publicacao || null;

  // Página classificada como não-notícia (pipeline encerrado cedo)
  if (resultado.status === "ignorado" || (!publicacao && resultado.etapa === "classifyPage")) {
    const motivo =
      resultado.mensagem ||
      resultado.motivonaosernoticia ||
      "O conteúdo não foi classificado como notícia.";
    _anFalharProgresso("Conteúdo não analisável.");
    container.innerHTML = `
      <div class="analisar-aviso">
        <strong>Não foi possível analisar este link.</strong>
        <p>${escapeHTML(motivo)}</p>
      </div>`;
    _anStatus("");
    return;
  }

  _anFinalizarProgresso();
  const urlFinal = publicacao?.url || urlAnalisada;

  // Tenta carregar o detalhe salvo (formato que o renderizador espera)
  try {
    const detalhe = await carregarDetalheAnalise({ url: urlFinal, title: titulo });
    renderizarModalAnalise(detalhe, container);
  } catch (err) {
    // Fallback: renderiza direto do resultado do job
    const buildFinal = resultado.etapa11_buildFinal || resultado;
    renderizarModalAnalise(
      {
        url: urlFinal,
        title: publicacao?.titulo || titulo,
        veracity: publicacao?.veredicto || "mixed",
        score: publicacao?.score,
        resultado: buildFinal,
        date: new Date().toISOString().slice(0, 10),
      },
      container,
    );
  }

  _anStatus("");
  // Atualiza a lista pública para a nova análise aparecer
  carregarAnalises();
}

// ─── Notícias ao vivo (RSS) ──────────────────────────────────────────────────
const AO_VIVO_REFRESH_MS = 90 * 1000;
let aoVivoTopico = "geral";
let aoVivoTimer = null;
let aoVivoCarregado = false;

function configurarAoVivo() {
  const topicos = document.getElementById("aoVivoTopicos");
  if (topicos) {
    topicos.querySelectorAll(".ao-vivo-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        if (chip.classList.contains("ativo")) return;
        topicos
          .querySelectorAll(".ao-vivo-chip")
          .forEach(c => c.classList.remove("ativo"));
        chip.classList.add("ativo");
        aoVivoTopico = chip.dataset.topico || "geral";
        carregarAoVivo();
      });
    });
  }

  const refresh = document.getElementById("aoVivoRefresh");
  if (refresh) refresh.addEventListener("click", () => carregarAoVivo());

  // Pausa o auto-refresh quando a aba do navegador não está visível.
  document.addEventListener("visibilitychange", () => {
    if (!document.body.classList.contains("view-aovivo")) return;
    if (document.hidden) {
      pararAutoRefreshAoVivo();
    } else {
      carregarAoVivo();
      iniciarAutoRefreshAoVivo();
    }
  });
}

function iniciarAoVivo() {
  if (!aoVivoCarregado) {
    aoVivoCarregado = true;
    carregarAoVivo();
  }
  iniciarAutoRefreshAoVivo();
}

function iniciarAutoRefreshAoVivo() {
  pararAutoRefreshAoVivo();
  aoVivoTimer = setInterval(carregarAoVivo, AO_VIVO_REFRESH_MS);
}

function pararAutoRefreshAoVivo() {
  if (aoVivoTimer) {
    clearInterval(aoVivoTimer);
    aoVivoTimer = null;
  }
}

async function carregarAoVivo() {
  const grid = document.getElementById("aoVivoGrid");
  const status = document.getElementById("aoVivoStatus");
  if (!grid) return;

  if (status) status.textContent = "Atualizando…";
  if (!grid.querySelector(".ao-vivo-card")) {
    grid.innerHTML = `<div class="loading">Carregando notícias…</div>`;
  }

  try {
    const params = new URLSearchParams({ topico: aoVivoTopico });
    const res = await fetch(`/api/noticias-ao-vivo?${params.toString()}`);
    if (!res.ok) throw new Error("Falha ao carregar notícias");
    const data = await res.json();
    renderizarAoVivo(data.noticias || []);
    if (status) {
      status.textContent = `Atualizado às ${formatarHoraAoVivo(data.atualizadoEm)}`;
    }
  } catch (err) {
    console.error("[ao-vivo] erro:", err);
    if (!grid.querySelector(".ao-vivo-card")) {
      grid.innerHTML = `
        <div class="vazio">
          <p>Não foi possível carregar as notícias agora. Tente novamente.</p>
        </div>`;
    }
    if (status) status.textContent = "Erro ao atualizar";
  }
}

function renderizarAoVivo(noticias) {
  const grid = document.getElementById("aoVivoGrid");
  if (!grid) return;

  if (!noticias.length) {
    grid.innerHTML = `
      <div class="vazio"><p>Nenhuma notícia encontrada para este tópico.</p></div>`;
    return;
  }

  grid.innerHTML = noticias
    .map(
      n => `
      <article class="ao-vivo-card reveal-card">
        <div class="ao-vivo-card-fonte">
          <span class="ao-vivo-card-badge">${escapeHTML(n.fonte || "Fonte")}</span>
          <span class="ao-vivo-card-hora">${escapeHTML(tempoRelativoAoVivo(n.publicadoEm))}</span>
        </div>
        <h3 class="ao-vivo-card-titulo">${escapeHTML(n.titulo)}</h3>
        <div class="ao-vivo-card-acoes">
          <a class="ao-vivo-card-link" href="${escapeHTML(n.url)}" target="_blank" rel="noopener noreferrer">Ler no portal →</a>
          <button class="ao-vivo-verificar" type="button" data-url="${escapeHTML(n.url)}">
            Verificar agora
          </button>
        </div>
      </article>`,
    )
    .join("");

  grid.querySelectorAll(".ao-vivo-verificar").forEach(btn => {
    btn.addEventListener("click", () => analisarUrlNoSite(btn.dataset.url));
  });

  observarAnimacoes(grid);
}

function formatarHoraAoVivo(valor) {
  const d = valor ? new Date(valor) : new Date();
  if (Number.isNaN(d.getTime())) return "agora";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function tempoRelativoAoVivo(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `há ${diffD} d`;
}

function decodificarEntidadesHTML(valor) {
  let decoded = String(valor == null ? "" : valor);

  for (let i = 0; i < 2; i++) {
    if (!/&(?:lt|gt|amp|quot|#39|apos);/i.test(decoded)) break;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = decoded;
    decoded = textarea.value;
  }

  return decoded;
}

function sanitizarHTMLInline(valor) {
  const template = document.createElement("template");
  template.innerHTML = decodificarEntidadesHTML(valor);

  function sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHTML(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(sanitizeNode).join("");

    if (tag === "br") return "<br>";
    if (tag === "strong" || tag === "b" || tag === "em" || tag === "i") {
      return `<${tag}>${children}</${tag}>`;
    }

    if (tag === "a") {
      const href = safeHttpUrl(node.getAttribute("href"));
      if (!href) return children;
      return `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${children}</a>`;
    }

    return children;
  }

  return Array.from(template.content.childNodes).map(sanitizeNode).join("");
}

function safeHttpUrl(valor) {
  try {
    const url = new URL(String(valor || "").trim());
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function tituloUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizarFontesConsultadas(fontes) {
  const lista = Array.isArray(fontes) ? fontes : fontes ? [fontes] : [];
  const dedup = new Map();

  lista.forEach(fonte => {
    let item = null;

    if (typeof fonte === "string") {
      const url = safeHttpUrl(fonte);
      item = {
        titulo: url ? tituloUrl(url) : fonte,
        fonte: url ? tituloUrl(url) : fonte,
        url,
        dominio: url ? tituloUrl(url) : "",
        tipoFonte: "",
        relevancia: "",
        papelNaVerificacao: "",
        resumo: "",
        resumoEvidencia: "",
        relacaoComClaim: "",
      };
    } else if (fonte && typeof fonte === "object") {
      const url = safeHttpUrl(fonte.url || fonte.href || fonte.link);
      const dominio = fonte.dominio || fonte.domain || (url ? tituloUrl(url) : "");
      const nome = fonte.fonte || fonte.titulo || fonte.title || fonte.nome || dominio || url;
      item = {
        titulo: fonte.titulo || fonte.title || nome,
        fonte: fonte.fonte || fonte.nome || nome,
        url,
        dominio,
        tipoFonte: fonte.tipoFonte || fonte.tipo_fonte || fonte.tipo || "",
        relevancia: fonte.relevancia || "",
        papelNaVerificacao:
          fonte.papelNaVerificacao || fonte.papel_na_verificacao || "",
        resumo:
          fonte.resumo ||
          fonte.explicacao ||
          fonte.resumoEvidencia ||
          fonte.resumo_evidencia ||
          "",
        resumoEvidencia: fonte.resumoEvidencia || fonte.resumo_evidencia || "",
        relacaoComClaim: fonte.relacaoComClaim || fonte.relacao_com_claim || "",
        avaliacaoComunidade: fonte.avaliacaoComunidade || null,
      };
    }

    if (!item || (!item.titulo && !item.fonte && !item.url)) return;
    const key = item.url || `${item.fonte}::${item.titulo}`.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, item);
  });

  return [...dedup.values()].slice(0, 12);
}

function renderizarLinksFontes(fontes) {
  return fontes
    .map(fonte => {
      const label = fonte.fonte || fonte.titulo || fonte.dominio || fonte.url;
      if (!label) return "";
      const tipo = fonte.tipoFonte ? ` <small>${escapeHTML(fonte.tipoFonte)}</small>` : "";
      if (fonte.url) {
        return `<a class="modal-source-tag modal-source-link" href="${escapeHTML(fonte.url)}" data-preview-title="${escapeHTML(fonte.titulo || label)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}${tipo}</a>`;
      }
      return `<span class="modal-source-tag">${escapeHTML(label)}${tipo}</span>`;
    })
    .join("");
}

function normalizarEntidadesMencionadas(entidades) {
  const lista = Array.isArray(entidades) ? entidades : entidades ? [entidades] : [];
  const dedup = new Map();

  lista.forEach(entidade => {
    let item = null;
    if (typeof entidade === "string") {
      item = { nome: entidade, tipo: "outros", url: "" };
    } else if (entidade && typeof entidade === "object") {
      item = {
        nome: entidade.nome || entidade.name || entidade.texto || "",
        tipo: entidade.tipo || entidade.type || "outros",
        url: safeHttpUrl(entidade.url || entidade.urlWikipedia || entidade.wikipedia),
      };
    }

    if (!item?.nome) return;
    const key = `${item.tipo}::${item.nome}`.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, item);
  });

  return [...dedup.values()].slice(0, 24);
}

function labelTipoEntidade(tipo) {
  const labels = {
    pessoas: "Pessoa",
    locais: "Local",
    cidades: "Cidade",
    estados: "Estado",
    paises: "Pais",
    regioes: "Regiao",
    instituicoes: "Instituicao",
    orgaos_publicos: "Orgao publico",
    empresas: "Empresa",
    projetos: "Projeto",
    partidos: "Partido",
    cargos: "Cargo",
    eventos: "Evento",
    conceitos: "Conceito",
    outros: "Entidade",
  };
  return labels[tipo] || labels[normalizarFonte(tipo)] || tipo || "Entidade";
}

function renderizarEntidades(entidades) {
  return entidades
    .map(entidade => {
      const tipo = labelTipoEntidade(entidade.tipo);
      const conteudo = `<small>${escapeHTML(tipo)}</small><span>${escapeHTML(entidade.nome)}</span>`;
      if (entidade.url) {
        return `<a class="modal-entity-tag" href="${escapeHTML(entidade.url)}" target="_blank" rel="noopener noreferrer">${conteudo}</a>`;
      }
      return `<span class="modal-entity-tag">${conteudo}</span>`;
    })
    .join("");
}
