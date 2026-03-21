(() => {
  const BTN_ID = "btn_id";
  const SIDEBAR_ID = "sidebar_id";
  const STYLE_GUARD = "secure_guard";
  const logo = chrome.runtime.getURL("assets/image/logo.png");

  if (window[STYLE_GUARD]) return;
  window[STYLE_GUARD] = true;

  function getVisibleArticle() {
    // Tenta article primeiro (Instagram, sites de notícia)
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

    // Fallback: pega o body inteiro
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
        sidebar.remove();
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

      let analysis = "";

      if (video) {
        const frames = await captureFrames(video);
        analysis = await analyzeWithClaude(text, frames);
      } else {
        const imageUrl = img ? img.src : null;
        analysis = await analyzeWithClaude(text, [], imageUrl);
      }

      const open = document.createElement("aside");
      open.id = SIDEBAR_ID;
      open.innerHTML = `
        <header id="header">
          <img src="${logo}" alt="" id="logo" />
        </header>
        <main><p id = "textAnalysis">${analysis}</p></main>
        <footer>descrição</footer>
      `;

      document.body.appendChild(open);
      button.textContent = "Fechar";
      button.disabled = false;
    });

    document.body.appendChild(button);
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
})();
