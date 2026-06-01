// features/link-preview.js
// Mostra uma previa flutuante para links em hover.

(function () {
  const GUARD = "verus_link_preview_guard";
  if (window[GUARD]) return;
  window[GUARD] = true;

  const HOVER_DELAY = 420;
  const HIDE_DELAY = 160;
  const cache = new Map();
  const attachedRoots = new WeakSet();

  let hoverTimer = null;
  let hideTimer = null;
  let currentAnchor = null;
  let currentUrl = "";
  let lastMouse = { x: 0, y: 0 };
  let card = null;

  function ensureStyle() {
    if (document.getElementById("verus-link-preview-style")) return;

    const style = document.createElement("style");
    style.id = "verus-link-preview-style";
    style.textContent = `
      #verus-link-preview {
        --vlp-ink: #171715;
        --vlp-cream: #f4ecdf;
        --vlp-paper: #f9f4eb;
        --vlp-red: #d3392d;
        --vlp-blue: #02519b;
        position: fixed;
        z-index: 2147483645;
        width: min(340px, calc(100vw - 24px));
        border: 2px solid var(--vlp-ink);
        border-top: 5px solid var(--vlp-blue);
        border-radius: 4px;
        background: var(--vlp-cream);
        color: var(--vlp-ink);
        box-shadow: 6px 6px 0 rgba(23, 23, 21, 0.18), 0 20px 48px rgba(23, 23, 21, 0.28);
        font-family: Georgia, "Times New Roman", serif;
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px) scale(0.98);
        pointer-events: auto;
        transition: opacity 0.16s ease, transform 0.16s ease;
      }

      #verus-link-preview.vlp-open {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      #verus-link-preview .vlp-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px;
        background: var(--vlp-ink);
        color: var(--vlp-cream);
        font-family: "Space Mono", "Courier New", monospace;
      }

      #verus-link-preview .vlp-domain {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #verus-link-preview .vlp-open-link {
        flex: 0 0 auto;
        color: var(--vlp-cream);
        text-decoration: none;
        font-size: 10px;
        font-weight: 800;
      }

      #verus-link-preview .vlp-loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(249, 244, 235, 0.88);
        color: rgba(23, 23, 21, 0.62);
        font-family: "Space Mono", "Courier New", monospace;
        font-size: 11px;
      }

      #verus-link-preview .vlp-loading::after {
        content: "";
        width: 28px;
        height: 28px;
        border: 3px solid rgba(23, 23, 21, 0.18);
        border-top-color: var(--vlp-red);
        border-radius: 50%;
        animation: vlpSpin 0.85s linear infinite;
      }

      #verus-link-preview .vlp-body {
        display: block;
        padding: 0;
      }

      #verus-link-preview .vlp-title {
        display: none;
      }

      #verus-link-preview .vlp-desc {
        display: none;
      }

      #verus-link-preview .vlp-url {
        display: none;
      }

      #verus-link-preview .vlp-image {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 210px;
        background-position: center;
        background-size: cover;
        background-color: var(--vlp-paper);
        background-image:
          linear-gradient(135deg, rgba(211, 57, 45, 0.16), transparent 44%),
          linear-gradient(45deg, rgba(2, 81, 155, 0.14), transparent 58%);
      }

      #verus-link-preview .vlp-image-label {
        max-width: 84%;
        border: 1.5px solid var(--vlp-ink);
        background: rgba(244, 236, 223, 0.92);
        color: var(--vlp-ink);
        padding: 8px 10px;
        font-family: "Space Mono", "Courier New", monospace;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.3;
        text-align: center;
        overflow-wrap: anywhere;
      }

      @keyframes vlpSpin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 520px) {
        #verus-link-preview {
          width: calc(100vw - 20px);
        }

        #verus-link-preview .vlp-image {
          min-height: 170px;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrlFromAnchor(anchor) {
    if (!anchor) return "";
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return "";

    try {
      const url = new URL(href, window.location.href);
      if (!/^https?:$/i.test(url.protocol)) return "";
      return url.href;
    } catch (err) {
      return "";
    }
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (err) {
      return url;
    }
  }

  function getAnchorPreviewTitle(anchor, url) {
    const explicit = anchor?.dataset?.previewTitle?.trim();
    if (explicit) return explicit;

    const text = anchor?.textContent?.trim();
    if (!text) return "";

    const domain = getDomain(url);
    return text !== url && text !== domain ? text : "";
  }

  function createCard() {
    ensureStyle();

    if (card) return card;

    card = document.createElement("div");
    card.id = "verus-link-preview";
    card.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
    });
    card.addEventListener("mouseleave", scheduleHide);
    document.documentElement.appendChild(card);
    return card;
  }

  function positionCard(x, y) {
    if (!card) return;

    const gap = 16;
    const rect = card.getBoundingClientRect();
    const width = rect.width || Math.min(380, window.innerWidth - 24);
    const height = rect.height || 270;

    let left = x + gap;
    let top = y + gap;

    if (left + width > window.innerWidth - 10) {
      left = Math.max(10, x - width - gap);
    }

    if (top + height > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - height - 10);
    }

    card.style.left = left + "px";
    card.style.top = top + "px";
  }

  function renderSkeleton(url, anchor) {
    const label =
      getAnchorPreviewTitle(anchor, url) ||
      anchor.textContent?.trim() ||
      getDomain(url);
    const preview = createCard();
    preview.className = "";
    preview.innerHTML =
      '<div class="vlp-head">' +
      '<span class="vlp-domain">' +
      escapeHTML(getDomain(url)) +
      "</span>" +
      '<a class="vlp-open-link" href="' +
      escapeHTML(url) +
      '" target="_blank" rel="noopener noreferrer">Abrir</a>' +
      "</div>" +
      '<div class="vlp-body">' +
      '<div class="vlp-image">' +
      '<div class="vlp-loading" aria-label="Carregando imagem da previa"></div>' +
      '<span class="vlp-image-label">' +
      escapeHTML(label) +
      "</span>" +
      "</div>" +
      '<h3 class="vlp-title">' +
      escapeHTML(label) +
      "</h3>" +
      '<p class="vlp-desc"></p>' +
      '<div class="vlp-url">' +
      escapeHTML(url) +
      "</div>" +
      "</div>";

    positionCard(lastMouse.x, lastMouse.y);
    requestAnimationFrame(() => preview.classList.add("vlp-open"));
  }

  function updateCard(url, data) {
    if (!card || currentUrl !== url) return;

    const title =
      getAnchorPreviewTitle(currentAnchor, url) ||
      data?.title ||
      card.querySelector(".vlp-title")?.textContent ||
      "";
    const image = data?.image || "";
    const finalUrl = data?.url || url;
    const domain = data?.domain || getDomain(finalUrl);

    card.querySelector(".vlp-domain").textContent = domain;
    card.querySelector(".vlp-title").textContent = title;
    card.querySelector(".vlp-desc").textContent = data?.description || "";
    card.querySelector(".vlp-url").textContent = finalUrl;
    card.querySelector(".vlp-open-link").href = finalUrl;

    const imageEl = card.querySelector(".vlp-image");
    const labelEl = card.querySelector(".vlp-image-label");
    const loadingEl = card.querySelector(".vlp-loading");
    if (loadingEl) loadingEl.remove();

    if (image && imageEl) {
      imageEl.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
      card.classList.add("vlp-has-image");
      if (labelEl) labelEl.style.display = "none";
    } else {
      if (labelEl) labelEl.textContent = title || domain || "Sem imagem";
      card.classList.remove("vlp-has-image");
    }

    positionCard(lastMouse.x, lastMouse.y);
  }

  function loadMetadata(url) {
    if (cache.has(url)) {
      updateCard(url, cache.get(url));
      return;
    }

    chrome.runtime.sendMessage({ type: "LINK_PREVIEW", url }, (response) => {
      if (chrome.runtime.lastError) return;
      const data = response?.ok ? response.data : null;
      if (data) cache.set(url, data);
      updateCard(url, data || {});
    });
  }

  function hideNow() {
    clearTimeout(hoverTimer);
    currentAnchor = null;
    currentUrl = "";
    if (!card) return;
    card.classList.remove("vlp-open");
    setTimeout(() => {
      if (card && !currentUrl) {
        card.remove();
        card = null;
      }
    }, 180);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideNow, HIDE_DELAY);
  }

  function findAnchor(target) {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest("a[href]");
    if (!anchor) return null;
    if (anchor.closest("#verus-link-preview")) return null;
    if (anchor.closest("#btn_wrapper")) return null;
    return anchor;
  }

  function attach(root) {
    if (!root || attachedRoots.has(root)) return;
    attachedRoots.add(root);

    root.addEventListener(
      "mouseover",
      (event) => {
        const anchor = findAnchor(event.target);
        const url = safeUrlFromAnchor(anchor);
        if (!anchor || !url) return;

        clearTimeout(hideTimer);
        clearTimeout(hoverTimer);

        currentAnchor = anchor;
        currentUrl = url;
        lastMouse = { x: event.clientX, y: event.clientY };

        hoverTimer = setTimeout(() => {
          if (currentAnchor !== anchor || currentUrl !== url) return;
          renderSkeleton(url, anchor);
          loadMetadata(url);
        }, HOVER_DELAY);
      },
      true,
    );

    root.addEventListener(
      "mousemove",
      (event) => {
        lastMouse = { x: event.clientX, y: event.clientY };
        if (card && currentUrl) positionCard(event.clientX, event.clientY);
      },
      true,
    );

    root.addEventListener(
      "mouseout",
      (event) => {
        const anchor = findAnchor(event.target);
        if (!anchor || anchor !== currentAnchor) return;

        const related = event.relatedTarget;
        if (related instanceof Node && card?.contains(related)) return;
        scheduleHide();
      },
      true,
    );
  }

  window.addEventListener("scroll", hideNow, true);
  window.addEventListener("blur", hideNow);
  window.VerusLinkPreview = { attach };
})();
