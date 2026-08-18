// features/claim-highlight.js
// Destaque de claims direto na pagina (estilo Grammarli anti-fake).
// Sublinha cada afirmacao verificada com cor por status e mostra um tooltip
// com a explicacao e as evidencias. Exposto como window.VerusClaimHighlight.

(function () {
  if (window.VerusClaimHighlight) return;

  var MARK_TAG = "verus-claim";
  var STYLE_ID = "verus_claim_style";
  var TIP_ID = "verus_claim_tip";
  var LEGENDA_ID = "verus_claim_legenda";
  var EXCLUIR_IDS = [
    "sidebar_id",
    "sidebar_overlay",
    "btn_wrapper",
    "verus_progress_popup",
    TIP_ID,
    LEGENDA_ID,
  ];
  var TAGS_IGNORADAS = {
    SCRIPT: 1,
    STYLE: 1,
    NOSCRIPT: 1,
    TEXTAREA: 1,
    INPUT: 1,
    SELECT: 1,
    OPTION: 1,
    SVG: 1,
    CODE: 1,
    "VERUS-CLAIM": 1,
  };

  var STATUS = {
    confirmada: { cor: "#1a7a3c", rotulo: "Confirmada", icone: "✓" },
    parcialmente_confirmada: {
      cor: "#5a9216",
      rotulo: "Parcialmente confirmada",
      icone: "≈",
    },
    inconclusiva: { cor: "#c79100", rotulo: "Inconclusiva", icone: "?" },
    nao_confirmada: { cor: "#e0691f", rotulo: "Não confirmada", icone: "!" },
    contradita: { cor: "#d3392d", rotulo: "Contradita", icone: "✕" },
    erro_na_verificacao: {
      cor: "#6f6f68",
      rotulo: "Erro na verificação",
      icone: "—",
    },
  };

  var STOPWORDS = {
    a: 1, o: 1, e: 1, de: 1, da: 1, do: 1, das: 1, dos: 1, que: 1, em: 1,
    no: 1, na: 1, nos: 1, nas: 1, um: 1, uma: 1, para: 1, por: 1, com: 1,
    se: 1, ao: 1, aos: 1, as: 1, os: 1, ou: 1, mais: 1, foi: 1, ser: 1,
    sua: 1, seu: 1, sobre: 1, entre: 1, como: 1, pelo: 1, pela: 1,
  };

  var VEREDITO = {
    true: { cor: "#1a7a3c", rotulo: "Verdadeiro", icone: "✓" },
    false: { cor: "#d3392d", rotulo: "Falso", icone: "✕" },
    mixed: { cor: "#c79100", rotulo: "Parcial / Misto", icone: "!" },
  };

  var _marcas = [];
  var _claimsData = [];
  var _contagensClaims = {};
  var _fontesData = [];
  var _fontesEls = [];
  var _tipHideTimer = null;
  var _scrollHandler = null;
  var _eventosLigados = false;
  var _autoTentado = false;

  function _vereditoInfo(valor) {
    return VEREDITO[String(valor || "").toLowerCase()] || VEREDITO.mixed;
  }

  function _siteVerus() {
    return typeof VERUS_SITE_URL !== "undefined"
      ? VERUS_SITE_URL
      : "http://localhost:3000/site";
  }

  function _baseApi() {
    return typeof API_BASE !== "undefined" ? API_BASE : "http://localhost:3000";
  }

  function _normalizarUrlComparavel(valor) {
    try {
      var u = new URL(String(valor || "").trim(), location.href);
      if (!/^https?:$/i.test(u.protocol)) return "";
      u.hash = "";
      var s = (
        u.protocol +
        "//" +
        u.hostname.replace(/^www\./i, "") +
        u.pathname +
        u.search
      ).toLowerCase();
      return s.replace(/\/$/, "");
    } catch (e) {
      return "";
    }
  }

  // ── helpers de texto ──────────────────────────────────────────────────────
  function _escape(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function _tokenStatus(valor) {
    return String(valor || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  }

  function _statusInfo(valor) {
    return STATUS[_tokenStatus(valor)] || STATUS.inconclusiva;
  }

  function _hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  // Normaliza preservando um mapa normalizado->original (para recuperar offsets).
  function _normalizarComMapa(texto) {
    var out = "";
    var mapa = [];
    var prevSpace = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (/\s/.test(ch)) {
        if (prevSpace) continue;
        out += " ";
        mapa.push(i);
        prevSpace = true;
        continue;
      }
      prevSpace = false;
      var dec = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (!dec) continue;
      for (var k = 0; k < dec.length; k++) {
        out += dec[k];
        mapa.push(i);
      }
    }
    return { texto: out, mapa: mapa };
  }

  function _normalizar(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function _tokens(textoNormalizado) {
    var brutos = textoNormalizado.split(/[^a-z0-9]+/);
    var set = {};
    var lista = [];
    for (var i = 0; i < brutos.length; i++) {
      var t = brutos[i];
      if (t.length <= 2 || STOPWORDS[t] || /^\d+$/.test(t)) continue;
      if (!set[t]) {
        set[t] = 1;
        lista.push(t);
      }
    }
    return lista;
  }

  // ── deteccao da raiz de conteudo (mesmos seletores do extractor) ──────────
  function _raizConteudo() {
    var seletores = [
      "article",
      "[role='main']",
      "main",
      ".article-body",
      ".post-content",
      ".entry-content",
      ".content-body",
      ".materia-conteudo",
      "#article-body",
      "#content",
    ];
    for (var i = 0; i < seletores.length; i++) {
      var el = document.querySelector(seletores[i]);
      if (el && (el.innerText || "").trim().length > 200) return el;
    }
    return document.body;
  }

  function _nodeIgnorado(node) {
    var el = node.parentElement;
    if (!el) return true;
    if (TAGS_IGNORADAS[el.tagName]) return true;
    for (var i = 0; i < EXCLUIR_IDS.length; i++) {
      if (el.closest && el.closest("#" + EXCLUIR_IDS[i])) return true;
    }
    if (el.closest && el.closest(MARK_TAG)) return true;
    if (!el.offsetParent && el.tagName !== "BODY") {
      var estilo = window.getComputedStyle(el);
      if (estilo.position !== "fixed") return true;
    }
    return false;
  }

  function _coletarTextNodes(raiz) {
    var walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.trim().length < 12) {
          return NodeFilter.FILTER_REJECT;
        }
        if (_nodeIgnorado(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var nodes = [];
    var atual;
    while ((atual = walker.nextNode())) {
      var norm = _normalizarComMapa(atual.nodeValue);
      nodes.push({
        node: atual,
        normTexto: norm.texto,
        mapa: norm.mapa,
        frases: _fatiarFrases(norm.texto),
      });
    }
    return nodes;
  }

  // Divide o texto normalizado em frases preservando os indices de inicio.
  function _fatiarFrases(normTexto) {
    var frases = [];
    var re = /[^.!?]+[.!?]*/g;
    var m;
    while ((m = re.exec(normTexto))) {
      var inicio = m.index;
      var bruto = m[0];
      var ini = inicio;
      var fim = inicio + bruto.length;
      // remove espacos das bordas ajustando os indices
      while (ini < fim && normTexto[ini] === " ") ini++;
      while (fim > ini && normTexto[fim - 1] === " ") fim--;
      if (fim - ini >= 8) {
        frases.push({ inicio: ini, fim: fim, texto: normTexto.slice(ini, fim) });
      }
    }
    if (!frases.length && normTexto.trim().length >= 8) {
      frases.push({ inicio: 0, fim: normTexto.length, texto: normTexto });
    }
    return frases;
  }

  // ── matching ──────────────────────────────────────────────────────────────
  function _melhorMatchClaim(claim, nodes) {
    var alvo = _normalizar(claim.textoOriginal || claim.textoFinal || "");
    if (alvo.length < 8) return null;
    var alvoTokens = _tokens(alvo);
    if (!alvoTokens.length) return null;
    var alvoSet = {};
    alvoTokens.forEach(function (t) {
      alvoSet[t] = 1;
    });

    var melhor = null;

    for (var n = 0; n < nodes.length; n++) {
      var info = nodes[n];

      // 1) match exato normalizado (claim verbatim na pagina)
      var idx = info.normTexto.indexOf(alvo);
      if (idx !== -1) {
        var ini = info.mapa[idx];
        var fim = info.mapa[idx + alvo.length - 1] + 1;
        return { node: info.node, start: ini, fim: fim, score: 1 };
      }

      // 2) fuzzy por frase (claim parafraseada)
      for (var f = 0; f < info.frases.length; f++) {
        var frase = info.frases[f];
        var fraseTokens = _tokens(frase.texto);
        if (!fraseTokens.length) continue;
        var inter = 0;
        for (var t = 0; t < fraseTokens.length; t++) {
          if (alvoSet[fraseTokens[t]]) inter++;
        }
        var cobertura = inter / alvoTokens.length;
        var precisao = inter / fraseTokens.length;
        var score = cobertura * 0.7 + precisao * 0.3;
        if (cobertura >= 0.6 && score > (melhor ? melhor.score : 0.5)) {
          melhor = {
            node: info.node,
            start: info.mapa[frase.inicio],
            fim: info.mapa[frase.fim - 1] + 1,
            score: score,
          };
        }
      }
    }

    return melhor;
  }

  // ── aplicacao das marcas ──────────────────────────────────────────────────
  function _aplicarMarca(node, match, claimIdx, info) {
    try {
      var range = document.createRange();
      range.setStart(node, match.start);
      range.setEnd(node, match.fim);
      var mark = document.createElement(MARK_TAG);
      mark.setAttribute("data-verus-idx", String(claimIdx));
      mark.setAttribute("tabindex", "0");
      mark.style.setProperty("--vc-color", info.cor);
      mark.style.setProperty("--vc-bg", _hexToRgba(info.cor, 0.1));
      mark.style.setProperty("--vc-bg-strong", _hexToRgba(info.cor, 0.22));
      range.surroundContents(mark);
      _marcas.push(mark);
      return true;
    } catch (e) {
      return false;
    }
  }

  function _injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      MARK_TAG +
      "{text-decoration:underline!important;text-decoration-style:wavy!important;" +
      "text-decoration-color:var(--vc-color)!important;text-decoration-thickness:2px!important;" +
      "text-underline-offset:3px!important;background:var(--vc-bg)!important;" +
      "border-radius:2px!important;cursor:help!important;color:inherit!important;" +
      "transition:background .15s ease!important;}" +
      MARK_TAG +
      ":hover," +
      MARK_TAG +
      ":focus{background:var(--vc-bg-strong)!important;outline:none!important;}" +
      "html[data-verus-claims='off'] " +
      MARK_TAG +
      "{text-decoration:none!important;background:none!important;cursor:auto!important;}" +
      // Links de noticias ja analisadas pelo VerusAI
      "a[data-verus-fonte]{text-decoration:underline!important;" +
      "text-decoration-color:var(--vf-color)!important;text-decoration-thickness:2px!important;" +
      "text-underline-offset:2px!important;}" +
      "a[data-verus-fonte]::after{content:'✓';display:inline-block;margin-left:3px;" +
      "font-family:'Space Mono','Courier New',monospace;font-size:.62em;font-weight:700;" +
      "color:#fff;background:var(--vf-color);border-radius:3px;padding:0 4px;" +
      "vertical-align:baseline;line-height:1.5;letter-spacing:.02em;}" +
      "html[data-verus-claims='off'] a[data-verus-fonte]{text-decoration:none!important;}" +
      "html[data-verus-claims='off'] a[data-verus-fonte]::after{display:none!important;}";
    document.head.appendChild(style);
  }

  // ── tooltip ────────────────────────────────────────────────────────────────
  function _criarTooltip() {
    var host = document.getElementById(TIP_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = TIP_ID;
    host.style.cssText =
      "position:fixed;z-index:2147483647;top:0;left:0;max-width:360px;" +
      "display:none;";
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent =
      ":host{all:initial;}" +
      ".tip{font-family:'Space Mono','Segoe UI',sans-serif;background:#f9f4eb;" +
      "color:#171715;border:2px solid #171715;border-radius:6px;" +
      "box-shadow:4px 4px 0 rgba(23,23,21,.16),0 14px 32px rgba(23,23,21,.26);" +
      "padding:12px 14px;max-width:360px;font-size:13px;line-height:1.5;}" +
      ".tip-status{display:inline-flex;align-items:center;gap:6px;font-weight:700;" +
      "font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#fff;" +
      "padding:3px 9px;border-radius:3px;margin-bottom:8px;}" +
      ".tip-claim{font-style:italic;color:#3a3a36;margin:0 0 8px;}" +
      ".tip-exp{margin:0 0 8px;}" +
      ".tip-ev-title{font-size:10px;font-weight:700;letter-spacing:.08em;" +
      "text-transform:uppercase;color:#6b6b66;margin:8px 0 4px;}" +
      ".tip-ev{margin:0;padding:0;list-style:none;}" +
      ".tip-ev li{margin-bottom:5px;}" +
      ".tip-ev a{color:#02519b;text-decoration:underline;word-break:break-word;}" +
      ".tip-ev span{display:block;color:#3a3a36;font-size:11px;}";
    shadow.appendChild(style);
    var box = document.createElement("div");
    box.className = "tip";
    shadow.appendChild(box);
    host._box = box;

    host.addEventListener("mouseenter", function () {
      clearTimeout(_tipHideTimer);
    });
    host.addEventListener("mouseleave", _agendarOcultar);

    document.body.appendChild(host);
    return host;
  }

  function _conteudoTooltip(claim) {
    var info = _statusInfo(claim.statusNormalizado || claim.statusOriginal);
    var texto = claim.textoFinal || claim.textoOriginal || "";
    var html =
      "<span class='tip-status' style='background:" +
      info.cor +
      "'>" +
      info.icone +
      " " +
      _escape(info.rotulo) +
      "</span>";
    if (texto) html += "<p class='tip-claim'>“" + _escape(texto) + "”</p>";
    if (claim.explicacao)
      html += "<p class='tip-exp'>" + _escape(claim.explicacao) + "</p>";

    var evidencias = Array.isArray(claim.evidencias) ? claim.evidencias : [];
    var evHTML = "";
    for (var i = 0; i < evidencias.length && i < 2; i++) {
      var ev = evidencias[i];
      var url = _safeUrl(ev.url);
      var titulo = ev.titulo || ev.fonte || url || "Fonte";
      var linha = url
        ? "<a href='" +
          _escape(url) +
          "' target='_blank' rel='noopener noreferrer'>" +
          _escape(titulo) +
          "</a>"
        : "<strong>" + _escape(titulo) + "</strong>";
      if (ev.resumoEvidencia)
        linha += "<span>" + _escape(ev.resumoEvidencia) + "</span>";
      evHTML += "<li>" + linha + "</li>";
    }
    if (evHTML)
      html +=
        "<p class='tip-ev-title'>Evidências</p><ul class='tip-ev'>" +
        evHTML +
        "</ul>";

    return html;
  }

  function _conteudoTooltipFonte(fonte) {
    var info = fonte.info || _vereditoInfo(fonte.veredito);
    var html =
      "<span class='tip-status' style='background:" +
      info.cor +
      "'>" +
      info.icone +
      " " +
      _escape(info.rotulo) +
      "</span>";
    html +=
      "<p class='tip-exp'>Esta notícia já foi verificada pelo VerusAI.</p>";
    if (fonte.titulo)
      html += "<p class='tip-claim'>“" + _escape(fonte.titulo) + "”</p>";
    if (fonte.score !== null && fonte.score !== "" && fonte.score !== undefined)
      html +=
        "<p class='tip-exp'>Confiabilidade: <strong>" +
        _escape(String(fonte.score)) +
        "%</strong></p>";
    html +=
      "<p class='tip-ev-title'>VerusAI</p><ul class='tip-ev'><li><a href='" +
      _escape(_siteVerus()) +
      "' target='_blank' rel='noopener noreferrer'>Ver no painel do VerusAI →</a></li></ul>";
    return html;
  }

  function _mostrarTooltip(mark) {
    var conteudo;
    if (mark.hasAttribute("data-verus-fonte-idx")) {
      var fonte = _fontesData[parseInt(mark.getAttribute("data-verus-fonte-idx"), 10)];
      if (!fonte) return;
      conteudo = _conteudoTooltipFonte(fonte);
    } else {
      var claim = _claimsData[parseInt(mark.getAttribute("data-verus-idx"), 10)];
      if (!claim) return;
      conteudo = _conteudoTooltip(claim);
    }
    var host = _criarTooltip();
    clearTimeout(_tipHideTimer);
    host._box.innerHTML = conteudo;
    host.style.display = "block";
    host.style.visibility = "hidden";

    var rect = mark.getBoundingClientRect();
    var th = host.offsetHeight;
    var tw = host.offsetWidth;
    var margem = 8;
    var top = rect.top - th - margem;
    if (top < margem) top = rect.bottom + margem;
    var left = rect.left;
    if (left + tw > window.innerWidth - margem)
      left = window.innerWidth - tw - margem;
    if (left < margem) left = margem;

    host.style.top = Math.max(margem, top) + "px";
    host.style.left = left + "px";
    host.style.visibility = "visible";
  }

  function _agendarOcultar() {
    clearTimeout(_tipHideTimer);
    _tipHideTimer = setTimeout(function () {
      var host = document.getElementById(TIP_ID);
      if (host) host.style.display = "none";
    }, 220);
  }

  // ── legenda / controle flutuante ───────────────────────────────────────────
  function _atualizarLegenda() {
    _removerLegenda();

    var totalClaims = 0;
    Object.keys(_contagensClaims).forEach(function (k) {
      totalClaims += _contagensClaims[k];
    });
    var totalFontes = _fontesEls.length;
    if (!totalClaims && !totalFontes) return;

    var host = document.createElement("div");
    host.id = LEGENDA_ID;
    host.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "z-index:2147483646;";
    var shadow = host.attachShadow({ mode: "open" });

    var itens = "";
    Object.keys(_contagensClaims).forEach(function (tokenStatus) {
      var info = STATUS[tokenStatus] || STATUS.inconclusiva;
      itens +=
        "<span class='lg-item'><i style='background:" +
        info.cor +
        "'></i>" +
        _escape(info.rotulo) +
        " <b>" +
        _contagensClaims[tokenStatus] +
        "</b></span>";
    });
    if (totalFontes) {
      itens +=
        "<span class='lg-item lg-item-fonte'><i style='background:#02519b'></i>🔗 " +
        totalFontes +
        " fonte" +
        (totalFontes === 1 ? "" : "s") +
        " já checada" +
        (totalFontes === 1 ? "" : "s") +
        "</span>";
    }

    var total = totalClaims;
    var tituloTexto = totalClaims
      ? "✓ " + totalClaims + " afirmação" + (totalClaims === 1 ? "" : "ões")
      : "🔗 " + totalFontes + " fonte" + (totalFontes === 1 ? "" : "s");
    var oculto =
      document.documentElement.getAttribute("data-verus-claims") === "off";

    var style = document.createElement("style");
    style.textContent =
      ":host{all:initial;}" +
      ".lg{font-family:'Space Mono','Segoe UI',sans-serif;background:#171715;" +
      "color:#f4ecdf;border:2px solid #171715;border-radius:6px;" +
      "box-shadow:0 12px 32px rgba(23,23,21,.34);display:flex;align-items:center;" +
      "gap:10px;padding:8px 12px;font-size:12px;}" +
      ".lg-title{font-weight:700;letter-spacing:.04em;white-space:nowrap;}" +
      ".lg-items{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}" +
      ".lg-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:#f4ecdf;}" +
      ".lg-item i{width:11px;height:11px;border-radius:2px;display:inline-block;}" +
      ".lg-item b{color:#fff;}" +
      ".lg-sep{width:1px;height:20px;background:rgba(244,236,223,.3);}" +
      ".lg-btn{background:none;border:1px solid rgba(244,236,223,.4);color:#f4ecdf;" +
      "border-radius:4px;padding:4px 8px;font-family:inherit;font-size:11px;" +
      "cursor:pointer;white-space:nowrap;}" +
      ".lg-btn:hover{background:rgba(244,236,223,.14);}";
    shadow.appendChild(style);

    var box = document.createElement("div");
    box.className = "lg";
    box.innerHTML =
      "<span class='lg-title'>" +
      tituloTexto +
      "</span>" +
      "<div class='lg-items'>" +
      itens +
      "</div>" +
      "<span class='lg-sep'></span>" +
      "<button class='lg-btn' data-acao='toggle'>" +
      (oculto ? "Mostrar" : "Ocultar") +
      "</button>" +
      "<button class='lg-btn' data-acao='limpar'>Limpar</button>";
    shadow.appendChild(box);

    box.querySelector("[data-acao='toggle']").addEventListener("click", function () {
      var off = document.documentElement.getAttribute("data-verus-claims") === "off";
      document.documentElement.setAttribute(
        "data-verus-claims",
        off ? "on" : "off",
      );
      this.textContent = off ? "Ocultar" : "Mostrar";
    });
    box.querySelector("[data-acao='limpar']").addEventListener("click", function () {
      window.VerusClaimHighlight.limpar();
    });

    document.body.appendChild(host);
  }

  function _removerLegenda() {
    var el = document.getElementById(LEGENDA_ID);
    if (el) el.remove();
  }

  // ── delegacao de eventos para os tooltips ──────────────────────────────────
  function _ligarEventos() {
    if (_eventosLigados) return;
    _eventosLigados = true;
    document.addEventListener("mouseover", _onMouseOver, true);
    document.addEventListener("mouseout", _onMouseOut, true);
    document.addEventListener("focusin", _onFocusIn, true);
    document.addEventListener("focusout", _onMouseOut, true);
    _scrollHandler = function () {
      var host = document.getElementById(TIP_ID);
      if (host && host.style.display === "block") host.style.display = "none";
    };
    window.addEventListener("scroll", _scrollHandler, true);
  }

  function _desligarEventos() {
    _eventosLigados = false;
    document.removeEventListener("mouseover", _onMouseOver, true);
    document.removeEventListener("mouseout", _onMouseOut, true);
    document.removeEventListener("focusin", _onFocusIn, true);
    document.removeEventListener("focusout", _onMouseOut, true);
    if (_scrollHandler) window.removeEventListener("scroll", _scrollHandler, true);
    _scrollHandler = null;
  }

  function _marcaAlvo(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    return node && node.closest
      ? node.closest(MARK_TAG + ", a[data-verus-fonte]")
      : null;
  }

  function _onMouseOver(e) {
    if (document.documentElement.getAttribute("data-verus-claims") === "off")
      return;
    var mark = _marcaAlvo(e.target);
    if (mark) _mostrarTooltip(mark);
  }

  function _onFocusIn(e) {
    var mark = _marcaAlvo(e.target);
    if (mark) _mostrarTooltip(mark);
  }

  function _onMouseOut(e) {
    if (_marcaAlvo(e.target)) _agendarOcultar();
  }

  // ── API publica ────────────────────────────────────────────────────────────
  function aplicar(buildFinal) {
    if (!buildFinal) return 0;
    var claims = Array.isArray(buildFinal.claimsAnalisadas)
      ? buildFinal.claimsAnalisadas
      : [];
    if (!claims.length) return 0;

    limpar();
    _injetarEstilo();
    document.documentElement.setAttribute("data-verus-claims", "on");

    var nodes = _coletarTextNodes(_raizConteudo());
    if (!nodes.length) return 0;

    // 1) encontra o melhor trecho de cada claim
    var matches = [];
    for (var i = 0; i < claims.length; i++) {
      var match = _melhorMatchClaim(claims[i], nodes);
      if (match) matches.push({ claim: claims[i], match: match });
    }
    if (!matches.length) return 0;

    // 2) agrupa por node e aplica do fim para o inicio (mantem offsets validos)
    var porNode = new Map();
    matches.forEach(function (item) {
      var node = item.match.node;
      if (!porNode.has(node)) porNode.set(node, []);
      porNode.get(node).push(item);
    });

    var total = 0;
    var contagens = {};

    porNode.forEach(function (lista) {
      lista.sort(function (a, b) {
        return b.match.start - a.match.start;
      });
      var limite = Infinity;
      lista.forEach(function (item) {
        if (item.match.fim > limite) return; // sobreposicao
        var info = _statusInfo(
          item.claim.statusNormalizado || item.claim.statusOriginal,
        );
        var idx = _claimsData.length;
        if (_aplicarMarca(item.match.node, item.match, idx, info)) {
          _claimsData.push(item.claim);
          limite = item.match.start;
          total++;
          var token = _tokenStatus(
            item.claim.statusNormalizado || item.claim.statusOriginal,
          );
          if (!STATUS[token]) token = "inconclusiva";
          contagens[token] = (contagens[token] || 0) + 1;
        }
      });
    });

    if (total > 0) {
      _contagensClaims = contagens;
      _ligarEventos();
      _atualizarLegenda();
    }
    return total;
  }

  // Marca os links da pagina que apontam para noticias ja analisadas no VerusAI.
  async function marcarFontesAnalisadas() {
    if (typeof _fetchBackground !== "function") return 0;

    var links = Array.prototype.slice.call(
      document.querySelectorAll("a[href]"),
    );
    var alvoSelf = _normalizarUrlComparavel(location.href);
    var porUrl = new Map();

    links.forEach(function (a) {
      var abs = a.href;
      if (!/^https?:/i.test(abs)) return;
      if (_linkIgnorado(a)) return;
      var norm = _normalizarUrlComparavel(abs);
      if (!norm || norm === alvoSelf) return;
      if (!porUrl.has(norm)) porUrl.set(norm, []);
      porUrl.get(norm).push(a);
    });

    if (!porUrl.size) return 0;
    var urls = Array.from(porUrl.keys()).slice(0, 400);

    var res;
    try {
      res = await _fetchBackground(
        _baseApi() + "/api/analises/por-urls",
        "POST",
        { urls: urls },
      );
    } catch (e) {
      return 0;
    }

    var data = res && res.data ? res.data : null;
    if (!data || !data.ok || !Array.isArray(data.analises)) return 0;

    _injetarEstilo();
    document.documentElement.setAttribute("data-verus-claims", "on");

    var total = 0;
    data.analises.forEach(function (an) {
      var norm = an.urlNorm || _normalizarUrlComparavel(an.url);
      var els = porUrl.get(norm);
      if (!els || !els.length) return;
      var info = _vereditoInfo(an.veredito);
      var idx = _fontesData.length;
      _fontesData.push({
        veredito: an.veredito,
        score: an.score,
        titulo: an.titulo,
        info: info,
      });
      els.forEach(function (a) {
        if (a.hasAttribute("data-verus-fonte-idx")) return;
        a.setAttribute("data-verus-fonte", "");
        a.setAttribute("data-verus-fonte-idx", String(idx));
        a.style.setProperty("--vf-color", info.cor);
        _fontesEls.push(a);
        total++;
      });
    });

    if (total > 0) {
      _ligarEventos();
      _atualizarLegenda();
    }
    return total;
  }

  function _linkIgnorado(a) {
    if (a.closest && a.closest(MARK_TAG)) return true;
    for (var i = 0; i < EXCLUIR_IDS.length; i++) {
      if (a.closest && a.closest("#" + EXCLUIR_IDS[i])) return true;
    }
    return false;
  }

  // Ao abrir uma pagina: se ela JA foi analisada antes, busca o resultado salvo
  // no servidor e aplica o destaque das claims automaticamente (sem reanalisar).
  async function autoDestacar() {
    if (_autoTentado) return 0;
    _autoTentado = true;

    var host = "";
    try {
      host = location.hostname.toLowerCase();
    } catch (e) {}
    if (!host || host === "localhost" || host.indexOf("127.0.0.1") === 0) {
      return 0;
    }
    if (typeof _fetchBackground !== "function") return 0;

    // 1) a pagina atual ja foi analisada? (match por URL normalizada)
    var resCheck;
    try {
      resCheck = await _fetchBackground(
        _baseApi() + "/api/analises/por-urls",
        "POST",
        { urls: [location.href] },
      );
    } catch (e) {
      return 0;
    }
    var dataCheck = resCheck && resCheck.data ? resCheck.data : null;
    var achou =
      dataCheck &&
      dataCheck.ok &&
      Array.isArray(dataCheck.analises) &&
      dataCheck.analises.length
        ? dataCheck.analises[0]
        : null;

    // Mesmo sem analise da pagina atual, marca os links de noticias ja checadas.
    if (!achou) {
      marcarFontesAnalisadas();
      return 0;
    }

    // 2) busca o detalhe (buildFinal com as claims) e aplica o destaque.
    var urlSalva = achou.url || location.href;

    // Noticia ja analisada: mostra tambem o aviso com o feedback (like/
    // dislike/comentarios) que a comunidade ja deixou nessa mesma URL.
    if (
      window.VerusSeloComunidade &&
      typeof window.VerusSeloComunidade.criar === "function"
    ) {
      window.VerusSeloComunidade.criar(urlSalva, achou.titulo || document.title);
    }

    var resDet;
    try {
      resDet = await _fetchBackground(
        _baseApi() +
          "/api/analises/detalhe?url=" +
          encodeURIComponent(urlSalva),
        "GET",
      );
    } catch (e) {
      marcarFontesAnalisadas();
      return 0;
    }

    var dataDet = resDet && resDet.data ? resDet.data : null;
    var buildFinal =
      dataDet &&
      (dataDet.resultado || (dataDet.analise && dataDet.analise.resultado));

    var total = 0;
    if (buildFinal && Array.isArray(buildFinal.claimsAnalisadas)) {
      total = aplicar(buildFinal);
    }
    marcarFontesAnalisadas();
    return total;
  }

  function alternar(visivel) {
    document.documentElement.setAttribute(
      "data-verus-claims",
      visivel === false ? "off" : "on",
    );
  }

  function limpar() {
    _marcas.forEach(function (mark) {
      if (!mark.parentNode) return;
      var pai = mark.parentNode;
      while (mark.firstChild) pai.insertBefore(mark.firstChild, mark);
      pai.removeChild(mark);
      if (pai.normalize) pai.normalize();
    });
    _marcas = [];
    _claimsData = [];
    _contagensClaims = {};

    _fontesEls.forEach(function (a) {
      a.removeAttribute("data-verus-fonte");
      a.removeAttribute("data-verus-fonte-idx");
      a.style.removeProperty("--vf-color");
    });
    _fontesEls = [];
    _fontesData = [];

    _desligarEventos();
    _removerLegenda();
    var tip = document.getElementById(TIP_ID);
    if (tip) tip.remove();
    document.documentElement.removeAttribute("data-verus-claims");
  }

  window.VerusClaimHighlight = {
    aplicar: aplicar,
    marcarFontes: marcarFontesAnalisadas,
    autoDestacar: autoDestacar,
    alternar: alternar,
    limpar: limpar,
  };
})();
