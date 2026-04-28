// ui/sidebar.js
var SIDEBAR_ID = "sidebar_id";
var OVERLAY_ID = "sidebar_overlay";
var BTN_ID = "btn_id";
var BTN_CHAT_ID = "btn_chat_id";

var logo = chrome.runtime.getURL("/assets/images/VerusIAAtivo 1.svg");
var iconDarkmode = chrome.runtime.getURL("assets/icons/dark_mode.svg");
var iconSun = chrome.runtime.getURL("assets/icons/Sun.svg");
var iconSettings = chrome.runtime.getURL("assets/icons/settings.svg");
var iconLogout = chrome.runtime.getURL("assets/icons/logout.svg");

function _bloquearTeclado(e) {
  if (!VerusState.sidebarOpen) return;
  var ativo = document.activeElement;
  var dentroDoShadow =
    ativo?.id === SIDEBAR_ID ||
    ativo?.shadowRoot !== undefined ||
    ativo?.closest?.("#" + SIDEBAR_ID) !== null;
  if (dentroDoShadow) return;
  e.stopPropagation();
  e.stopImmediatePropagation();
  e.preventDefault();
}

function _attachKeyboardGuard() {
  window.addEventListener("keydown", _bloquearTeclado, true);
  window.addEventListener("keyup", _bloquearTeclado, true);
}

function _detachKeyboardGuard() {
  window.removeEventListener("keydown", _bloquearTeclado, true);
  window.removeEventListener("keyup", _bloquearTeclado, true);
}

function fecharSidebar() {
  VerusState.sidebarOpen = false;
  _detachKeyboardGuard();
  document.getElementById(SIDEBAR_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();

  var btn = document.getElementById(BTN_ID);
  var btnChat = document.getElementById(BTN_CHAT_ID);
  if (btn) { btn.textContent = "Analisar"; btn.disabled = false; }
  if (btnChat) { btnChat.textContent = "💬"; btnChat.style.display = ""; }
}

function criarSidebar(analysis, mostrarLoginImediato) {
  analysis = analysis || null;
  mostrarLoginImediato = mostrarLoginImediato || false;

  VerusState.sidebarOpen = true;

  var overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:41235122;";
  overlay.addEventListener("click", fecharSidebar);
  document.body.appendChild(overlay);

  _attachKeyboardGuard();

  var host = document.createElement("div");
  host.id = SIDEBAR_ID;
  document.body.appendChild(host);

  var shadow = host.attachShadow({ mode: "open" });

  var styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("src/shared/sidebar.css");
  shadow.appendChild(styleLink);

  var open = document.createElement("aside");
  open.innerHTML =
    '<header id="header">' +
      '<div class="img"><img id="logo" src="' + logo + '" alt="" /></div>' +
      '<div class="tm_stt">' +
        '<div class="tema"><div class="retangleTema"><div class="circleTema"><img src="' + iconDarkmode + '" class="icon-darkmode" /></div></div></div>' +
        '<div class="menu"><img id="settings" src="' + iconSettings + '" class="icon-settings" /></div>' +
      '</div>' +
    '</header>' +

    '<div id="chatMensagens"></div>' +
    '<footer class="chatFooter">' +
      '<input type="text" id="chatInput" placeholder="Faça sua pergunta..." />' +
      '<button id="chatEnviar">➤</button>' +
    '</footer>' +
    '<div id="menuConfig" class="menuConfig escondido">' +
      '<div class="menuConfigHeader"><h2>Configurações</h2><button id="fecharConfig">✕</button></div>' +
      '<div class="menuConfigUsuario"><p id="menuNomeUsuario"></p>' +
        '<div id="menuLogout"><img src="' + iconLogout + '" class="icon-logout-menu" /><p>Sair</p></div>' +
      '</div>' +
      '<div class="menuConfigSecao"><h3>Acessibilidade</h3>' +
        '<div class="menuConfigItem"><p>Tamanho do texto</p>' +
          '<div class="alttexto"><button id="menuLess">−</button><div id="menuBar"></div><button id="menuPlus">+</button></div>' +
        '</div>' +
        '<div class="menuConfigItem"><p>Alto contraste</p><div class="retangleConfig" data-config="contraste"><div class="circleConfig"></div></div></div>' +
        '<div class="menuConfigItem"><p>Tema escuro</p><div class="retangleConfig" data-config="tema"><div class="circleConfig"></div></div></div>' +
        '<div class="menuConfigItem"><p>Leitor de Notícia</p><div class="retangleConfig" data-config="leitornoticias"><div class="circleConfig"></div></div></div>' +
      '</div>' +
    '</div>';

  shadow.appendChild(open);

  // Aplica configs locais imediatamente para evitar flash de tema errado
  storageGet("configs").then(function(r) {
    if (r.configs) aplicarConfigsNoShadow(shadow, open, r.configs);
  });

  var chatInput = shadow.getElementById("chatInput");
  var chatEnviar = shadow.getElementById("chatEnviar");
  var chatMensagens = shadow.getElementById("chatMensagens");
  var menuConfig = shadow.getElementById("menuConfig");
  var menuNomeUsuario = shadow.getElementById("menuNomeUsuario");
  var menuBar = shadow.getElementById("menuBar");
  var menuLess = shadow.getElementById("menuLess");
  var menuPlus = shadow.getElementById("menuPlus");

  // Nome do usuário — usa cache primeiro
  if (VerusState.cachedNome || VerusState.cachedEmail) {
    menuNomeUsuario.textContent = VerusState.cachedNome || VerusState.cachedEmail.split("@")[0];
  } else {
    storageGet(["email", "nome"]).then(function(r) {
      if (r.nome) { menuNomeUsuario.textContent = r.nome; VerusState.cachedNome = r.nome; }
      else if (r.email) { menuNomeUsuario.textContent = r.email.split("@")[0]; VerusState.cachedEmail = r.email; }
    });
  }

  // Tamanho do texto
  var fontSize = 50;
  var minFont = 12, maxFont = 24;

  function getSize() { return Math.round(minFont + (fontSize / 100) * (maxFont - minFont)); }
  function updateFontBar() {
    menuBar.style.setProperty("--fill", fontSize + "%");
    open.style.setProperty("--font-size", getSize() + "px");
  }

  menuLess.addEventListener("click", function() { fontSize = Math.max(0, fontSize - 10); updateFontBar(); salvarConfigs(shadow, fontSize, isContextValid); });
  menuPlus.addEventListener("click", function() { fontSize = Math.min(100, fontSize + 10); updateFontBar(); salvarConfigs(shadow, fontSize, isContextValid); });

  // Toggles de acessibilidade
  shadow.querySelectorAll(".retangleConfig").forEach(function(btn) {
    btn.addEventListener("click", function() {
      btn.classList.toggle("ativo-config");
      var id = btn.dataset.config;
      var ativo = btn.classList.contains("ativo-config");

      if (id === "contraste") open.classList.toggle("alto-contraste", ativo);
      if (id === "tema") open.classList.toggle("tema-escuro", ativo);
      if (id === "leitornoticias") {
        if (ativo) ativarLeitor();
        else desativarLeitor();
      }

      salvarConfigs(shadow, fontSize, isContextValid);
    });
  });

  // Botão de tema rápido no header
  var retangleTema = shadow.querySelector(".retangleTema");
  var iconTemaImg = shadow.querySelector(".circleTema img");

  retangleTema.addEventListener("click", function() {
    var temaAtivo = open.classList.toggle("tema-escuro");
    iconTemaImg.src = temaAtivo ? iconSun : iconDarkmode;
    var toggleTema = shadow.querySelector(".retangleConfig[data-config='tema']");
    if (toggleTema) toggleTema.classList.toggle("ativo-config", temaAtivo);
    salvarConfigs(shadow, fontSize, isContextValid);
  });

  // Settings
  shadow.getElementById("settings").addEventListener("click", function() {
    menuConfig.classList.toggle("escondido");
    if (!menuConfig.classList.contains("escondido")) {
      carregarConfigs(shadow, open, isContextValid).then(function(configs) {
        if (configs && configs.fontSize !== undefined) fontSize = configs.fontSize;
      });
    }
  });

  shadow.getElementById("fecharConfig").addEventListener("click", function() {
    menuConfig.classList.add("escondido");
  });

  shadow.getElementById("menuLogout").addEventListener("click", function() {
    storageRemove(["logado", "email", "configs"]).then(function() {
      VerusState.cachedEmail = null;
      VerusState.cachedNome = null;
      open.classList.remove("alto-contraste", "tema-escuro");
      open.style.removeProperty("--font-size");
      fecharSidebar();
    });
  });

  // Renderiza análise
  if (analysis) {
    _renderAnalysis(shadow, open, analysis, chatMensagens);
  }

  // Chat
  function _verificarLoginParaChat() {
    return storageGet("logado").then(function(r) { return r.logado === true; });
  }

  function _abrirLoginSeNecessario() {
    if (shadow.getElementById("login_popup_interno")) return;
    chatInput.blur();
    criarPopupLoginInterno(shadow, function(email, nome) {
      menuNomeUsuario.textContent = nome || email.split("@")[0];
    });
  }

  chatInput.addEventListener("focus", async function() {
    if (shadow.getElementById("login_popup_interno")) return;
    var logado = await _verificarLoginParaChat();
    if (!logado) _abrirLoginSeNecessario();
  });

  chatInput.addEventListener("keydown", function(e) {
    e.stopPropagation();
    if (e.key === "Enter") _enviarMensagem();
  });
  chatInput.addEventListener("keyup", function(e) { e.stopPropagation(); });
  chatEnviar.addEventListener("click", _enviarMensagem);

  async function _enviarMensagem() {
    var logado = await _verificarLoginParaChat();
    if (!logado) { _abrirLoginSeNecessario(); return; }

    var texto = chatInput.value.trim();
    if (!texto) return;

    var msgUsuario = document.createElement("div");
    msgUsuario.className = "mensagemUsuario";
    msgUsuario.textContent = texto;
    chatMensagens.appendChild(msgUsuario);
    chatInput.value = "";
    chatMensagens.scrollTop = chatMensagens.scrollHeight;

    var msgIA = document.createElement("div");
    msgIA.className = "mensagemIA";
    msgIA.textContent = "Digitando...";
    chatMensagens.appendChild(msgIA);
    chatMensagens.scrollTop = chatMensagens.scrollHeight;

    try {
      var resposta = await analyzeWithOpenAI(
        { text: texto, url: window.location.href, title: null, foundLinks: [], imageUrl: null, platform: "web", hasMultipleTopics: false },
        []
      );
      var linksHTML = resposta.links && resposta.links.length > 0
        ? resposta.links.map(function(l) { return "<a href='" + l.url + "' target='_blank'>" + l.title + "</a>"; }).join(" · ")
        : "";
      msgIA.innerHTML = resposta.summary || resposta;
      if (linksHTML) msgIA.innerHTML += "<br/><br/>" + linksHTML;
    } catch(e) {
      msgIA.textContent = "Erro ao obter resposta.";
    }

    chatMensagens.scrollTop = chatMensagens.scrollHeight;
  }

  if (mostrarLoginImediato) {
    setTimeout(function() {
      criarPopupLoginInterno(shadow, function(email, nome) {
        menuNomeUsuario.textContent = nome || email.split("@")[0];
      });
    }, 100);
  } else {
    setTimeout(function() { chatInput.focus(); }, 100);
  }

  // Carrega configs ao abrir (apenas uma vez)
  carregarConfigs(shadow, open, isContextValid).then(function(configs) {
    if (configs && configs.fontSize !== undefined) fontSize = configs.fontSize;
  });
}

function _renderAnalysis(shadow, open, analysis, chatMensagens) {
  var sourceHTML = analysis.source ? _buildSourceHTML(analysis.source) : "";
  var claimsHTML = analysis.claims && analysis.claims.length > 0 ? _buildClaimsHTML(analysis.claims) : "";
  var linksHTML = _buildLinksHTML(analysis);

  var msgIA = document.createElement("div");
  msgIA.className = "mensagemIAPrimeira";
  msgIA.innerHTML =
    '<p class="result">Resultado da Verificação</p>' +
    '<p id="textAnalysis">' + (analysis.summary || "Análise concluída.") + '</p>' +
    sourceHTML +
    (claimsHTML ? '<div id="claimsSection"><p class="claims-title">Afirmações verificadas</p>' + claimsHTML + '</div>' : '') +
    (linksHTML ? '<div id="footerAnalysis"><p class="claims-title">Fontes consultadas</p><div class="footer-links-wrapper">' + linksHTML + '</div></div>' : '');
  chatMensagens.appendChild(msgIA);
  chatMensagens.scrollTop = chatMensagens.scrollHeight;
}

function _buildSourceHTML(s) {
  var credColors = { alta: "#3fb537", "média": "#f1ae2b", baixa: "#ff5858", desconhecida: "#aaa" };
  var credColor = credColors[s.credibility] || "#aaa";
  var typeLabels = { news_outlet: "Veículo jornalístico", influencer: "Influenciador", official: "Canal oficial", unknown: "Canal desconhecido" };
  var typeLabel = typeLabels[s.channelType] || "";
  var exclusiveNote = s.isExclusive && s.exclusivityNote ? "<p class='source-exclusive'>⚠️ " + s.exclusivityNote + "</p>" : "";
  var officialLink = s.officialArticleUrl ? "<a href='" + s.officialArticleUrl + "' target='_blank' class='source-link'>🔗 Ver matéria no site oficial</a>" : "";
  var channelLink = s.sourceUrl
    ? "<a href='" + s.sourceUrl + "' target='_blank' class='source-link'>" + (s.channelName || s.sourceHandle || siteNameFromUrl(s.sourceUrl)) + "</a>"
    : "<strong>" + (s.channelName || s.sourceHandle || "") + "</strong>";
  return "<div class='source-card'>" +
    "<div class='source-card-header'>" + channelLink + " <span class='source-type-label'>" + typeLabel + "</span> <span style='color:" + credColor + ";font-weight:700'>" + s.credibility + "</span></div>" +
    (s.channelSummary ? "<p class='source-card-summary'>" + s.channelSummary + "</p>" : "") +
    exclusiveNote + officialLink +
    "</div>";
}

function _buildClaimsHTML(claims) {
  var verdictLabels = {
    supported: "✅ Confirmada", disputed: "❌ Contestada", mixed: "⚠️ Divergente",
    insufficient_evidence: "🔍 Não há como confirmar", not_checkable: "— Não verificável",
  };
  return claims.map(function(c) {
    var verdictLabel = verdictLabels[c.verdict] || c.verdict;
    var sourcesHTML = c.sources && c.sources.length > 0
      ? c.sources.map(function(s) {
          return "<div class='source-item'><a href='" + s.url + "' target='_blank' class='source-link'>" + siteNameFromUrl(s.url) + "</a>" +
            (s.snippet ? "<span class='source-snippet'>" + s.snippet + "</span>" : "") + "</div>";
        }).join("")
      : "";
    var claimTopic = c.summary ? c.summary.split(/[.,!?]/)[0].trim() : c.text;
    return "<div class='claim-item'>" +
      "<p class='claim-text'>" + claimTopic + "</p>" +
      "<span class='claim-verdict'>" + verdictLabel + "</span>" +
      (c.summary ? "<p class='claim-summary'>" + c.summary + "</p>" : "") +
      (sourcesHTML ? "<div class='claim-sources'>" + sourcesHTML + "</div>" : "") +
      "</div>";
  }).join("");
}

function _buildLinksHTML(analysis) {
  var todasFontes = (analysis.claims || []).reduce(function(acc, c) { return acc.concat(c.sources || []); }, []);
  var fontesUnicas = [];
  var seenDominios = new Set();

  function adicionarFonte(url) {
    if (!url) return;
    try {
      var dominio = new URL(url).hostname.replace(/^www\./, "");
      if (seenDominios.has(dominio)) return;
      seenDominios.add(dominio);
      fontesUnicas.push({ title: siteNameFromUrl(url), url: url });
    } catch(e) {}
  }

  todasFontes.forEach(function(f) { adicionarFonte(f.url); });
  (analysis.links || []).forEach(function(l) { adicionarFonte(l.url); });
  if (fontesUnicas.length < 3) adicionarFonte(window.location.href);

  return fontesUnicas.length > 0
    ? fontesUnicas.map(function(f) { return "<a href='" + f.url + "' target='_blank' class='footer-source-link'>" + f.title + "</a>"; }).join("")
    : "";
}
