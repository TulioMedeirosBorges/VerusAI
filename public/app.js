/* VerusAI — app.js */

const API_URL = "https://api.anthropic.com/v1/messages";
const POR_PAGINA = 9;

let todasAnalises = [];
let filtradas = [];
let paginaAtual = 1;
let filtroAtivo = "";
let buscaAtiva = "";
let dataInicioAtiva = "";
let dataFimAtiva = "";
let fonteAtiva = "";
let ordenacaoAtiva = "recentes";

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
  configurarBusca();
  configurarFiltros();
  configurarFiltrosAvancados();
  configurarModal();
  configurarSobre();
  configurarAdmin();
  configurarAnimacoes();
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

  await new Promise(r => setTimeout(r, 600)); // simula fetch

  todasAnalises = DEMO_DATA;
  preencherFiltroFontes();
  aplicarFiltros();
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

  const fontes = [...new Set(
    todasAnalises.flatMap(a => Array.isArray(a.sources) ? a.sources : [])
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));

  fonteFiltro.innerHTML = `<option value="">Todas as fontes</option>`;
  fontes.forEach(fonte => {
    const option = document.createElement("option");
    option.value = normalizarTexto(fonte);
    option.textContent = fonte;
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
    const matchFonte = !fonteAtiva ||
      (a.sources || []).some(fonte => normalizarTexto(fonte) === fonteAtiva);
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
      <span class="card-arrow" aria-hidden="true">→</span>
    </div>
  `;

  div.addEventListener("click", () => abrirModal(a));
  return div;
}

// ─── Paginação ─────────────────────────────────────────────────────────────
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

function abrirModal(a) {
  const label = { true: "✅ Verdadeiro", false: "❌ Falso", mixed: "⚠️ Misto" };
  const overlay = document.getElementById("modalOverlay");
  const conteudo = document.getElementById("modalConteudo");

  conteudo.innerHTML = `
    <span class="modal-veracity ${a.veracity}">${label[a.veracity] || a.veracity}</span>
    <h2>${escapeHTML(a.title)}</h2>
    <a class="modal-url" href="${a.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(a.url)}</a>
    ${a.summary ? `
      <p class="modal-section-title">Resumo da análise</p>
      <p class="modal-body">${escapeHTML(a.summary)}</p>
    ` : ""}
    ${a.sources && a.sources.length ? `
      <p class="modal-section-title">Fontes consultadas</p>
      <div class="modal-sources">
        ${a.sources.map(s => `<span class="modal-source-tag">${escapeHTML(s)}</span>`).join("")}
      </div>
    ` : ""}
    ${a.date ? `<p class="modal-section-title" style="margin-top:1.5rem">Data da verificação: ${formatarData(a.date)}</p>` : ""}
  `;

  overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  document.getElementById("modalOverlay").classList.remove("aberta");
  document.body.style.overflow = "";
}

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

  document.getElementById("adminRemover").addEventListener("click", () => {
    const key = document.getElementById("adminKey").value.trim();
    const url = document.getElementById("adminUrl").value.trim();
    const msg = document.getElementById("adminMsg");

    if (!key) { msg.textContent = "⚠ Informe a chave admin."; return; }
    if (!url)  { msg.textContent = "⚠ Informe a URL a remover."; return; }

    // Placeholder — conecte à sua API real
    const idx = todasAnalises.findIndex(a => a.url === url);
    if (idx > -1) {
      todasAnalises.splice(idx, 1);
      aplicarFiltros();
      renderizarStats();
      msg.textContent = "✅ Análise removida com sucesso.";
      document.getElementById("adminUrl").value = "";
    } else {
      msg.textContent = "❌ URL não encontrada.";
    }
  });
}

// ─── Utilitários ───────────────────────────────────────────────────────────
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

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
