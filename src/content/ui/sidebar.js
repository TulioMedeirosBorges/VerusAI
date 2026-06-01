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
  if (btn) {
    btn.textContent = "Analisar";
    btn.disabled = false;
  }
  if (btnChat) {
    btnChat.innerHTML =
      typeof _chatIconSvg === "function" ? _chatIconSvg() : "Chat";
    btnChat.style.display = "";
  }
}

function criarSidebar(analysis, mostrarLoginImediato) {
  analysis = analysis || null;
  mostrarLoginImediato = mostrarLoginImediato || false;

  VerusState.sidebarOpen = true;

  var overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:41235122;";
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
    '<div class="img"><img id="logo" src="' +
    logo +
    '" alt="" /></div>' +
    '<div class="tm_stt">' +
    '<div class="tema"><div class="retangleTema"><div class="circleTema"><img src="' +
    iconDarkmode +
    '" class="icon-darkmode" /></div></div></div>' +
    '<div class="menu"><img id="settings" src="' +
    iconSettings +
    '" class="icon-settings" /></div>' +
    "</div>" +
    "</header>" +
    '<div class="chatToolbar">' +
    '<button id="chatHistoricoBtn" type="button" aria-label="Ver historico do chat">' +
    '<svg class="chatHistoricoIcon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M12 7v5l3 2"></path>' +
    "</svg>" +
    "<span>Historico</span>" +
    "</button>" +
    "</div>" +
    '<div id="chatHistoricoPanel" class="chatHistoricoPanel escondido">' +
    '<div class="chatHistoricoHeader"><strong>Historico do chat</strong><button id="chatHistoricoFechar" type="button">Fechar</button></div>' +
    '<div id="chatHistoricoLista"></div>' +
    '<button id="chatHistoricoLimpar" type="button">Limpar historico</button>' +
    "</div>" +
    '<div id="chatMensagens"></div>' +
    '<footer class="chatFooter">' +
    '<textarea id="chatInput" rows="1" placeholder="Pergunte sobre uma noticia..."></textarea>' +
    '<button id="chatEnviar" type="button" aria-label="Enviar pergunta">&rarr;</button>' +
    "</footer>" +
    '<div id="menuConfig" class="menuConfig escondido">' +
    '<div class="menuConfigHeader"><h2>Configurações</h2><button id="fecharConfig">✕</button></div>' +
    '<div class="menuConfigUsuario"><p id="menuNomeUsuario"></p>' +
    '<div id="menuLogout"><img src="' +
    iconLogout +
    '" class="icon-logout-menu" /><p>Sair</p></div>' +
    "</div>" +
    '<div class="menuConfigSecao"><h3>Acessibilidade</h3>' +
    '<div class="menuConfigItem"><p>Tamanho do texto</p>' +
    '<div class="alttexto"><button id="menuLess">−</button><div id="menuBar"></div><button id="menuPlus">+</button></div>' +
    "</div>" +
    '<div class="menuConfigItem"><p>Alto contraste</p><div class="retangleConfig" data-config="contraste"><div class="circleConfig"></div></div></div>' +
    '<div class="menuConfigItem"><p>Tema escuro</p><div class="retangleConfig" data-config="tema"><div class="circleConfig"></div></div></div>' +
    '<div class="menuConfigItem"><p>Leitor de Notícia</p><div class="retangleConfig" data-config="leitornoticias"><div class="circleConfig"></div></div></div>' +
    "</div>" +
    "</div>";

  shadow.appendChild(open);

  // Aplica configs locais imediatamente para evitar flash de tema errado
  storageGet("configs").then(function (r) {
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
    menuNomeUsuario.textContent =
      VerusState.cachedNome || VerusState.cachedEmail.split("@")[0];
  } else {
    storageGet(["email", "nome"]).then(function (r) {
      if (r.nome) {
        menuNomeUsuario.textContent = r.nome;
        VerusState.cachedNome = r.nome;
      } else if (r.email) {
        menuNomeUsuario.textContent = r.email.split("@")[0];
        VerusState.cachedEmail = r.email;
      }
    });
  }

  // Tamanho do texto
  var fontSize = 50;
  var minFont = 12,
    maxFont = 24;

  function getSize() {
    return Math.round(minFont + (fontSize / 100) * (maxFont - minFont));
  }
  function updateFontBar() {
    menuBar.style.setProperty("--fill", fontSize + "%");
    open.style.setProperty("--font-size", getSize() + "px");
  }

  menuLess.addEventListener("click", function () {
    fontSize = Math.max(0, fontSize - 10);
    updateFontBar();
    salvarConfigs(shadow, fontSize, isContextValid);
  });
  menuPlus.addEventListener("click", function () {
    fontSize = Math.min(100, fontSize + 10);
    updateFontBar();
    salvarConfigs(shadow, fontSize, isContextValid);
  });

  // Toggles de acessibilidade
  shadow.querySelectorAll(".retangleConfig").forEach(function (btn) {
    btn.addEventListener("click", function () {
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

  retangleTema.addEventListener("click", function () {
    var temaAtivo = open.classList.toggle("tema-escuro");
    iconTemaImg.src = temaAtivo ? iconSun : iconDarkmode;
    var toggleTema = shadow.querySelector(
      ".retangleConfig[data-config='tema']",
    );
    if (toggleTema) toggleTema.classList.toggle("ativo-config", temaAtivo);
    salvarConfigs(shadow, fontSize, isContextValid);
  });

  // Settings
  shadow.getElementById("settings").addEventListener("click", function () {
    menuConfig.classList.toggle("escondido");
    if (!menuConfig.classList.contains("escondido")) {
      carregarConfigs(shadow, open, isContextValid).then(function (configs) {
        if (configs && configs.fontSize !== undefined)
          fontSize = configs.fontSize;
      });
    }
  });

  shadow.getElementById("fecharConfig").addEventListener("click", function () {
    menuConfig.classList.add("escondido");
  });

  shadow.getElementById("menuLogout").addEventListener("click", function () {
    storageRemove(["logado", "email", "nome", "authToken", "configs"]).then(function () {
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

  if (window.VerusChat && typeof window.VerusChat.inicializar === "function") {
    window.VerusChat.inicializar({
      shadow: shadow,
      analysis: analysis,
      menuNomeUsuario: menuNomeUsuario,
    });
  }

  if (
    window.VerusLinkPreview &&
    typeof window.VerusLinkPreview.attach === "function"
  ) {
    window.VerusLinkPreview.attach(shadow);
  }

  if (mostrarLoginImediato) {
    setTimeout(function () {
      criarPopupLoginInterno(shadow, function (email, nome) {
        menuNomeUsuario.textContent = nome || email.split("@")[0];
      });
    }, 100);
  } else {
    setTimeout(function () {
      var sx = window.scrollX,
        sy = window.scrollY;
      chatInput.focus({ preventScroll: true });
      window.scrollTo(sx, sy);
    }, 100);
  }

  // Carrega configs ao abrir (apenas uma vez)
  carregarConfigs(shadow, open, isContextValid).then(function (configs) {
    if (configs && configs.fontSize !== undefined) fontSize = configs.fontSize;
  });
}

function _formatarData(valor) {
  try {
    var d = new Date(valor);
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return valor;
  }
}

function _escapeHTML(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function _decodeHTMLEntities(valor) {
  var decoded = String(valor == null ? "" : valor);

  for (var i = 0; i < 2; i++) {
    if (!/&(?:lt|gt|amp|quot|#39|apos);/i.test(decoded)) break;
    var textarea = document.createElement("textarea");
    textarea.innerHTML = decoded;
    decoded = textarea.value;
  }

  return decoded;
}

function _sanitizeInlineHTML(valor) {
  var template = document.createElement("template");
  template.innerHTML = _decodeHTMLEntities(valor);

  function sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return _escapeHTML(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    var tag = node.tagName.toLowerCase();
    var children = Array.from(node.childNodes).map(sanitizeNode).join("");

    if (tag === "br") return "<br>";

    if (tag === "strong" || tag === "b" || tag === "em" || tag === "i") {
      return "<" + tag + ">" + children + "</" + tag + ">";
    }

    if (tag === "a") {
      var href = _safeUrl(node.getAttribute("href"));
      if (!href) return children;
      return (
        '<a href="' +
        _escapeHTML(href) +
        '" target="_blank" rel="noopener noreferrer">' +
        children +
        "</a>"
      );
    }

    return children;
  }

  return Array.from(template.content.childNodes).map(sanitizeNode).join("");
}

function _safeUrl(valor) {
  var url = String(valor || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    return new URL(url).href;
  } catch (e) {
    return "";
  }
}

function _safeArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function _toNumber(valor, fallback) {
  if (typeof valor === "string") {
    var normalizado = valor.trim().replace(",", ".").replace("%", "");
    var parsed = Number(normalizado);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  var numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function _tokenClasse(valor) {
  return String(valor || "indefinido")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function _labelVeredito(valor) {
  var labels = {
    confirmado: "Confirmado",
    provavelmente_confirmado: "Provavelmente confirmado",
    parcialmente_confirmado: "Parcialmente confirmado",
    inconclusivo: "Inconclusivo",
    nao_confirmado: "Não confirmado",
    provavelmente_falso: "Provavelmente falso",
    falso: "Falso",
  };
  return labels[valor] || valor || "Inconclusivo";
}

function _labelStatusClaim(valor) {
  var labels = {
    confirmada: "Confirmada",
    parcialmente_confirmada: "Parcialmente confirmada",
    inconclusiva: "Inconclusiva",
    nao_confirmada: "Não confirmada",
    contradita: "Contradita",
    erro_na_verificacao: "Erro na verificação",
  };
  return labels[valor] || valor || "Inconclusiva";
}

function _labelNivel(valor) {
  var labels = {
    alta: "Alta",
    boa: "Boa",
    moderada: "Moderada",
    baixa: "Baixa",
    muito_baixa: "Muito baixa",
  };
  return labels[valor] || valor || "-";
}

function _getBuildFinalResult(resultado, root) {
  var candidato =
    resultado?.etapa11_buildFinal ||
    resultado?.etapa10_buildFinal ||
    resultado?.buildFinal ||
    root?.etapa11_buildFinal ||
    root?.etapa10_buildFinal ||
    root?.buildFinal ||
    root?._resultado?.etapa11_buildFinal ||
    root?._resultado?.etapa10_buildFinal ||
    (resultado?.etapa === "buildFinal" ? resultado : null) ||
    (root?.etapa === "buildFinal" ? root : null);

  return candidato && candidato.etapa === "buildFinal" ? candidato : null;
}

function _buildMetaItem(label, value) {
  if (!value) return "";
  return (
    "<span class='bf-meta-item'><strong>" +
    _escapeHTML(label) +
    ":</strong> " +
    _escapeHTML(value) +
    "</span>"
  );
}

function _buildSimpleList(items, className) {
  var list = _safeArray(items)
    .filter(function (item) {
      return item;
    })
    .map(function (item) {
      return "<li>" + _escapeHTML(item) + "</li>";
    })
    .join("");

  return list ? "<ul class='" + className + "'>" + list + "</ul>" : "";
}

function _buildEvidenceHTML(evidencias) {
  return _safeArray(evidencias)
    .slice(0, 3)
    .map(function (ev) {
      var url = _safeUrl(ev.url);
      var titulo = ev.titulo || ev.fonte || url || "Fonte";
      var tituloHTML = url
        ? "<a class='bf-source-link' href='" +
          _escapeHTML(url) +
          "' data-preview-title='" +
          _escapeHTML(titulo) +
          "' target='_blank' rel='noopener noreferrer'>" +
          _escapeHTML(titulo) +
          "</a>"
        : "<strong>" + _escapeHTML(titulo) + "</strong>";

      return (
        "<li>" +
        tituloHTML +
        (ev.relacaoComClaim
          ? "<span class='bf-evidence-role'>" +
            _escapeHTML(ev.relacaoComClaim) +
            "</span>"
          : "") +
        (ev.resumoEvidencia
          ? "<p>" + _escapeHTML(ev.resumoEvidencia) + "</p>"
          : "") +
        "</li>"
      );
    })
    .join("");
}

function _buildFinalClaimsHTML(claims) {
  return _safeArray(claims)
    .map(function (claim) {
      var status = claim.statusNormalizado || claim.statusOriginal || "";
      var statusClass = _tokenClasse(status);
      var evidenciasHTML = _buildEvidenceHTML(claim.evidencias);

      return (
        "<article class='bf-claim'>" +
        "<div class='bf-claim-top'>" +
        "<span class='bf-claim-id'>Claim " +
        _escapeHTML(claim.id || "-") +
        "</span>" +
        "<span class='bf-claim-status bf-claim-status-" +
        statusClass +
        "'>" +
        _escapeHTML(_labelStatusClaim(status)) +
        "</span>" +
        "</div>" +
        "<p class='bf-claim-text'>" +
        _escapeHTML(claim.textoFinal || claim.textoOriginal || "") +
        "</p>" +
        (claim.explicacao
          ? "<p class='bf-claim-explanation'>" +
            _escapeHTML(claim.explicacao) +
            "</p>"
          : "") +
        (evidenciasHTML
          ? "<div class='bf-claim-evidence'><span>Evidências</span><ul>" +
            evidenciasHTML +
            "</ul></div>"
          : "") +
        "</article>"
      );
    })
    .join("");
}

function _buildFinalSourcesHTML(fontes) {
  return _safeArray(fontes)
    .slice(0, 6)
    .map(function (fonte) {
      var url = _safeUrl(fonte.url);
      var titulo = fonte.titulo || fonte.fonte || url || "Fonte";
      var tituloHTML = url
        ? "<a href='" +
          _escapeHTML(url) +
          "' data-preview-title='" +
          _escapeHTML(titulo) +
          "' target='_blank' rel='noopener noreferrer'>" +
          _escapeHTML(titulo) +
          "</a>"
        : "<strong>" + _escapeHTML(titulo) + "</strong>";

      return (
        "<article class='bf-source'>" +
        "<div class='bf-source-title'>" +
        tituloHTML +
        "</div>" +
        "<div class='bf-source-meta'>" +
        _escapeHTML(fonte.tipoFonte || "outra") +
        (fonte.relevancia ? " · " + _escapeHTML(fonte.relevancia) : "") +
        "</div>" +
        (fonte.papelNaVerificacao
          ? "<p>" + _escapeHTML(fonte.papelNaVerificacao) + "</p>"
          : "") +
        (fonte.resumo ? "<p>" + _escapeHTML(fonte.resumo) + "</p>" : "") +
        "</article>"
      );
    })
    .join("");
}

function _buildFinalAlertsHTML(alertas) {
  return _safeArray(alertas)
    .map(function (alerta) {
      return (
        "<li class='bf-alert bf-alert-" +
        _tokenClasse(alerta.gravidade || "media") +
        "'>" +
        "<strong>" +
        _escapeHTML(alerta.gravidade || "media") +
        "</strong>" +
        "<span>" +
        _escapeHTML(alerta.mensagem || alerta.tipo || "") +
        "</span>" +
        (alerta.impacto ? "<em>" + _escapeHTML(alerta.impacto) + "</em>" : "") +
        "</li>"
      );
    })
    .join("");
}

function _buildBuildFinalHTML(buildFinal, payload) {
  var score = Math.max(
    0,
    Math.min(100, _toNumber(buildFinal.scoreConfiabilidade, 0)),
  );
  var veredito = buildFinal.vereditoGeral || "inconclusivo";
  var nivel = buildFinal.nivelConfiabilidade || "";
  var titulo =
    buildFinal.tituloFinal || payload?.title || payload?.url || "Resultado";
  var metaHTML =
    _buildMetaItem("Fonte", buildFinal.veiculo || payload?.siteName) +
    _buildMetaItem(
      "Publicado",
      buildFinal.dataPublicacao
        ? _formatarData(buildFinal.dataPublicacao)
        : payload?.publishDate
          ? _formatarData(payload.publishDate)
          : "",
    ) +
    _buildMetaItem("Tipo", buildFinal.tipoConteudo || payload?.pageType);
  var claimsHTML = _buildFinalClaimsHTML(buildFinal.claimsAnalisadas);
  var fontesHTML = _buildFinalSourcesHTML(buildFinal.fontesPrincipais);
  var alertasHTML = _buildFinalAlertsHTML(buildFinal.alertasGerais);
  var pontosHTML = _buildSimpleList(buildFinal.pontosImportantes, "bf-list");
  var confirmadosHTML = _buildSimpleList(
    buildFinal.oQueFoiConfirmado,
    "bf-list bf-list-confirmed",
  );
  var inconclusivosHTML = _buildSimpleList(
    buildFinal.oQueFicouInconclusivo,
    "bf-list bf-list-unknown",
  );
  var contraditosHTML = _buildSimpleList(
    buildFinal.oQueFoiContradito,
    "bf-list bf-list-disputed",
  );

  return (
    "<section class='build-final-result'>" +
    "<header class='bf-header'>" +
    "<span class='bf-eyebrow'>Resultado final do VerusIA</span>" +
    "<h2>" +
    _escapeHTML(titulo) +
    "</h2>" +
    (metaHTML ? "<div class='bf-meta'>" + metaHTML + "</div>" : "") +
    "</header>" +
    "<section class='bf-verdict bf-verdict-" +
    _tokenClasse(veredito) +
    "'>" +
    "<div>" +
    "<span class='bf-label'>Veredito geral</span>" +
    "<strong>" +
    _escapeHTML(_labelVeredito(veredito)) +
    "</strong>" +
    "</div>" +
    "<div class='bf-score' style='--bf-score:" +
    score +
    "%'>" +
    "<span>" +
    score +
    "%</span>" +
    "<small>" +
    _escapeHTML(_labelNivel(nivel)) +
    "</small>" +
    "</div>" +
    "</section>" +
    (buildFinal.mensagemPrincipalUsuario
      ? "<p class='bf-main-message'>" +
        _sanitizeInlineHTML(buildFinal.mensagemPrincipalUsuario) +
        "</p>"
      : "") +
    (buildFinal.resumoCurto
      ? "<section class='bf-section'><h3>Resumo</h3><p>" +
        _escapeHTML(buildFinal.resumoCurto) +
        "</p></section>"
      : "") +
    (buildFinal.resumoDetalhado
      ? "<section class='bf-section'><h3>Detalhes da análise</h3><p>" +
        _escapeHTML(buildFinal.resumoDetalhado) +
        "</p></section>"
      : "") +
    (pontosHTML
      ? "<section class='bf-section'><h3>Pontos importantes</h3>" +
        pontosHTML +
        "</section>"
      : "") +
    (confirmadosHTML || inconclusivosHTML || contraditosHTML
      ? "<section class='bf-section bf-findings'><h3>O que a análise encontrou</h3>" +
        (confirmadosHTML
          ? "<div><strong>Confirmado</strong>" + confirmadosHTML + "</div>"
          : "") +
        (inconclusivosHTML
          ? "<div><strong>Inconclusivo</strong>" + inconclusivosHTML + "</div>"
          : "") +
        (contraditosHTML
          ? "<div><strong>Contradito</strong>" + contraditosHTML + "</div>"
          : "") +
        "</section>"
      : "") +
    (claimsHTML
      ? "<section class='bf-section bf-claims'><h3>Afirmações analisadas</h3>" +
        claimsHTML +
        "</section>"
      : "") +
    (fontesHTML
      ? "<section class='bf-section bf-sources'><h3>Fontes principais</h3>" +
        fontesHTML +
        "</section>"
      : "") +
    (alertasHTML
      ? "<section class='bf-section bf-alerts'><h3>Alertas</h3><ul>" +
        alertasHTML +
        "</ul></section>"
      : "") +
    (buildFinal.textoFinalSemHtml
      ? "<section class='bf-section'><h3>Conclusão</h3><p>" +
        _escapeHTML(buildFinal.textoFinalSemHtml) +
        "</p></section>"
      : "") +
    "</section>"
  );
}

function _renderBuildFinal(chatMensagens, buildFinal, payload) {
  var msgIA = document.createElement("div");
  msgIA.className = "mensagemIAPrimeira build-final-message";
  msgIA.innerHTML = _buildBuildFinalHTML(buildFinal, payload || {});
  chatMensagens.appendChild(msgIA);
  chatMensagens.scrollTop = 0;
}

function _renderFinalNotice(chatMensagens, titulo, mensagem, detalhes) {
  var detalhesHTML = _safeArray(detalhes)
    .filter(function (item) {
      return item && item.value;
    })
    .map(function (item) {
      return (
        "<div class='claim-item'><p class='claim-text'><strong>" +
        _escapeHTML(item.label) +
        ":</strong> " +
        _escapeHTML(item.value) +
        "</p></div>"
      );
    })
    .join("");

  var msgIA = document.createElement("div");
  msgIA.className = "mensagemIAPrimeira";
  msgIA.innerHTML =
    '<p class="result">' +
    _escapeHTML(titulo) +
    "</p>" +
    '<p id="textAnalysis">' +
    _escapeHTML(mensagem) +
    "</p>" +
    (detalhesHTML ? '<div id="claimsSection">' + detalhesHTML + "</div>" : "");
  chatMensagens.appendChild(msgIA);
  chatMensagens.scrollTop = chatMensagens.scrollHeight;
}

function _renderAnalysis(shadow, open, analysis, chatMensagens) {
  // Payload bruto do extrator (sem summary/claims)
  if (!analysis.summary && !analysis.claims) {
    if (analysis.aviso) {
      var msgAviso = document.createElement("div");
      msgAviso.className = "mensagemIAPrimeira";
      msgAviso.innerHTML =
        '<p class="result">⚠️ Aviso</p><p id="textAnalysis">' +
        analysis.aviso +
        "</p>";
      chatMensagens.appendChild(msgAviso);
      chatMensagens.scrollTop = chatMensagens.scrollHeight;
      return;
    }

    // Resultado do pipeline do servidor
    // Resultado do pipeline do servidor
    var root = analysis?.data || analysis?.resultado || analysis || {};

    var resultado =
      root?._resultado ||
      root?.resultado ||
      root?.pipeline ||
      (root?.etapa === "classifyPage" ? root : null) ||
      (root?.classificacao ? root : null);

    var payload =
      root?._payload ||
      root?.payload ||
      analysis?._payload ||
      analysis?.payload ||
      root ||
      {};

    var buildFinal = _getBuildFinalResult(resultado, root);
    if (buildFinal) {
      console.log("[sidebar] buildFinal recebido:", buildFinal);
      _renderBuildFinal(chatMensagens, buildFinal, payload);
      return;
    }

    if (resultado && resultado.erro) {
      _renderFinalNotice(chatMensagens, "Resultado da IA", "A analise nao foi concluida pelo servidor.", [
        { label: "Erro", value: resultado.erro },
      ]);
      return;
    }

    if (root && root.erro) {
      _renderFinalNotice(chatMensagens, "Resultado da IA", "A analise nao foi concluida pelo servidor.", [
        { label: "Erro", value: root.erro },
      ]);
      return;
    }

    if (resultado && resultado.etapa === "classifyPage") {
      var cFinal = resultado.classificacao || {};
      var confiancaFinal = cFinal.confianca
        ? Math.round(cFinal.confianca * 100) + "%"
        : "";
      _renderFinalNotice(
        chatMensagens,
        "Resultado da IA",
        resultado.mensagem || "A IA terminou a classificacao da pagina.",
        [
          { label: "Status", value: resultado.status },
          { label: "Tipo", value: cFinal.tipo || resultado.tipo },
          {
            label: "Categoria",
            value:
              cFinal.categoriatextoprincipal ||
              resultado.categoriatextoprincipal,
          },
          {
            label: "Motivo",
            value:
              cFinal.motivoclassificacao ||
              cFinal.motivoClassificacao ||
              resultado.motivonaosernoticia,
          },
          { label: "Confianca", value: confiancaFinal },
        ],
      );
      return;
    }

    if (resultado) {
      _renderFinalNotice(
        chatMensagens,
        "Resultado final indisponivel",
        "A IA terminou, mas o servidor nao retornou o bloco final buildFinal.",
        [
          { label: "Status", value: resultado.status },
          {
            label: "Claims encontradas",
            value:
              resultado.etapa2_claims &&
              resultado.etapa2_claims.total !== undefined
                ? String(resultado.etapa2_claims.total)
                : "",
          },
        ],
      );
      return;
    }

    _renderFinalNotice(
      chatMensagens,
      "Resultado final indisponivel",
      "A IA terminou, mas nenhum resultado final foi retornado pelo servidor.",
      [],
    );
    return;

    var classificacao = resultado?.classificacao || root?.classificacao || {};

    var textoLimpoServidor =
      root?.textoLimpo ||
      root?.textoNoticia ||
      resultado?.textoLimpo ||
      resultado?.textoNoticia ||
      classificacao?.textoLimpo ||
      classificacao?.textoUtilCompleto ||
      "";

    console.log("[sidebar] analysis recebido:", analysis);
    console.log("[sidebar] root:", root);
    console.log("[sidebar] resultado:", resultado);
    console.log("[sidebar] classificacao:", classificacao);
    console.log(
      "[sidebar] textoLimpoServidor:",
      textoLimpoServidor?.slice(0, 500),
    );
    var statusServidor = "";
    if (resultado && resultado.erro) {
      statusServidor =
        "<div class='pipeline-status pipeline-status-error'>❌ Erro no servidor: " +
        resultado.erro +
        "</div>";
    } else if (resultado && resultado.etapa === "classifyPage") {
      var c = resultado.classificacao || {};
      var statusClass =
        resultado.status === "ignorado"
          ? "pipeline-status-warn"
          : "pipeline-status-ok";
      var icone = resultado.status === "ignorado" ? "⚠️" : "✅";
      statusServidor =
        "<div class='pipeline-status " +
        statusClass +
        "'>" +
        icone +
        " Pipeline: <strong>" +
        resultado.status +
        "</strong> &nbsp;|&nbsp; Tipo: <strong>" +
        (c.tipo || "-") +
        "</strong> &nbsp;|&nbsp; Confiança: <strong>" +
        (c.confianca ? Math.round(c.confianca * 100) + "%" : "-") +
        "</strong>" +
        (c.motivoClassificacao
          ? "<br/><span class='pipeline-status-detail'>" +
            c.motivoClassificacao +
            "</span>"
          : "") +
        "</div>";
    } else if (resultado) {
      statusServidor =
        "<div class='pipeline-status pipeline-status-ok'>✅ Pipeline concluído com sucesso.</div>";
    } else {
      statusServidor =
        "<div class='pipeline-status pipeline-status-muted'>⚠️ Servidor não respondeu. Verifique se está rodando.</div>";
    }
    var campos = [
      { label: "URL", value: payload.url },
      { label: "Título", value: payload.title },
      { label: "Descrição", value: payload.description },
      { label: "Site", value: payload.siteName },
      { label: "Autor", value: payload.author },
      { label: "Legenda", value: payload.caption || null },
      {
        label: "Data de publicação",
        value: payload.publishDate ? _formatarData(payload.publishDate) : null,
      },
      { label: "Idioma", value: payload.language },
      { label: "Tipo de página", value: payload.pageType },
      { label: "Transcrição", value: payload.transcript || null },

      { label: "Texto limpo pela IA", value: textoLimpoServidor || null },

      {
        label: "Texto capturado",
        value: payload.transcript ? null : payload.text || null,
      },
      {
        label: "Tamanho do texto",
        value: payload.textLength ? payload.textLength + " caracteres" : null,
      },
      { label: "Domínio", value: payload.domain || null },
      {
        label: "Títulos encontrados",
        value:
          payload.headings && payload.headings.length
            ? payload.headings.join(" · ")
            : null,
      },
      {
        label: "Links encontrados",
        value:
          payload.links && payload.links.length
            ? payload.links.length + " links"
            : null,
      },
    ];

    var camposHTML = campos
      .filter(function (c) {
        return c.value;
      })
      .map(function (c) {
        return (
          "<div class='claim-item'><p class='claim-text'><strong>" +
          c.label +
          ":</strong> " +
          c.value +
          "</p></div>"
        );
      })
      .join("");

    var msgIA = document.createElement("div");
    msgIA.className = "mensagemIAPrimeira";
    msgIA.innerHTML =
      statusServidor +
      '<p class="result">Dados Extraídos da Página</p>' +
      '<div id="claimsSection">' +
      camposHTML +
      "</div>";
    chatMensagens.appendChild(msgIA);
    chatMensagens.scrollTop = chatMensagens.scrollHeight;
    return;
  }
  var root = analysis?.data || analysis?.resultado || analysis || {};
  var textoLimpoServidor =
    root?.textoLimpo ||
    root?.textoNoticia ||
    root?._resultado?.textoLimpo ||
    root?._resultado?.textoNoticia ||
    root?.classificacao?.textoLimpo ||
    root?._resultado?.classificacao?.textoLimpo ||
    "";

  var sourceHTML = analysis.source ? _buildSourceHTML(analysis.source) : "";
  var claimsHTML =
    analysis.claims && analysis.claims.length > 0
      ? _buildClaimsHTML(analysis.claims)
      : "";
  var linksHTML = _buildLinksHTML(analysis);

  var msgIA = document.createElement("div");
  msgIA.className = "mensagemIAPrimeira";
  msgIA.innerHTML =
    '<p class="result">Resultado da Verificação</p>' +
    '<p id="textAnalysis">' +
    (analysis.summary || "Análise concluída.") +
    "</p>" +
    (textoLimpoServidor
      ? "<div class='claim-item'><p class='claim-text'><strong>Texto limpo pela IA:</strong> " +
        textoLimpoServidor +
        "</p></div>"
      : "") +
    sourceHTML +
    chatMensagens.appendChild(msgIA);
  chatMensagens.scrollTop = chatMensagens.scrollHeight;
}

function _buildSourceHTML(s) {
  var credColors = {
    alta: "#1a7a3c",
    média: "#b07800",
    baixa: "#d3392d",
    desconhecida: "#6f6f68",
  };
  var credColor = credColors[s.credibility] || "#6f6f68";
  var typeLabels = {
    news_outlet: "Veículo jornalístico",
    influencer: "Influenciador",
    official: "Canal oficial",
    unknown: "Canal desconhecido",
  };
  var typeLabel = typeLabels[s.channelType] || "";
  var exclusiveNote =
    s.isExclusive && s.exclusivityNote
      ? "<p class='source-exclusive'>⚠️ " + s.exclusivityNote + "</p>"
      : "";
  var officialLink = s.officialArticleUrl
    ? "<a href='" +
      s.officialArticleUrl +
      "' target='_blank' class='source-link'>🔗 Ver matéria no site oficial</a>"
    : "";
  var channelLink = s.sourceUrl
    ? "<a href='" +
      s.sourceUrl +
      "' target='_blank' class='source-link'>" +
      (s.channelName || s.sourceHandle || siteNameFromUrl(s.sourceUrl)) +
      "</a>"
    : "<strong>" + (s.channelName || s.sourceHandle || "") + "</strong>";
  return (
    "<div class='source-card'>" +
    "<div class='source-card-header'>" +
    channelLink +
    " <span class='source-type-label'>" +
    typeLabel +
    "</span> <span style='color:" +
    credColor +
    ";font-weight:700'>" +
    s.credibility +
    "</span></div>" +
    (s.channelSummary
      ? "<p class='source-card-summary'>" + s.channelSummary + "</p>"
      : "") +
    exclusiveNote +
    officialLink +
    "</div>"
  );
}

function _buildClaimsHTML(claims) {
  var verdictLabels = {
    supported: "✅ Confirmada",
    disputed: "❌ Contestada",
    mixed: "⚠️ Divergente",
    insufficient_evidence: "🔍 Inconclusivo",
    not_checkable: "— Não verificável",
  };
  return claims
    .map(function (c) {
      var verdictLabel = verdictLabels[c.verdict] || c.verdict;
      var sourcesHTML =
        c.sources && c.sources.length > 0
          ? c.sources
              .map(function (s) {
                return (
                  "<div class='source-item'><a href='" +
                  s.url +
                  "' target='_blank' class='source-link'>" +
                  siteNameFromUrl(s.url) +
                  "</a>" +
                  (s.snippet
                    ? "<span class='source-snippet'>" + s.snippet + "</span>"
                    : "") +
                  "</div>"
                );
              })
              .join("")
          : "";
      var reasonHTML =
        (c.verdict === "disputed" || c.verdict === "mixed") && c.summary
          ? "<p class='claim-reason'>" + c.summary + "</p>"
          : "";
      var checkedAtHTML = "";
      if (c.checkedAt) {
        try {
          var d = new Date(c.checkedAt);
          var dataStr = d.toLocaleDateString("pt-BR");
          var horaStr = d.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          checkedAtHTML =
            "<span class='claim-checked-at'>Verificado em " +
            dataStr +
            " às " +
            horaStr +
            "</span>";
        } catch (e) {
          console.warn("[sidebar] Erro ao formatar checkedAt:", c.checkedAt, e);
        }
      } else {
        console.log("[sidebar] Claim sem checkedAt:", c.text?.slice(0, 50));
      }
      return (
        "<div class='claim-item'>" +
        "<p class='claim-text'>" +
        c.text +
        "</p>" +
        "<span class='claim-verdict'>" +
        verdictLabel +
        "</span>" +
        reasonHTML +
        (sourcesHTML
          ? "<div class='claim-sources'>" + sourcesHTML + "</div>"
          : "") +
        checkedAtHTML +
        "</div>"
      );
    })
    .join("");
}

function _buildLinksHTML(analysis) {
  var todasFontes = (analysis.claims || []).reduce(function (acc, c) {
    return acc.concat(c.sources || []);
  }, []);
  var fontesUnicas = [];
  var seenDominios = new Set();

  function adicionarFonte(url) {
    if (!url) return;
    try {
      var dominio = new URL(url).hostname.replace(/^www\./, "");
      if (seenDominios.has(dominio)) return;
      seenDominios.add(dominio);
      fontesUnicas.push({ title: siteNameFromUrl(url), url: url });
    } catch (e) {}
  }

  todasFontes.forEach(function (f) {
    adicionarFonte(f.url);
  });
  (analysis.links || []).forEach(function (l) {
    adicionarFonte(l.url);
  });
  if (fontesUnicas.length < 3) adicionarFonte(window.location.href);

  return fontesUnicas.length > 0
    ? fontesUnicas
        .map(function (f) {
          return (
            "<a href='" +
            f.url +
            "' target='_blank' class='footer-source-link'>" +
            f.title +
            "</a>"
          );
        })
        .join("")
    : "";
}
