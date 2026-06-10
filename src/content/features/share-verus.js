// features/share-verus.js
// Coloca uma opcao "Analisar no VerusAI" junto das acoes de compartilhar de
// uma pagina. Em redes sociais (ex.: Instagram) entra na barra de acoes do
// post (curtir / comentar / compartilhar / salvar); em sites comuns entra no
// menu de compartilhar (links de WhatsApp, Facebook, etc.). Ao clicar, abre o
// site do VerusAI na aba "Analisar Link" com o link ja preenchido e a analise
// rodando. Exposto como window.VerusShare.

(function () {
  if (window.VerusShare) return;

  var INJ_ATTR = "data-verus-share-item"; // marca a nossa opcao
  var DONE_ATTR = "data-verus-share-done"; // marca o container ja processado
  var NOSSOS_IDS = [
    "sidebar_id",
    "sidebar_overlay",
    "btn_wrapper",
    "verus_progress_popup",
    "verus_claim_tip",
    "verus_claim_legenda",
  ];

  // Hosts que caracterizam links de compartilhamento (menu de sites comuns).
  var RE_SOCIAL =
    /(wa\.me|whatsapp\.com|twitter\.com\/(intent|share)|x\.com\/(intent|share)|facebook\.com\/(sharer|dialog)|t\.me|telegram\.(me|org)|linkedin\.com\/(share|sharing|cws)|reddit\.com\/submit|pinterest\.[a-z.]+\/pin|getpocket\.com\/(save|edit)|tumblr\.com\/(share|widgets)|threads\.net\/intent)/i;
  var RE_SHARE = new RegExp(RE_SOCIAL.source + "|mailto:", "i");

  // aria-label do icone "compartilhar" nas barras de acao de redes sociais.
  var RE_BTN_COMPARTILHAR = /compartilh|share/i;

  var _scanTimer = null;
  var _pendentes = [];
  var _observer = null;
  var _ligado = false;
  var _ehInsta = false;

  function _siteBase() {
    var s =
      typeof VERUS_SITE_URL !== "undefined"
        ? VERUS_SITE_URL
        : "http://localhost:3000/site";
    return s.replace(/\/+$/, "");
  }

  // URL do site do VerusAI ja apontando para a aba "Analisar Link", com o link
  // alvo e o gatilho de execucao automatica da analise.
  function _urlVerus(alvo) {
    return (
      _siteBase() +
      "/?analisar=" +
      encodeURIComponent(alvo || location.href) +
      "&run=1"
    );
  }

  function _iconeVerus() {
    try {
      return chrome.runtime.getURL("assets/icons/IconVerusAi.png");
    } catch (e) {
      return "";
    }
  }

  function _hrefDe(a) {
    return a.getAttribute("href") || a.href || "";
  }

  function _dentroDoNosso(el) {
    if (!el || !el.closest) return false;
    for (var i = 0; i < NOSSOS_IDS.length; i++) {
      if (el.closest("#" + NOSSOS_IDS[i])) return true;
    }
    return el.hasAttribute && el.hasAttribute(INJ_ATTR);
  }

  // Abre o site do VerusAI numa nova aba para o link informado.
  function _ligarClique(item, getUrl) {
    item.addEventListener(
      "click",
      function (e) {
        e.stopPropagation();
        e.preventDefault();
        window.open(getUrl(), "_blank", "noopener,noreferrer");
      },
      true,
    );
  }

  function _limparAtributos(el) {
    var attrs = Array.prototype.slice.call(el.attributes || []);
    attrs.forEach(function (at) {
      var n = at.name.toLowerCase();
      if (n.indexOf("data-") === 0 && n !== INJ_ATTR) el.removeAttribute(at.name);
      if (n.indexOf("on") === 0) el.removeAttribute(at.name);
    });
  }

  // ── Barra de acoes do post (Instagram e similares) ────────────────────────

  // Descobre o link do post a partir do permalink (.../p/..., /reel/, /tv/).
  function _urlDoPost(node) {
    var art = node.closest ? node.closest("article") : null;
    var raiz = art || document;
    var link = raiz.querySelector(
      'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]',
    );
    if (link) {
      try {
        return new URL(link.getAttribute("href"), location.origin).href;
      } catch (e) {}
    }
    return location.href;
  }

  // Cria o botao clonando o proprio botao "compartilhar" do post (herdando
  // tamanho, espacamento e hover) e trocando o icone pelo do VerusAI.
  function _criarBotaoBarra(modelo, alvoUrl) {
    var item = modelo.cloneNode(true);
    _limparAtributos(item);

    var svg = item.querySelector("svg");
    var size = 24;
    if (svg) {
      var w = parseInt(svg.getAttribute("width") || "", 10);
      if (w) size = w;
    }
    var img = document.createElement("img");
    img.src = _iconeVerus();
    img.alt = "VerusAI";
    img.width = size;
    img.height = size;
    img.style.cssText =
      "width:" +
      size +
      "px;height:" +
      size +
      "px;display:block;border-radius:6px;object-fit:contain;";
    if (svg && svg.replaceWith) svg.replaceWith(img);
    else if (svg && svg.parentNode) svg.parentNode.replaceChild(img, svg);
    else item.appendChild(img);

    item.setAttribute(INJ_ATTR, "1");
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", "Analisar no VerusAI");
    item.setAttribute("title", "Analisar esta publicacao no VerusAI");
    item.style.cursor = "pointer";

    _ligarClique(item, function () {
      return _urlVerus(alvoUrl);
    });
    return item;
  }

  function _processarBarraAcoes(root) {
    if (!root.querySelectorAll) return;
    var svgs = root.querySelectorAll("svg[aria-label]");
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      var lbl = svg.getAttribute("aria-label") || "";
      if (!RE_BTN_COMPARTILHAR.test(lbl)) continue;
      // ignora o icone "compartilhar" que aparece dentro do popup de share
      if (svg.closest('[role="dialog"]')) continue;
      if (_dentroDoNosso(svg)) continue;

      var unit = svg.closest('[role="button"], button, a');
      if (!unit) unit = svg.parentElement;
      if (!unit || !unit.parentElement) continue;

      var barra = unit.parentElement;
      if (barra.querySelector("[" + INJ_ATTR + "]")) continue;

      var item = _criarBotaoBarra(unit, _urlDoPost(svg));
      barra.insertBefore(item, unit.nextSibling);
    }
  }

  // ── Menu de compartilhar (sites comuns, com links de redes sociais) ───────

  function _ehContainerCompartilhar(el) {
    if (!el || !el.querySelectorAll || _dentroDoNosso(el)) return false;
    var anchors = el.querySelectorAll("a[href]");
    var share = 0;
    var social = 0;
    for (var i = 0; i < anchors.length; i++) {
      var h = _hrefDe(anchors[i]);
      if (RE_SHARE.test(h)) {
        share++;
        if (RE_SOCIAL.test(h)) social++;
      }
    }
    return share >= 2 && social >= 1;
  }

  function _encontrarContainer(anchor) {
    var node = anchor.parentElement;
    for (var i = 0; i < 6 && node && node !== document.body; i++) {
      if (_ehContainerCompartilhar(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  // "Bolinha" no mesmo formato das opcoes de compartilhar (icone redondo +
  // rotulo embaixo). Cores funcionam em fundo claro e escuro.
  function _criarBolinha() {
    var icone = _iconeVerus();
    var item = document.createElement("a");
    item.style.cssText =
      "display:inline-flex!important;flex-direction:column;align-items:center;" +
      "justify-content:flex-start;gap:8px;width:64px;margin:4px 6px;padding:0;" +
      "border:0;background:transparent;color:inherit;text-decoration:none;" +
      "cursor:pointer;vertical-align:top;font-family:inherit;";
    item.innerHTML =
      '<span style="width:50px;height:50px;border-radius:50%;display:flex;' +
      "align-items:center;justify-content:center;background:#ffffff;" +
      "border:1px solid rgba(0,0,0,0.12);box-shadow:0 1px 3px rgba(0,0,0,0.18);" +
      'overflow:hidden;flex:0 0 auto;">' +
      (icone
        ? '<img src="' +
          icone +
          '" alt="" style="width:46px;height:46px;border-radius:50%;display:block;object-fit:cover;" />'
        : '<span style="color:#d3392d;font-weight:700;font-size:18px;">V</span>') +
      "</span>" +
      '<span style="font-size:12px;line-height:1.2;text-align:center;color:inherit;' +
      'white-space:nowrap;">VerusAI</span>';
    item.setAttribute(INJ_ATTR, "1");
    item.setAttribute("target", "_blank");
    item.setAttribute("rel", "noopener noreferrer");
    item.setAttribute("title", "Analisar esta pagina no VerusAI");
    item.setAttribute("aria-label", "Analisar esta pagina no VerusAI");
    item.setAttribute("href", _urlVerus());
    _ligarClique(item, function () {
      return _urlVerus();
    });
    return item;
  }

  function _injetarMenu(container) {
    if (!container || container.getAttribute(DONE_ATTR) === "1") return;
    if (container.querySelector("[" + INJ_ATTR + "]")) {
      container.setAttribute(DONE_ATTR, "1");
      return;
    }
    var anchors = container.querySelectorAll("a[href]");
    var modelo = null;
    for (var i = anchors.length - 1; i >= 0; i--) {
      if (RE_SHARE.test(_hrefDe(anchors[i]))) {
        modelo = anchors[i];
        break;
      }
    }
    if (!modelo) return;

    var item = _criarBolinha();
    if (modelo.parentElement) {
      modelo.parentElement.insertBefore(item, modelo.nextSibling);
    } else {
      container.appendChild(item);
    }
    container.setAttribute(DONE_ATTR, "1");
  }

  function _processarMenu(root) {
    if (root.nodeType !== 1) return;
    var lista = [];
    if (root.matches && root.matches("a[href]") && RE_SHARE.test(_hrefDe(root))) {
      lista.push(root);
    }
    if (root.querySelectorAll) {
      var anchors = root.querySelectorAll("a[href]");
      for (var i = 0; i < anchors.length; i++) {
        if (RE_SHARE.test(_hrefDe(anchors[i]))) lista.push(anchors[i]);
      }
    }
    if (!lista.length) return;
    var containers = [];
    lista.forEach(function (a) {
      var c = _encontrarContainer(a);
      if (c && containers.indexOf(c) === -1) containers.push(c);
    });
    containers.forEach(_injetarMenu);
  }

  // ── orquestracao ──────────────────────────────────────────────────────────

  function _processarRoot(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      _processarBarraAcoes(root);
    } catch (e) {}
    if (!_ehInsta) {
      try {
        _processarMenu(root);
      } catch (e) {}
    }
  }

  function _agendarScan(node) {
    if (node) _pendentes.push(node);
    if (_scanTimer) return;
    _scanTimer = setTimeout(function () {
      _scanTimer = null;
      var nodes = _pendentes;
      _pendentes = [];
      for (var i = 0; i < nodes.length; i++) _processarRoot(nodes[i]);
    }, 250);
  }

  function _ligar() {
    if (_ligado) return;
    var host = "";
    try {
      host = location.hostname.toLowerCase();
    } catch (e) {}
    if (host === "localhost" || host.indexOf("127.0.0.1") === 0) return;
    _ehInsta = /(^|\.)instagram\.com$/.test(host);
    _ligado = true;

    _agendarScan(document.body);

    _observer = new MutationObserver(function (muts) {
      for (var m = 0; m < muts.length; m++) {
        var added = muts[m].addedNodes;
        for (var n = 0; n < added.length; n++) {
          if (added[n].nodeType === 1) _agendarScan(added[n]);
        }
      }
    });
    _observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function _desligar() {
    _ligado = false;
    if (_observer) _observer.disconnect();
    _observer = null;
  }

  window.VerusShare = {
    ligar: _ligar,
    desligar: _desligar,
    escanear: function () {
      _agendarScan(document.body);
    },
  };

  _ligar();
})();
