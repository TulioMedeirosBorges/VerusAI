// services/extractor.js
// Extratores de conteúdo de página para uso no console do navegador

// ── Utilitários ───────────────────────────────────────────────────────────────

function _getMeta(names) {
  for (const name of names) {
    const el = document.querySelector(
      `meta[property="${name}"], meta[name="${name}"]`,
    );
    if (el?.content) return el.content;
  }
  return null;
}

function _getLinks() {
  return Array.from(document.querySelectorAll("a[href]"))
    .map((a) => a.href)
    .filter((h) => h.startsWith("http"));
}

function _getMainText() {
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
    if (el) {
      var texto = el.innerText?.replace(/\s+/g, " ").trim();
      if (texto && texto.length > 200) return texto;
    }
  }

  return document.body?.innerText?.replace(/\s+/g, " ").trim() || "";
}

function _getPublishDate() {
  // Tenta meta tags primeiro
  var meta = _getMeta([
    "article:published_time",
    "datePublished",
    "article:modified_time",
    "og:updated_time",
    "date",
  ]);
  if (meta) return meta;

  // Tenta elemento time no HTML
  var timeEl = document.querySelector("time[datetime]");
  if (timeEl) return timeEl.getAttribute("datetime");

  // Tenta JSON-LD
  var jsonLd = document.querySelector("script[type='application/ld+json']");
  if (jsonLd) {
    try {
      var data = JSON.parse(jsonLd.textContent);
      if (data.datePublished) return data.datePublished;
      if (data.dateModified) return data.dateModified;
    } catch (e) {}
  }

  return null;
}

function _getHeadings() {
  return Array.from(document.querySelectorAll("h1, h2, h3"))
    .map(function (h) {
      return h.innerText?.trim();
    })
    .filter(Boolean);
}

function _getBasePayload() {
  var text = _getMainText();
  return {
    url: location.href,
    title:
      document.title || _getMeta(["og:title", "twitter:title"]) || "Sem título",
    description: _getMeta([
      "description",
      "og:description",
      "twitter:description",
    ]),
    sitename: _getMeta(["og:site_name"]),
    author: _getMeta(["author", "article:author"]),
    publishdate: _getPublishDate(),
    imageurl: _getMeta(["og:image", "twitter:image"]),
    language: document.documentElement.lang || null,
    pagetype: _getMeta(["og:type"]) || "webpage",
    text: text,
    headings: _getHeadings(),
    links: _getLinks().slice(0, 30),
    textlength: text?.length || 0,
    domain: location.hostname,
  };
}

// ── PageExtractor ─────────────────────────────────────────────────────────────

var PageExtractor = {
  extract() {
    var hostname = location.hostname;
    var promise;

    if (hostname.includes("youtube.com")) {
      if (location.pathname.startsWith("/shorts/")) {
        return Promise.resolve({
          url: location.href,
          aviso: "Shorts do YouTube não são suportados para análise.",
        });
      }
      promise = SiteSpecificStrategies.extractYouTubeVideo();
    } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      promise = SiteSpecificStrategies.extractTwitterThread();
    } else if (hostname.includes("instagram.com")) {
      if (location.pathname.startsWith("/reels/")) {
        promise = Promise.resolve({
          url: location.href,
          aviso:
            "Reels do Instagram não são suportados para análise. Entre no perfil do criador, encontre o vídeo e abra-o diretamente para analisar.",
        });
      } else {
        promise = SiteSpecificStrategies.extractInstagramPost();
      }
    } else if (hostname.includes("reddit.com")) {
      promise = SiteSpecificStrategies.extractRedditThread();
    } else {
      promise = Promise.resolve(_getBasePayload());
    }

    return promise.then(function (payload) {
      console.log("[VerusAI] Dados extraídos da página:", payload);
      return payload;
    });
  },
};

// ── DynamicContentExtractor ───────────────────────────────────────────────────

var DynamicContentExtractor = {
  extractWithWait({ timeout = 2000 } = {}) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(_getBasePayload()), timeout);
    });
  },

  extractWithMutationObserver(callback, { debounceMs = 1000 } = {}) {
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(_getBasePayload()), debounceMs);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return Promise.resolve(observer);
  },
};

// ── SiteSpecificStrategies ────────────────────────────────────────────────────

var SiteSpecificStrategies = {
  extractTwitterThread() {
    const tweets = Array.from(document.querySelectorAll("article")).map(
      (el) => ({
        author:
          el.querySelector("[data-testid='User-Name']")?.innerText || null,
        text: el.querySelector("[data-testid='tweetText']")?.innerText || null,
        time: el.querySelector("time")?.getAttribute("datetime") || null,
      }),
    );
    return Promise.resolve({ ..._getBasePayload(), tweets });
  },

  extractYouTubeVideo() {
    const payload = _getBasePayload();
    const videoId = new URLSearchParams(location.search).get("v");

    const base = {
      ...payload,
      channel:
        document
          .querySelector("#channel-name, #owner-name a, ytd-channel-name a")
          ?.innerText?.trim() || null,
      views:
        document
          .querySelector(
            ".view-count, #info-text, ytd-video-view-count-renderer",
          )
          ?.innerText?.trim() || null,
      uploadDate:
        document
          .querySelector(
            "#info-strings yt-formatted-string, ytd-video-primary-info-renderer #info-strings",
          )
          ?.innerText?.trim() || null,
      videoId,
      description:
        document
          .querySelector(
            "#description-inline-expander, #description, ytd-text-inline-expander",
          )
          ?.innerText?.trim() || payload.description,
    };

    function _lerTranscricao() {
      var segments = document.querySelectorAll(
        "transcript-segment-view-model span.ytAttributedStringHost",
      );
      if (segments.length === 0) return null;
      return Array.from(segments)
        .map(function (s) {
          return s.innerText?.trim();
        })
        .filter(Boolean)
        .join(" ");
    }

    // Se a transcrição já está no DOM, usa direto
    var transcriptImediata = _lerTranscricao();
    if (transcriptImediata)
      return Promise.resolve({ ...base, transcript: transcriptImediata });

    // Tenta abrir a transcrição automaticamente
    return new Promise(function (resolve) {
      // Primeiro expande a descrição se necessário
      var expandBtn = document.querySelector(
        "tp-yt-paper-button#expand, ytd-text-inline-expander #expand, #description tp-yt-paper-button",
      );
      if (expandBtn) expandBtn.click();

      setTimeout(function () {
        // Clica no botão de transcrição
        var btns = Array.from(
          document.querySelectorAll("button, yt-button-shape button"),
        );
        var transcriptBtn = btns.find(function (b) {
          var label = (
            b.getAttribute("aria-label") ||
            b.innerText ||
            ""
          ).toLowerCase();
          return label.includes("transcript") || label.includes("transcri");
        });

        if (transcriptBtn) {
          transcriptBtn.click();
          setTimeout(function () {
            var transcript = _lerTranscricao();
            resolve(transcript ? { ...base, transcript } : base);
          }, 2500);
        } else {
          resolve(base);
        }
      }, 1200);
    });
  },

  extractInstagramPost() {
    const payload = _getBasePayload();

    // Se estiver em post individual (/p/ ou /reel/), pega o primeiro article
    // Se estiver no feed, pega o article cujo centro está mais próximo do centro da viewport
    var isPostPage = /\/(p|reel)\//.test(location.pathname);
    var articles = Array.from(document.querySelectorAll("article"));

    var postAtivo;
    if (isPostPage) {
      postAtivo = articles[0];
    } else {
      var centroTela = window.innerHeight / 2;
      postAtivo = articles.reduce(function (melhor, atual) {
        var rect = atual.getBoundingClientRect();
        var distancia = Math.abs(rect.top + rect.height / 2 - centroTela);
        if (!melhor) return atual;
        var rectMelhor = melhor.getBoundingClientRect();
        var distanciaMelhor = Math.abs(
          rectMelhor.top + rectMelhor.height / 2 - centroTela,
        );
        return distancia < distanciaMelhor ? atual : melhor;
      }, null);
    }

    if (!postAtivo) return Promise.resolve(payload);

    // Tenta expandir o "mais" da legenda dentro do post ativo
    // Nos reels o botão "mais" pode estar fora do article
    var containerBusca =
      isPostPage && /\/reel\//.test(location.pathname) ? document : postAtivo;
    var maisBtn = Array.from(
      containerBusca.querySelectorAll("button, span[role='button'], span"),
    ).find(function (b) {
      var t = b.innerText?.trim().toLowerCase();
      return (
        t === "mais" ||
        t === "more" ||
        t === "ver mais" ||
        t === "exibir mais" ||
        t === "...mais" ||
        t === "… mais"
      );
    });

    return new Promise(function (resolve) {
      if (maisBtn) {
        maisBtn.click();
        setTimeout(function () {
          resolve({
            ...payload,
            url:
              postAtivo.querySelector("a[href*='/p/'], a[href*='/reel/']")
                ?.href || payload.url,
            author:
              postAtivo
                .querySelector("header a, header span")
                ?.innerText?.trim() || null,
            caption:
              postAtivo.querySelector("h1")?.innerText?.trim() ||
              postAtivo
                .querySelector("[data-testid='post-comment-root'] span")
                ?.innerText?.trim() ||
              postAtivo.querySelector("div > span > span")?.innerText?.trim() ||
              postAtivo.querySelector("span._ap3a")?.innerText?.trim() ||
              document.querySelector("span._ap3a")?.innerText?.trim() ||
              null,
            imageUrl: postAtivo.querySelector("img")?.src || payload.imageUrl,
            publishDate:
              postAtivo.querySelector("time")?.getAttribute("datetime") ||
              payload.publishDate,
            text:
              containerBusca.innerText?.replace(/\s+/g, " ").trim() ||
              payload.text,
          });
        }, 800);
      } else {
        resolve({
          ...payload,
          url:
            postAtivo.querySelector("a[href*='/p/'], a[href*='/reel/']")
              ?.href || payload.url,
          author:
            postAtivo
              .querySelector("header a, header span")
              ?.innerText?.trim() || null,
          caption:
            postAtivo.querySelector("h1")?.innerText?.trim() ||
            postAtivo
              .querySelector("[data-testid='post-comment-root'] span")
              ?.innerText?.trim() ||
            postAtivo.querySelector("div > span > span")?.innerText?.trim() ||
            postAtivo.querySelector("span._ap3a")?.innerText?.trim() ||
            document.querySelector("span._ap3a")?.innerText?.trim() ||
            null,
          imageUrl: postAtivo.querySelector("img")?.src || payload.imageUrl,
          publishDate:
            postAtivo.querySelector("time")?.getAttribute("datetime") ||
            payload.publishDate,
          text:
            containerBusca.innerText?.replace(/\s+/g, " ").trim() ||
            payload.text,
        });
      }
    });
  },

  extractRedditThread() {
    const payload = _getBasePayload();
    const comments = Array.from(
      document.querySelectorAll("[data-testid='comment']"),
    ).map((el) => ({
      author:
        el.querySelector("[data-testid='comment_author_link']")?.innerText ||
        null,
      text: el.querySelector("p")?.innerText || null,
    }));
    return Promise.resolve({
      ...payload,
      content:
        document.querySelector("[data-click-id='text'] p")?.innerText || null,
      subreddit:
        document.querySelector("[data-prefixed-name]")?.dataset.prefixedName ||
        null,
      comments,
    });
  },
};
