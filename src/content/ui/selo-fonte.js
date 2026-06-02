// ui/selo-fonte.js
// Selo flutuante (esquerda) que aparece quando o site visitado está no Ranking
// de Fontes do VerusAI. Mostra o ícone e o nome da página, quantos likes e
// dislikes a fonte tem, e um botão de denúncia.

var SELO_ID = "verus_selo_fonte";
var _seloTentado = false;

var _SELO_MOTIVOS = [
  ["desinformacao", "Desinformação / fake news"],
  ["sensacionalismo", "Sensacionalismo / título enganoso"],
  ["sem_fontes", "Não cita fontes confiáveis"],
  ["conteudo_ofensivo", "Conteúdo ofensivo ou de ódio"],
  ["spam", "Spam ou propaganda enganosa"],
  ["outro", "Outro"],
];

function _seloDominioAtual() {
  try {
    return location.hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) {
    return "";
  }
}

function _seloInjetarEstilo() {
  if (document.getElementById("verus_selo_style")) return;
  var s = document.createElement("style");
  s.id = "verus_selo_style";
  s.textContent =
    "#verus_selo_fonte{--vs-ink:#171715;--vs-cream:#f4ecdf;--vs-red:#d3392d;--vs-blue:#02519b;position:fixed;left:16px;bottom:24px;z-index:2147483646;width:250px;font-family:'Space Mono','Courier New',monospace;background:var(--vs-cream);color:var(--vs-ink);border:2px solid var(--vs-ink);border-left:5px solid var(--vs-red);border-radius:6px;box-shadow:4px 4px 0 rgba(23,23,21,.16),0 14px 32px rgba(23,23,21,.26);overflow:hidden;animation:verusSeloIn .25s ease-out both;box-sizing:border-box;}" +
    "@keyframes verusSeloIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}" +
    "#verus_selo_fonte *{box-sizing:border-box;}" +
    "#verus_selo_fonte .vs-head{display:flex;align-items:center;gap:9px;padding:10px 10px 8px;}" +
    "#verus_selo_fonte .vs-logo{width:30px;height:30px;border-radius:6px;background:#fff;border:1px solid rgba(23,23,21,.15);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:700;font-size:14px;color:var(--vs-blue);}" +
    "#verus_selo_fonte .vs-logo img{width:100%;height:100%;object-fit:contain;padding:4px;}" +
    "#verus_selo_fonte .vs-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}" +
    "#verus_selo_fonte .vs-eyebrow{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--vs-red);}" +
    "#verus_selo_fonte .vs-nome{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    "#verus_selo_fonte .vs-close{background:none;border:none;color:var(--vs-ink);cursor:pointer;font-size:16px;line-height:1;opacity:.55;padding:2px 4px;flex-shrink:0;}" +
    "#verus_selo_fonte .vs-close:hover{opacity:1;}" +
    "#verus_selo_fonte .vs-votos{display:flex;gap:8px;padding:0 10px 8px;}" +
    "#verus_selo_fonte .vs-voto{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;font-size:12px;font-weight:700;padding:7px 8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid rgba(23,23,21,.25);color:var(--vs-ink);transition:background .15s ease,border-color .15s ease,color .15s ease;}" +
    "#verus_selo_fonte .vs-voto:hover{border-color:var(--vs-ink);}" +
    "#verus_selo_fonte .vs-voto svg{width:14px;height:14px;display:block;}" +
    "#verus_selo_fonte .vs-like.ativo{background:var(--vs-blue);border-color:var(--vs-blue);color:#fff;}" +
    "#verus_selo_fonte .vs-dislike.ativo{background:var(--vs-red);border-color:var(--vs-red);color:#fff;}" +
    "#verus_selo_fonte .vs-den-btn{display:block;width:calc(100% - 20px);margin:0 10px 10px;font-family:inherit;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid rgba(211,57,45,.45);color:var(--vs-red);transition:background .15s ease,color .15s ease;}" +
    "#verus_selo_fonte .vs-den-btn:hover{background:var(--vs-red);color:#fff;border-color:var(--vs-red);}" +
    "#verus_selo_fonte .vs-den-panel{padding:0 10px 10px;display:none;}" +
    "#verus_selo_fonte .vs-den-panel.aberto{display:block;}" +
    "#verus_selo_fonte select{width:100%;font-family:inherit;font-size:11px;padding:7px;border:1px solid rgba(23,23,21,.25);border-radius:4px;background:#fff;color:var(--vs-ink);margin-bottom:6px;}" +
    "#verus_selo_fonte .vs-den-enviar{width:100%;font-family:inherit;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:8px;border:none;border-radius:4px;background:var(--vs-red);color:#fff;cursor:pointer;}" +
    "#verus_selo_fonte .vs-den-enviar:disabled{opacity:.6;cursor:default;}" +
    "#verus_selo_fonte .vs-status{font-size:10px;line-height:1.4;margin-top:6px;min-height:13px;opacity:.85;}" +
    "#verus_selo_fonte .vs-status.erro{color:var(--vs-red);opacity:1;}" +
    "#verus_selo_fonte .vs-status.ok{color:var(--vs-blue);opacity:1;}" +
    "@media (max-width:480px){#verus_selo_fonte{left:12px;bottom:16px;width:220px;}}";
  document.head.appendChild(s);
}

function _seloIconeLike() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
}

function _seloIconeDislike() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
}

function _seloStatus(raiz, msg, tipo) {
  var el = raiz.querySelector(".vs-status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "vs-status" + (tipo ? " " + tipo : "");
}

function _seloAtualizarVotos(raiz, data) {
  var likeBtn = raiz.querySelector(".vs-like");
  var dislikeBtn = raiz.querySelector(".vs-dislike");
  if (likeBtn) {
    likeBtn.querySelector(".vs-n").textContent = Number(data.likes || 0);
    var on = data.reacaoUsuario === "like";
    likeBtn.classList.toggle("ativo", on);
    likeBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (dislikeBtn) {
    dislikeBtn.querySelector(".vs-n").textContent = Number(data.dislikes || 0);
    var on2 = data.reacaoUsuario === "dislike";
    dislikeBtn.classList.toggle("ativo", on2);
    dislikeBtn.setAttribute("aria-pressed", on2 ? "true" : "false");
  }
}

async function _seloVotar(raiz, dominio, reacao) {
  var sessao = await _obterSessaoAnalise();
  if (!sessao.logado || !sessao.authToken) {
    _seloStatus(raiz, "Entre na extensão para avaliar.", "erro");
    return;
  }
  _seloStatus(raiz, "");
  var res = await _fetchBackground(API_BASE + "/api/fontes/voto", "POST", {
    authToken: sessao.authToken,
    dominio: dominio,
    reacao: reacao,
  });
  var data = res && res.data ? res.data : null;
  if (!res || !res.ok || !data || !data.ok) {
    _seloStatus(raiz, _erroResposta(res, "Não foi possível avaliar."), "erro");
    return;
  }
  _seloAtualizarVotos(raiz, data);
}

async function _seloDenunciar(raiz, dominio) {
  var painel = raiz.querySelector(".vs-den-panel");
  var motivo = raiz.querySelector(".vs-den-motivo").value;
  var enviar = raiz.querySelector(".vs-den-enviar");

  if (!motivo) {
    _seloStatus(raiz, "Selecione um motivo.", "erro");
    return;
  }

  var sessao = await _obterSessaoAnalise();
  if (!sessao.logado || !sessao.authToken) {
    _seloStatus(raiz, "Entre na extensão para denunciar.", "erro");
    return;
  }

  enviar.disabled = true;
  _seloStatus(raiz, "Enviando denúncia…");
  var res = await _fetchBackground(API_BASE + "/api/fontes/denuncia", "POST", {
    authToken: sessao.authToken,
    dominio: dominio,
    motivo: motivo,
    comentario: "",
  });
  enviar.disabled = false;

  var data = res && res.data ? res.data : null;
  if (!res || !res.ok || !data || !data.ok) {
    _seloStatus(raiz, _erroResposta(res, "Não foi possível denunciar."), "erro");
    return;
  }
  if (painel) painel.classList.remove("aberto");
  _seloStatus(raiz, "Denúncia registrada. Obrigado!", "ok");
}

function _seloRenderizar(data) {
  _seloInjetarEstilo();
  if (document.getElementById(SELO_ID)) return;

  var dominio = data.dominio;
  var logoUrl =
    "https://www.google.com/s2/favicons?domain=" +
    encodeURIComponent(dominio) +
    "&sz=64";
  var inicial = (dominio.charAt(0) || "?").toUpperCase();

  var raiz = document.createElement("div");
  raiz.id = SELO_ID;

  var opcoes = _SELO_MOTIVOS.map(function (m) {
    return '<option value="' + m[0] + '">' + m[1] + "</option>";
  }).join("");

  raiz.innerHTML =
    '<div class="vs-head">' +
    '<div class="vs-logo"><span>' + inicial + "</span></div>" +
    '<div class="vs-title">' +
    '<span class="vs-eyebrow">Fonte no ranking VerusAI</span>' +
    '<span class="vs-nome">' + dominio + "</span>" +
    "</div>" +
    '<button class="vs-close" type="button" aria-label="Fechar">×</button>' +
    "</div>" +
    '<div class="vs-votos">' +
    '<button class="vs-voto vs-like" type="button" aria-pressed="false" title="Gosto desta fonte">' +
    _seloIconeLike() +
    '<span class="vs-n">' + Number(data.likes || 0) + "</span></button>" +
    '<button class="vs-voto vs-dislike" type="button" aria-pressed="false" title="Não gosto desta fonte">' +
    _seloIconeDislike() +
    '<span class="vs-n">' + Number(data.dislikes || 0) + "</span></button>" +
    "</div>" +
    '<button class="vs-den-btn" type="button">⚑ Denunciar fonte</button>' +
    '<div class="vs-den-panel">' +
    '<select class="vs-den-motivo"><option value="">Motivo da denúncia…</option>' +
    opcoes +
    "</select>" +
    '<button class="vs-den-enviar" type="button">Enviar denúncia</button>' +
    '<p class="vs-status"></p>' +
    "</div>";

  document.body.appendChild(raiz);

  // Carrega o favicon real (com fallback para a inicial).
  var logoBox = raiz.querySelector(".vs-logo");
  var img = new Image();
  img.alt = "";
  img.onload = function () {
    logoBox.innerHTML = "";
    logoBox.appendChild(img);
  };
  img.src = logoUrl;

  // Estado inicial do voto do usuário.
  _seloAtualizarVotos(raiz, data);

  raiz.querySelector(".vs-close").addEventListener("click", function () {
    raiz.remove();
  });
  raiz.querySelector(".vs-like").addEventListener("click", function () {
    _seloVotar(raiz, dominio, "like");
  });
  raiz.querySelector(".vs-dislike").addEventListener("click", function () {
    _seloVotar(raiz, dominio, "dislike");
  });
  raiz.querySelector(".vs-den-btn").addEventListener("click", function () {
    var painel = raiz.querySelector(".vs-den-panel");
    painel.classList.toggle("aberto");
    if (painel.classList.contains("aberto")) _seloStatus(raiz, "");
  });
  raiz.querySelector(".vs-den-enviar").addEventListener("click", function () {
    _seloDenunciar(raiz, dominio);
  });
}

async function CriarSeloFonte() {
  if (_seloTentado || document.getElementById(SELO_ID)) return;
  var dominio = _seloDominioAtual();
  if (!dominio) return;
  // Não mostra o selo no próprio site/painel do VerusAI.
  if (dominio === "localhost" || dominio.indexOf("127.0.0.1") === 0) return;

  _seloTentado = true;

  try {
    var sessao = await _obterSessaoAnalise();
    var url =
      API_BASE +
      "/api/fontes/uma?dominio=" +
      encodeURIComponent(dominio) +
      (sessao.authToken
        ? "&authToken=" + encodeURIComponent(sessao.authToken)
        : "");
    var res = await _fetchBackground(url, "GET");
    var data = res && res.data ? res.data : null;
    if (!data || !data.ok || !data.noRanking) return;
    _seloRenderizar(data);
  } catch (e) {
    /* silencioso — sem selo se algo falhar */
  }
}
