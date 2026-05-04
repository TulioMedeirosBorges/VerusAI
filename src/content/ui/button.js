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

  var pct = document.createElement("div");
  pct.style.cssText = "font-size:13px;font-weight:700;margin-bottom:6px;";

  var barOuter = document.createElement("div");
  barOuter.style.cssText = "width:100%;height:4px;background:#003a0f;border-radius:2px;margin-bottom:6px;";
  var barInner = document.createElement("div");
  barInner.style.cssText = "height:4px;background:#00ff41;border-radius:2px;transition:width 0.4s ease;width:0%;";
  barOuter.appendChild(barInner);

  var label = document.createElement("div");
  label.textContent = _ETAPAS[0];

  popup.appendChild(pct);
  popup.appendChild(barOuter);
  popup.appendChild(label);
  document.body.appendChild(popup);

  function atualizar(etapa) {
    var p = Math.round(((etapa + 1) / _ETAPAS.length) * 100);
    pct.textContent = p + "%";
    barInner.style.width = p + "%";
    label.textContent = _ETAPAS[etapa];
  }

  atualizar(0);
  var etapa = 0;
  var intervalo = setInterval(function() {
    etapa = Math.min(etapa + 1, _ETAPAS.length - 1);
    atualizar(etapa);
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

    button.textContent = "Analisando...";
    button.disabled = true;

    var progresso = _criarPopupProgresso();

    var payload = await PageExtractor.extract();

    var resultado = null;
    try {
      var res = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          type: "FETCH",
          url: "http://localhost:3000/analisar",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        }, resolve);
      });
      if (res && res.ok) resultado = res.data;
      else throw new Error(res?.data?.erro || "Erro no servidor");
    } catch(e) {
      resultado = { erro: e.message };
    }

    progresso.remove();
    criarSidebar({ _payload: payload, _resultado: resultado }, false);
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
