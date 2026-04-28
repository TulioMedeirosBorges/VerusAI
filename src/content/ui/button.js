// ui/button.js
var _buttonStyle = document.createElement("style");
_buttonStyle.textContent =
  "#btn_wrapper { position:fixed; right:16px; bottom:24px; z-index:2147483647; display:flex; flex-direction:row; align-items:center; gap:8px; }" +
  "#btn_id { border:none; border-radius:999px; padding:10px 16px; background:#f1ae2b; color:#000; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 10px 24px rgba(0,0,0,0.25); white-space:nowrap; }" +
  "#btn_chat_id { border:none; border-radius:999px; padding:10px 16px; background:#000; color:#fff; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 10px 24px rgba(0,0,0,0.25); white-space:nowrap; }" +
  "#sidebar_overlay { position:fixed; top:0; left:0; width:100%; height:100%; z-index:41235122; background:transparent; }";
document.head.appendChild(_buttonStyle);

var _ETAPAS = [
  "> Capturando conteúdo da página...",
  "> Classificando tipo de conteúdo...",
  "> Extraindo afirmações verificáveis...",
  "> Buscando fontes e evidências...",
  "> Verificando claims com busca web...",
  "> Buscando matérias relacionadas...",
  "> Analisando canal/perfil da fonte...",
  "> Consolidando resultado final...",
];

function _criarPopupProgresso() {
  var popup = document.createElement("div");
  popup.id = "verus_progress_popup";
  popup.style.cssText =
    "position:fixed;bottom:80px;right:16px;" +
    "background:#000;color:#00ff41;" +
    "font-family:'Courier New',Courier,monospace;font-size:11px;" +
    "padding:10px 14px;border-radius:8px;border:1px solid #00ff41;" +
    "z-index:2147483646;max-width:280px;line-height:1.6;" +
    "box-shadow:0 0 12px rgba(0,255,65,0.3);white-space:nowrap;";
  popup.textContent = _ETAPAS[0];
  document.body.appendChild(popup);

  var etapa = 0;
  var intervalo = setInterval(function() {
    etapa = Math.min(etapa + 1, _ETAPAS.length - 1);
    popup.textContent = _ETAPAS[etapa];
  }, 4000);

  return {
    remove: function() { clearInterval(intervalo); popup.remove(); }
  };
}

function CreateButton() {
  if (document.getElementById(BTN_ID)) return;

  var wrapper = document.createElement("div");
  wrapper.id = "btn_wrapper";

  var button = document.createElement("button");
  button.id = BTN_ID;
  button.type = "button";
  button.textContent = "Analisar";
  button.setAttribute("aria-label", "Abrir painel de Análise");

  var buttonChat = document.createElement("button");
  buttonChat.id = BTN_CHAT_ID;
  buttonChat.type = "button";
  buttonChat.textContent = "💬";
  buttonChat.setAttribute("aria-label", "Abrir chat");

  button.addEventListener("click", async function() {
    if (document.getElementById(SIDEBAR_ID)) {
      fecharSidebar();
      return;
    }

    var article = getVisibleArticle();
    if (!article) { alert("Nenhum post visível encontrado."); return; }

    var expanded = expandPost(article);
    if (expanded) await new Promise(function(r) { setTimeout(r, 400); });

    var payload = extractPagePayload(article);
    var video = article.querySelector("video");

    button.textContent = "Analisando...";
    button.disabled = true;

    var progresso = _criarPopupProgresso();

    var analysis = { summary: "", links: [] };
    try {
      analysis = video
        ? await analyzeWithOpenAI(payload, await captureFrames(video))
        : await analyzeWithOpenAI(payload, []);
    } catch(e) {
      analysis = {
        pageType: "error", summary: "Erro ao analisar o conteúdo.",
        overallVerdict: "unverifiable", confidenceLabel: "baixa",
        confidenceScore: 0, claims: [], links: [], warnings: ["Erro desconhecido"],
      };
    }

    progresso.remove();
    criarSidebar(analysis, false);
    button.textContent = "Fechar";
    button.disabled = false;
  });

  buttonChat.addEventListener("click", async function() {
    var logado = await storageGet("logado").then(function(r) { return r.logado === true; });
    if (document.getElementById(SIDEBAR_ID)) fecharSidebar();
    buttonChat.style.display = "none";
    button.textContent = "Fechar";
    criarSidebar(null, !logado);
  });

  wrapper.appendChild(buttonChat);
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);
}
