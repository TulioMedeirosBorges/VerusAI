const API = "http://localhost:3000";

const LABELS = {
  true:  { texto: "✅ Verdadeiro", cls: "true" },
  mixed: { texto: "⚠️ Misto",      cls: "mixed" },
  false: { texto: "❌ Falso",       cls: "false" },
};

const CLAIM_LABELS = {
  supported:            "✅ Confirmada",
  disputed:             "❌ Contestada",
  mixed:                "⚠️ Divergente",
  insufficient_evidence:"🔍 Sem evidência",
  not_checkable:        "— Não verificável",
};

let paginaAtual = 1;
let buscaAtual = "";
let veredictoAtual = "";
let buscaTimer = null;

// ── AUTO-REFRESH ─────────────────────────────────────────────────────────────
let totalAtual = 0;

async function verificarAtualizacoes() {
  const data = await fetch(`${API}/api/analises?pagina=1`).then(r => r.json()).catch(() => null);
  if (!data) return;
  if (totalAtual !== 0 && data.total !== totalAtual) {
    carregarStats();
    carregarGrid();
  }
  totalAtual = data.total;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  carregarStats();
  carregarGrid();
  setInterval(verificarAtualizacoes, 30000);

  document.getElementById("busca").addEventListener("input", (e) => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => {
      buscaAtual = e.target.value.trim();
      paginaAtual = 1;
      carregarGrid();
    }, 400);
  });

  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      veredictoAtual = btn.dataset.v;
      paginaAtual = 1;
      carregarGrid();
    });
  });

  document.getElementById("modalFechar").addEventListener("click", fecharModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) fecharModal();
  });

  document.getElementById("adminToggle").addEventListener("click", () => {
    document.getElementById("adminPanel").classList.toggle("aberto");
  });

  document.getElementById("adminRemover").addEventListener("click", removerAnalise);
});

// ── STATS ─────────────────────────────────────────────────────────────────────
async function carregarStats() {
  const [total, verdadeiro, misto, falso] = await Promise.all([
    fetch(`${API}/api/analises?pagina=1`).then(r => r.json()).then(d => d.total).catch(() => 0),
    fetch(`${API}/api/analises?veredicto=true`).then(r => r.json()).then(d => d.total).catch(() => 0),
    fetch(`${API}/api/analises?veredicto=mixed`).then(r => r.json()).then(d => d.total).catch(() => 0),
    fetch(`${API}/api/analises?veredicto=false`).then(r => r.json()).then(d => d.total).catch(() => 0),
  ]);

  document.getElementById("stats").innerHTML = `
    <div class="stat-card azul"><div class="stat-num">${total}</div><div class="stat-label">Total analisadas</div></div>
    <div class="stat-card verde"><div class="stat-num">${verdadeiro}</div><div class="stat-label">Verdadeiras</div></div>
    <div class="stat-card amarelo"><div class="stat-num">${misto}</div><div class="stat-label">Mistas</div></div>
    <div class="stat-card vermelho"><div class="stat-num">${falso}</div><div class="stat-label">Falsas</div></div>
  `;
}

// ── GRID ──────────────────────────────────────────────────────────────────────
async function carregarGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = '<div class="loading">Carregando...</div>';

  const params = new URLSearchParams({ pagina: paginaAtual });
  if (buscaAtual) params.set("busca", buscaAtual);
  if (veredictoAtual) params.set("veredicto", veredictoAtual);

  const data = await fetch(`${API}/api/analises?${params}`).then(r => r.json()).catch(() => null);

  if (!data || data.analises.length === 0) {
    grid.innerHTML = '<div class="vazio">Nenhuma análise encontrada.</div>';
    document.getElementById("paginacao").innerHTML = "";
    return;
  }

  grid.innerHTML = data.analises.map(a => {
    const label = LABELS[a.veredicto] || { texto: a.veredicto, cls: "mixed" };
    const dominio = (() => { try { return new URL(a.url).hostname.replace("www.", ""); } catch { return a.url; } })();
    const data_fmt = new Date(a.criado_em).toLocaleDateString("pt-BR");
    return `
      <div class="card ${label.cls}" onclick="abrirModal('${encodeURIComponent(a.url)}')">
        <span class="card-badge ${label.cls}">${label.texto}</span>
        <p class="card-titulo">${a.titulo || dominio}</p>
        <p class="card-url">${dominio}</p>
        <div class="card-footer">
          <span class="card-score">Score: ${a.score ?? "—"}%</span>
          <span class="card-data">${data_fmt}</span>
        </div>
      </div>
    `;
  }).join("");

  renderPaginacao(data.paginas);
}

function renderPaginacao(total) {
  const el = document.getElementById("paginacao");
  if (total <= 1) { el.innerHTML = ""; return; }

  let html = "";
  if (paginaAtual > 1) html += `<button class="pag-btn" onclick="irPagina(${paginaAtual - 1})">‹</button>`;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - paginaAtual) <= 2) {
      html += `<button class="pag-btn ${i === paginaAtual ? "ativo" : ""}" onclick="irPagina(${i})">${i}</button>`;
    } else if (Math.abs(i - paginaAtual) === 3) {
      html += `<span style="color:var(--texto2);padding:0 4px">…</span>`;
    }
  }

  if (paginaAtual < total) html += `<button class="pag-btn" onclick="irPagina(${paginaAtual + 1})">›</button>`;
  el.innerHTML = html;
}

function irPagina(n) {
  paginaAtual = n;
  carregarGrid();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
async function abrirModal(urlEncoded) {
  const url = decodeURIComponent(urlEncoded);
  const overlay = document.getElementById("modalOverlay");
  const conteudo = document.getElementById("modalConteudo");

  conteudo.innerHTML = '<div class="loading">Carregando detalhes...</div>';
  overlay.classList.add("aberto");
  document.body.style.overflow = "hidden";

  const data = await fetch(`${API}/api/analises/detalhe?url=${encodeURIComponent(url)}`).then(r => r.json()).catch(() => null);

  if (!data) {
    conteudo.innerHTML = '<p style="color:var(--texto2)">Erro ao carregar análise.</p>';
    return;
  }

  const r = data.resultado;
  console.log('[Modal] Dados da análise:', r);
  console.log('[Modal] Claims com relevância:', r.claims?.map(c => ({
    text: c.text?.slice(0, 30),
    sources: c.sources?.length,
    temRelevancia: c.sources?.some(s => s.relevancia)
  })));
  
  const label = LABELS[r.overallVerdict] || { texto: r.overallVerdict, cls: "mixed" };
  const data_fmt = new Date(data.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const score = r.confidenceScore ?? 0;

  const claimsHTML = (r.claims || []).map(c => {
    const clabel = CLAIM_LABELS[c.verdict] || c.verdict;
    const reasonHTML = (c.verdict === "disputed" || c.verdict === "mixed") && c.summary
      ? `<p class="claim-reason">${c.summary}</p>` : "";
    const sourcesHTML = (c.sources || []).length > 0
      ? `<div class="claim-sources">${c.sources.map(s =>
          `<a href="${s.url}" target="_blank" class="claim-source-link">${domainFrom(s.url)}</a>`
        ).join("")}</div>` : "";
    
    // Debug: mostra informações de relevância se existirem
    let debugHTML = "";
    if (c.sources && c.sources.some(s => s.relevancia)) {
      debugHTML = `<details class="debug-relevancia"><summary>Debug: Relevância das fontes</summary><div class="debug-content">`;
      c.sources.forEach(s => {
        if (s.relevancia) {
          debugHTML += `
            <div class="debug-fonte">
              <strong>${domainFrom(s.url)}</strong>
              <p>Status: <span class="badge-${s.relevancia.status}">${s.relevancia.status}</span></p>
              <p>Pontuação: ${s.relevancia.pontos} pontos</p>
              <p>Ano original: ${s.relevancia.anoOriginal || 'N/A'} | Ano fonte: ${s.relevancia.anoFonte || 'N/A'}</p>
              <p>Similaridade: ${s.relevancia.similaridade}%</p>
              <p>Mesmo domínio: ${s.relevancia.mesmoDominio ? 'Sim' : 'Não'}</p>
              <p class="debug-explicacao">${s.relevancia.explicacao}</p>
            </div>
          `;
        }
      });
      debugHTML += `</div></details>`;
    }
    
    return `
      <div class="claim">
        <p class="claim-texto">${c.text}</p>
        <span class="claim-badge ${c.verdict}">${clabel}</span>
        ${reasonHTML}
        ${sourcesHTML}
        ${debugHTML}
      </div>
    `;
  }).join("");

  const fontesHTML = (r.links || []).length > 0
    ? `<div class="fontes-lista">${r.links.map(l =>
        `<a href="${l.url}" target="_blank" class="fonte-chip">${l.title || domainFrom(l.url)}</a>`
      ).join("")}</div>` : "<p style='color:var(--texto2);font-size:13px'>Nenhuma fonte registrada.</p>";

  conteudo.innerHTML = `
    <div class="modal-header">
      <span class="modal-badge ${label.cls}">${label.texto}</span>
      <p class="modal-titulo">${r.summary || url}</p>
      <a href="${url}" target="_blank" class="modal-url">${url}</a>
    </div>

    <div class="modal-score-bar">
      <div class="modal-score-fill" style="width:${score}%;background-position:${-(score / 100) * 680 + 680}px center"></div>
    </div>
    <p class="modal-score-label">Score de confiabilidade: <strong>${score}%</strong></p>

    ${claimsHTML ? `
    <div class="modal-secao">
      <p class="modal-secao-titulo">Afirmações verificadas</p>
      ${claimsHTML}
    </div>` : ""}

    <div class="modal-secao">
      <p class="modal-secao-titulo">Fontes consultadas</p>
      ${fontesHTML}
    </div>

    <p class="modal-data">Analisado em ${data_fmt}</p>
  `;
}

function fecharModal() {
  document.getElementById("modalOverlay").classList.remove("aberto");
  document.body.style.overflow = "";
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
async function removerAnalise() {
  const url = document.getElementById("adminUrl").value.trim();
  const adminKey = document.getElementById("adminKey").value.trim();
  const msg = document.getElementById("adminMsg");

  if (!url || !adminKey) { msg.textContent = "Preencha todos os campos."; msg.style.color = "var(--vermelho)"; return; }

  const res = await fetch(`${API}/api/analises`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, adminKey }),
  }).then(r => r.json()).catch(() => null);

  if (res?.mensagem) {
    msg.textContent = "✅ Removida com sucesso.";
    msg.style.color = "var(--verde)";
    carregarGrid();
    carregarStats();
  } else {
    msg.textContent = res?.erro || "Erro ao remover.";
    msg.style.color = "var(--vermelho)";
  }
}

function domainFrom(url) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}
