// ui/selo-comunidade.js
// Aviso flutuante (direita) exibido quando a noticia atual ja foi analisada
// pelo VerusAI e tem feedback (like/dislike/comentarios) registrado pela
// comunidade. Deixa o veredito da IA visivel ao lado da opiniao dos usuarios
// que ja passaram por essa mesma noticia.

var SELO_COM_ID = "verus_selo_comunidade";
var _seloComTentado = false;

function _seloComInjetarEstilo() {
  if (document.getElementById("verus_selo_comunidade_style")) return;
  var s = document.createElement("style");
  s.id = "verus_selo_comunidade_style";
  s.textContent =
    "#verus_selo_comunidade{--vc-ink:#171715;--vc-cream:#f4ecdf;--vc-red:#d3392d;--vc-blue:#02519b;--vc-accent:var(--vc-blue);position:fixed;right:16px;bottom:83px;z-index:2147483646;width:250px;font-family:'Space Mono','Courier New',monospace;background:var(--vc-cream);color:var(--vc-ink);border:2px solid var(--vc-ink);border-left:5px solid var(--vc-accent);border-radius:6px;box-shadow:4px 4px 0 rgba(23,23,21,.16),0 14px 32px rgba(23,23,21,.26);overflow:hidden;animation:verusSeloComIn .25s ease-out both;box-sizing:border-box;}" +
    "#verus_selo_comunidade.vc-alerta{--vc-accent:var(--vc-red);}" +
    "@keyframes verusSeloComIn{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}" +
    "#verus_selo_comunidade *{box-sizing:border-box;}" +
    "#verus_selo_comunidade .vc-head{display:flex;align-items:center;gap:9px;padding:10px 10px 8px;}" +
    "#verus_selo_comunidade .vc-logo{width:30px;height:30px;border-radius:6px;background:#fff;border:1px solid rgba(23,23,21,.15);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:700;font-size:15px;color:var(--vc-accent);}" +
    "#verus_selo_comunidade .vc-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}" +
    "#verus_selo_comunidade .vc-eyebrow{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--vc-accent);}" +
    "#verus_selo_comunidade .vc-nome{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    "#verus_selo_comunidade .vc-close{background:none;border:none;color:var(--vc-ink);cursor:pointer;font-size:16px;line-height:1;opacity:.55;padding:2px 4px;flex-shrink:0;}" +
    "#verus_selo_comunidade .vc-close:hover{opacity:1;}" +
    "#verus_selo_comunidade .vc-aviso{margin:0;padding:0 10px 8px;font-size:11px;line-height:1.4;}" +
    "#verus_selo_comunidade .vc-votos{display:flex;gap:8px;padding:0 10px 10px;}" +
    "#verus_selo_comunidade .vc-voto{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;font-size:12px;font-weight:700;padding:7px 8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid rgba(23,23,21,.25);color:var(--vc-ink);transition:background .15s ease,border-color .15s ease,color .15s ease;}" +
    "#verus_selo_comunidade .vc-voto:hover{border-color:var(--vc-ink);}" +
    "#verus_selo_comunidade .vc-voto svg{width:14px;height:14px;display:block;}" +
    "#verus_selo_comunidade .vc-like.ativo{background:var(--vc-blue);border-color:var(--vc-blue);color:#fff;}" +
    "#verus_selo_comunidade .vc-dislike.ativo{background:var(--vc-red);border-color:var(--vc-red);color:#fff;}" +
    "#verus_selo_comunidade .vc-status{font-size:10px;line-height:1.4;padding:0 10px 10px;margin:0;opacity:.85;}" +
    "#verus_selo_comunidade .vc-status.erro{color:var(--vc-red);opacity:1;}" +
    "#verus_selo_comunidade .vc-status.ok{color:var(--vc-blue);opacity:1;}" +
    "@media (max-width:480px){#verus_selo_comunidade{right:12px;bottom:16px;width:220px;}}";
  document.head.appendChild(s);
}

function _seloComIconeLike() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
}

function _seloComIconeDislike() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
}

function _seloComStatus(raiz, msg, tipo) {
  var el = raiz.querySelector(".vc-status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "vc-status" + (tipo ? " " + tipo : "");
}

function _seloComMensagemAviso(resumo) {
  var total = resumo.likes + resumo.dislikes;
  if (resumo.dislikes > resumo.likes && resumo.dislikes >= 2) {
    return (
      "⚑ " + resumo.dislikes + " pessoas marcaram esta noticia como duvidosa."
    );
  }
  if (total > 0 && resumo.comentarios > 0) {
    return (
      total +
      " avaliacoes e " +
      resumo.comentarios +
      (resumo.comentarios === 1 ? " comentario" : " comentarios") +
      " da comunidade."
    );
  }
  if (total > 0) return total + " pessoas ja avaliaram esta noticia.";
  return resumo.comentarios + " comentarios da comunidade sobre esta noticia.";
}

function _seloComAtualizarVotos(raiz, resumo, votoUsuario) {
  var likeBtn = raiz.querySelector(".vc-like");
  var dislikeBtn = raiz.querySelector(".vc-dislike");
  if (likeBtn) {
    likeBtn.querySelector(".vc-n").textContent = Number(resumo.likes || 0);
    var on = votoUsuario === "like";
    likeBtn.classList.toggle("ativo", on);
    likeBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (dislikeBtn) {
    dislikeBtn.querySelector(".vc-n").textContent = Number(
      resumo.dislikes || 0,
    );
    var on2 = votoUsuario === "dislike";
    dislikeBtn.classList.toggle("ativo", on2);
    dislikeBtn.setAttribute("aria-pressed", on2 ? "true" : "false");
  }
  var raizEl = raiz;
  raizEl.classList.toggle(
    "vc-alerta",
    resumo.dislikes > resumo.likes && resumo.dislikes >= 2,
  );
}

async function _seloComVotar(raiz, url, titulo, reacao) {
  var sessao = await _obterSessaoAnalise();
  if (!sessao.logado || !sessao.authToken) {
    _seloComStatus(raiz, "Entre na extensao para avaliar.", "erro");
    return;
  }
  _seloComStatus(raiz, "");
  var res = await _fetchBackground(
    API_BASE + "/api/analises/feedback",
    "POST",
    {
      authToken: sessao.authToken,
      url: url,
      titulo: titulo || "",
      reacao: reacao,
      comentario: "",
    },
  );
  var data = res && res.data ? res.data : null;
  if (!res || !res.ok || !data || !data.ok) {
    _seloComStatus(
      raiz,
      _erroResposta(res, "Nao foi possivel avaliar."),
      "erro",
    );
    return;
  }
  var votoUsuario =
    data.feedback && data.feedback.reacao ? data.feedback.reacao : "";
  _seloComAtualizarVotos(raiz, data.resumo, votoUsuario);
  var avisoEl = raiz.querySelector(".vc-aviso");
  if (avisoEl) avisoEl.textContent = _seloComMensagemAviso(data.resumo);
}

function _seloComRenderizar(url, titulo, resumo, votoUsuario) {
  _seloComInjetarEstilo();
  if (document.getElementById(SELO_COM_ID)) return;

  var raiz = document.createElement("div");
  raiz.id = SELO_COM_ID;

  raiz.innerHTML =
    '<div class="vc-head">' +
    '<div class="vc-logo"><span>👥</span></div>' +
    '<div class="vc-title">' +
    '<span class="vc-eyebrow">Comunidade VerusAI</span>' +
    '<span class="vc-nome">Feedback desta noticia</span>' +
    "</div>" +
    '<button class="vc-close" type="button" aria-label="Fechar">×</button>' +
    "</div>" +
    '<p class="vc-aviso"></p>' +
    '<div class="vc-votos">' +
    '<button class="vc-voto vc-like" type="button" aria-pressed="false" title="Concordo com esta noticia">' +
    _seloComIconeLike() +
    '<span class="vc-n">' +
    Number(resumo.likes || 0) +
    "</span></button>" +
    '<button class="vc-voto vc-dislike" type="button" aria-pressed="false" title="Considero esta noticia duvidosa">' +
    _seloComIconeDislike() +
    '<span class="vc-n">' +
    Number(resumo.dislikes || 0) +
    "</span></button>" +
    "</div>" +
    '<p class="vc-status"></p>';

  document.body.appendChild(raiz);

  raiz.querySelector(".vc-aviso").textContent = _seloComMensagemAviso(resumo);
  _seloComAtualizarVotos(raiz, resumo, votoUsuario);

  raiz.querySelector(".vc-close").addEventListener("click", function () {
    raiz.remove();
  });
  raiz.querySelector(".vc-like").addEventListener("click", function () {
    _seloComVotar(raiz, url, titulo, "like");
  });
  raiz.querySelector(".vc-dislike").addEventListener("click", function () {
    _seloComVotar(raiz, url, titulo, "dislike");
  });
}

// Busca o resumo de feedback (like/dislike/comentarios) da comunidade para a
// URL informada e, se houver algum registro, mostra o aviso flutuante.
// Chamada pelo autoDestacar() do claim-highlight.js quando a pagina atual ja
// tem uma analise salva no VerusAI.
async function CriarSeloComunidade(url, titulo) {
  if (_seloComTentado || document.getElementById(SELO_COM_ID)) return;
  if (!url || typeof _fetchBackground !== "function") return;
  _seloComTentado = true;

  try {
    var sessao = await _obterSessaoAnalise();
    var rota =
      API_BASE +
      "/api/analises/feedback?url=" +
      encodeURIComponent(url) +
      (sessao.authToken
        ? "&authToken=" + encodeURIComponent(sessao.authToken)
        : "");
    var res = await _fetchBackground(rota, "GET");
    var data = res && res.data ? res.data : null;
    if (!data || !data.ok || !data.resumo) return;

    var resumo = data.resumo;
    var semFeedback =
      Number(resumo.likes || 0) === 0 &&
      Number(resumo.dislikes || 0) === 0 &&
      Number(resumo.comentarios || 0) === 0;
    if (semFeedback) return;

    var votoUsuario =
      data.feedback && data.feedback.reacao ? data.feedback.reacao : "";
    _seloComRenderizar(url, titulo, resumo, votoUsuario);
  } catch (e) {
    /* silencioso — sem aviso se algo falhar */
  }
}

window.VerusSeloComunidade = { criar: CriarSeloComunidade };
