(() => {
  const BTN_ID = "btn_id";
  const BTN_CHAT_ID = "btn_chat_id";
  const SIDEBAR_ID = "sidebar_id";
  const OVERLAY_ID = "sidebar_overlay";
  const STYLE_GUARD = "secure_guard";
  const logo = chrome.runtime.getURL("assets/image/LogoAosFatosAtivo 2.svg");
  const iconDarkmode = chrome.runtime.getURL("assets/icons/dark_mode.svg");
  const iconSettings = chrome.runtime.getURL("assets/icons/settings.svg");

  if (window[STYLE_GUARD]) return;
  window[STYLE_GUARD] = true;

  let sidebarAberto = false;

  const buttonStyle = document.createElement("style");
  buttonStyle.textContent = `
    #btn_id {
      position: fixed;
      right: 16px;
      bottom: 24px;
      z-index: 2147483647;
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      background: #f1ae2b;
      color: #000000;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }

    #btn_chat_id {
      position: fixed;
      right: 110px;
      bottom: 24px;
      z-index: 2147483647;
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      background: #000000;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }

    #sidebar_overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 41235122;
      background: transparent;
    }
  `;
  document.head.appendChild(buttonStyle);

  function bloquearTeclado(e) {
    if (!sidebarAberto) return;
    const focoNoSidebar =
      document.activeElement?.id === SIDEBAR_ID ||
      document.activeElement?.shadowRoot !== undefined ||
      document.activeElement?.closest(`#${SIDEBAR_ID}`) !== null;
    if (focoNoSidebar) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  }

  function fecharSidebar() {
    sidebarAberto = false;
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (sidebar) sidebar.remove();
    if (overlay) overlay.remove();
    window.removeEventListener("keydown", bloquearTeclado, true);
    window.removeEventListener("keyup", bloquearTeclado, true);
    window.removeEventListener("keypress", bloquearTeclado, true);
    document.removeEventListener("keydown", bloquearTeclado, true);
    document.removeEventListener("keyup", bloquearTeclado, true);
    document.removeEventListener("keypress", bloquearTeclado, true);
  }

  function getVisibleArticle() {
    const selectors = [
      "article",
      "main",
      '[role="main"]',
      ".post-content",
      ".article-body",
      ".content",
      "#content",
      ".noticias",
      "#noticias",
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      let best = null;
      let bestVisibility = 0;

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(windowHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if (visibleHeight > bestVisibility) {
          bestVisibility = visibleHeight;
          best = el;
        }
      }

      if (best) return best;
    }

    return document.body;
  }

  function expandPost(article) {
    const moreSelectors = [
      'span[role="button"]',
      "button",
      'div[role="button"]',
    ];
    const keywords = ["ver mais", "more", "mais", "see more"];

    for (const selector of moreSelectors) {
      const elements = article.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.innerText?.toLowerCase().trim();
        if (keywords.some((kw) => text === kw)) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }

  function criarSidebar(analysis = null) {
    sidebarAberto = true;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);

    window.addEventListener("keydown", bloquearTeclado, true);
    window.addEventListener("keyup", bloquearTeclado, true);
    window.addEventListener("keypress", bloquearTeclado, true);
    document.addEventListener("keydown", bloquearTeclado, true);
    document.addEventListener("keyup", bloquearTeclado, true);
    document.addEventListener("keypress", bloquearTeclado, true);

    const host = document.createElement("div");
    host.id = SIDEBAR_ID;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("style/styleSidebar.css");
    shadow.appendChild(style);

    const open = document.createElement("aside");
    open.innerHTML = `
      <header id="header">
        <div class="img">
          <img id="logo" src="${logo}" alt="" />
        </div>
        <div class="tm_stt">
          <div class="tema">
            <div class="retangleTema">
              <div class="circleTema">
                <img src="${iconDarkmode}" class="icon-darkmode" />
              </div>
            </div>
          </div>
          <div class="menu">
            <img id="settings" src="${iconSettings}" class="icon-settings" />
          </div>
        </div>
      </header>
      <div id="confiabilit">
        <div class="titleconf">
          <div class="conftext"><p>CONFIABILIDADE</p></div>
          <div class="porcentconf">
            <p>ALTA</p>
            <div id="porcent"><p>98%</p></div>
          </div>
        </div>
        <div class="confiabilitbar">
          <div id="confbar"></div>
        </div>
      </div>
      <div id="chatMensagens"></div>
      <footer class="chatFooter">
        <input type="text" id="chatInput" placeholder="Faça sua pergunta..." />
        <button id="chatEnviar">➤</button>
      </footer>
    `;

    shadow.appendChild(open);

    const chatInput = shadow.getElementById("chatInput");
    const chatEnviar = shadow.getElementById("chatEnviar");
    const chatMensagens = shadow.getElementById("chatMensagens");

    // ✅ Se vier análise, mostra como primeira mensagem estilizada
    if (analysis) {
      const msgIA = document.createElement("div");
      msgIA.className = "mensagemIAPrimeira";
      msgIA.innerHTML = `
    <h1 class="result">Resultado da Verificação</h1>
    <p id="textAnalysis">${analysis.texto}</p>
    <hr/>
    ${analysis.link ? `<div id="footerAnalysis"> FONTES <br/>${analysis.link}</div>` : ""}
  `;
      chatMensagens.appendChild(msgIA);
      chatMensagens.scrollTop = chatMensagens.scrollHeight;
    }
    setTimeout(() => chatInput.focus(), 100);

    chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") enviarMensagem();
    });
    chatInput.addEventListener("keyup", (e) => e.stopPropagation());
    chatInput.addEventListener("keypress", (e) => e.stopPropagation());

    async function enviarMensagem() {
      const texto = chatInput.value.trim();
      if (!texto) return;

      const msgUsuario = document.createElement("div");
      msgUsuario.className = "mensagemUsuario";
      msgUsuario.textContent = texto;
      chatMensagens.appendChild(msgUsuario);
      chatInput.value = "";
      chatMensagens.scrollTop = chatMensagens.scrollHeight;

      const msgIA = document.createElement("div");
      msgIA.className = "mensagemIA";
      msgIA.textContent = "Digitando...";
      chatMensagens.appendChild(msgIA);
      chatMensagens.scrollTop = chatMensagens.scrollHeight;

      try {
        const resposta = await analyzeWithClaude(texto, [], null);
        msgIA.innerHTML = resposta.texto || resposta;
        if (resposta.link) {
          msgIA.innerHTML += `<br/><br/>${resposta.link}`;
        }
      } catch (e) {
        msgIA.textContent = "Erro ao obter resposta.";
      }

      chatMensagens.scrollTop = chatMensagens.scrollHeight;
    }

    chatEnviar.addEventListener("click", enviarMensagem);
  }

  function CreateButton() {
    if (document.getElementById(BTN_ID)) return;

    const button = document.createElement("button");
    button.id = BTN_ID;
    button.type = "button";
    button.textContent = "Analisar";
    button.setAttribute("aria-label", "Abrir painel de Analise");

    button.addEventListener("click", async () => {
      const sidebar = document.getElementById(SIDEBAR_ID);

      if (sidebar) {
        fecharSidebar();
        button.textContent = "Analisar";
        return;
      }

      const article = getVisibleArticle();
      if (!article) {
        alert("Nenhum post visível encontrado.");
        return;
      }

      const expanded = expandPost(article);
      if (expanded) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const text = article.innerText;
      const video = article.querySelector("video");
      const img = article.querySelector("img");

      button.textContent = "Analisando...";
      button.disabled = true;

      let analysis = { texto: "", link: "" };

      try {
        if (video) {
          const frames = await captureFrames(video);
          analysis = await analyzeWithClaude(text, frames);
        } else {
          const imageUrl = img ? img.src : null;
          analysis = await analyzeWithClaude(text, [], imageUrl);
        }
      } catch (e) {
        analysis = { texto: "Erro ao analisar o conteúdo.", link: "" };
      }

      criarSidebar(analysis);
      button.textContent = "Fechar";
      button.disabled = false;
    });

    const buttonChat = document.createElement("button");
    buttonChat.id = BTN_CHAT_ID;
    buttonChat.type = "button";
    buttonChat.textContent = "💬";
    buttonChat.setAttribute("aria-label", "Abrir chat");

    buttonChat.addEventListener("click", () => {
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (sidebar) {
        fecharSidebar();
        return;
      }
      criarSidebar();
    });

    document.body.appendChild(button);
    document.body.appendChild(buttonChat);
  }

  function init() {
    CreateButton();
  }

  init();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) {
      init();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  chrome.storage.local.get("configs", (resultado) => {
    const configs = resultado.configs;
    if (configs?.toggles?.leitornoticias) ativarLeitor();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.configs) {
      const novasConfigs = changes.configs.newValue;
      if (novasConfigs?.toggles?.leitornoticias) {
        ativarLeitor();
      } else {
        desativarLeitor();
      }
    }
  });

  function ativarLeitor() {
    document.addEventListener("mouseup", lerTextoSelecionado);
  }

  function desativarLeitor() {
    speechSynthesis.cancel();
    document.removeEventListener("mouseup", lerTextoSelecionado);
  }

  function lerTextoSelecionado() {
    const texto = window.getSelection().toString().trim();
    if (texto) falar(texto);
  }

  function falar(texto) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
})();
