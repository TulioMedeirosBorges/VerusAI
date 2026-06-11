// features/configs.js
var _iconDarkmode = chrome.runtime.getURL("assets/icons/dark_mode.svg");
var _iconSun = chrome.runtime.getURL("assets/icons/Sun.svg");

function aplicarConfigsNoShadow(shadow, open, configs) {
  var fontSize = configs.fontSize;
  var toggles = configs.toggles;
  var minFont = 12, maxFont = 24;

  if (fontSize !== undefined) {
    var px = Math.round(minFont + (fontSize / 100) * (maxFont - minFont));
    open.style.setProperty("--font-size", px + "px");
    var menuBar = shadow.getElementById("menuBar");
    if (menuBar) menuBar.style.setProperty("--fill", fontSize + "%");
  }

  if (toggles) {
    shadow.querySelectorAll(".retangleConfig").forEach(function(btn) {
      var id = btn.dataset.config;
      var ativo = !!toggles[id];
      btn.classList.toggle("ativo-config", ativo);

      if (id === "contraste") open.classList.toggle("alto-contraste", ativo);
      if (id === "tema") {
        open.classList.toggle("tema-escuro", ativo);
        var img = shadow.querySelector("#botaoTema .icon-tema");
        if (img) img.src = ativo ? _iconSun : _iconDarkmode;
      }
      if (id === "leitornoticias") {
        if (ativo) ativarLeitor();
        else desativarLeitor();
      }
    });
  }
}

function aplicarConfigsGlobal(configs) {
  if (!configs || !configs.toggles) return;
  if (configs.toggles.leitornoticias) ativarLeitor();
  else desativarLeitor();

  var host = document.getElementById("sidebar_id");
  if (host && host.shadowRoot) {
    var open = host.shadowRoot.querySelector("aside");
    if (open) aplicarConfigsNoShadow(host.shadowRoot, open, configs);
  }
}

async function salvarConfigs(shadow, fontSize, isContextValidFn) {
  var toggles = {};
  shadow.querySelectorAll(".retangleConfig").forEach(function(btn) {
    toggles[btn.dataset.config] = btn.classList.contains("ativo-config");
  });

  var configs = { fontSize: fontSize, toggles: toggles };
  await storageSet({ configs: configs });

  if (isContextValidFn()) {
    chrome.runtime.sendMessage({ type: "CONFIGS_UPDATED", configs: configs });
  }

  var email = VerusState.cachedEmail;
  if (!email) return;

  try {
    await VerusAPI.salvarConfigs(email, configs);
  } catch(e) {
    console.warn("[VerusAI] Falha ao salvar configs no servidor:", e.message);
  }
}

async function carregarConfigs(shadow, open, isContextValidFn) {
  var resultado = await storageGet(["email", "configs"]);

  if (resultado.email) VerusState.cachedEmail = resultado.email;

  var configs = resultado.configs || null;

  if (resultado.email) {
    try {
      var res = await VerusAPI.carregarConfigs(resultado.email);
      if (res.ok && res.data && res.data.configs && Object.keys(res.data.configs).length > 0) {
        configs = res.data.configs;
        await storageSet({ configs: configs });
      }
    } catch(e) {
      console.warn("[VerusAI] Usando configs locais (servidor indisponível)");
    }
  }

  if (configs) aplicarConfigsNoShadow(shadow, open, configs);
  return configs;
}
