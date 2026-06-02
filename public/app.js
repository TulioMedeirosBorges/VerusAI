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
  } catch (err) {
    console.error("[site] erro ao carregar analises:", err);
    todasAnalises = [];
    filtradas = [];
    renderizarStats([]);
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
  const host  = tentarHost(a.url);
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

function renderizarModalAnalise(a) {
  const label = { true: "Verdadeiro", false: "Falso", mixed: "Misto" };
  const resultado = obterBuildFinalResultado(a.resultado || {});
  const conteudo = document.getElementById("modalConteudo");
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
    <a class="modal-url" href="${escapeHTML(a.url)}" data-preview-title="${escapeHTML(a.title)}" target="_blank" rel="noopener noreferrer">${escapeHTML(a.url)}</a>
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
    }))
    .filter((comentario) => comentario.comentario);
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
      }
    });
  }

  configurarModalDenuncia();
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

// ─── Abas (Análises / Ao Vivo) ───────────────────────────────────────────────
function configurarAbas() {
  const tabs = document.getElementById("tabs");
  if (!tabs) return;

  tabs.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      trocarView(btn.dataset.view);
    });
  });
}

function trocarView(view) {
  const aoVivo = view === "aovivo";
  const fontes = view === "fontes";
  document.body.classList.toggle("view-aovivo", aoVivo);
  document.body.classList.toggle("view-fontes", fontes);

  const secaoAoVivo = document.getElementById("aoVivo");
  if (secaoAoVivo) secaoAoVivo.hidden = !aoVivo;
  const secaoFontes = document.getElementById("fontesView");
  if (secaoFontes) secaoFontes.hidden = !fontes;

  if (aoVivo) {
    iniciarAoVivo();
  } else {
    pararAutoRefreshAoVivo();
  }

  if (fontes) {
    iniciarFontes();
  }
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
      <a class="ao-vivo-card reveal-card" href="${escapeHTML(n.url)}"
         target="_blank" rel="noopener noreferrer">
        <div class="ao-vivo-card-fonte">
          <span class="ao-vivo-card-badge">${escapeHTML(n.fonte || "Fonte")}</span>
          <span class="ao-vivo-card-hora">${escapeHTML(tempoRelativoAoVivo(n.publicadoEm))}</span>
        </div>
        <h3 class="ao-vivo-card-titulo">${escapeHTML(n.titulo)}</h3>
        <span class="ao-vivo-card-link">Ler no portal →</span>
      </a>`,
    )
    .join("");

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
