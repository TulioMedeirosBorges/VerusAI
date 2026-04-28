// features/analysis.js
// Extração de conteúdo da página e utilitários de análise

function siteNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const socialDomains = ["instagram.com", "twitter.com", "x.com", "tiktok.com", "facebook.com", "youtube.com"];
    if (socialDomains.some((d) => host.includes(d))) {
      const match = parsed.pathname.match(/^\/([^/]+)/);
      if (match && match[1] && match[1] !== "p" && match[1] !== "reel") {
        return "@" + match[1];
      }
    }
    const parts = host.split(".");
    const name = parts.length >= 2 ? parts[parts.length - 2] : host;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return url;
  }
}

function getVisibleArticle() {
  const selectors = [
    "article", "main", '[role="main"]', ".post-content",
    ".article-body", ".content", "#content", ".noticias", "#noticias",
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    let best = null;
    let bestVisibility = 0;

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
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
  const moreSelectors = ['span[role="button"]', "button", 'div[role="button"]'];
  const keywords = ["ver mais", "more", "mais", "see more"];

  for (const selector of moreSelectors) {
    for (const el of article.querySelectorAll(selector)) {
      const text = el.innerText?.toLowerCase().trim();
      if (keywords.some((kw) => text === kw)) {
        el.click();
        return true;
      }
    }
  }
  return false;
}

function extractPagePayload(article) {
  const title = document.title || document.querySelector("h1")?.innerText || null;
  const text = article.innerText.trim().slice(0, 8000);
  const url = window.location.href;
  const hostname = window.location.hostname;

  const foundLinks = Array.from(article.querySelectorAll("a[href]"))
    .map((a) => ({ text: a.innerText.trim(), url: a.href }))
    .filter((l) => l.text && l.url.startsWith("http"))
    .slice(0, 20);

  const img = article.querySelector("img");
  const rawImageUrl = img?.src || null;
  const imageUrl = rawImageUrl && !rawImageUrl.startsWith("data:") ? rawImageUrl : null;

  const cleanHost = hostname.replace(/^www\./, "");
  const hostParts = cleanHost.split(".");
  const siteName =
    hostParts.length >= 2
      ? hostParts[hostParts.length - 2].charAt(0).toUpperCase() + hostParts[hostParts.length - 2].slice(1)
      : cleanHost;

  const platform =
    hostname.includes("facebook") ? "facebook" :
    hostname.includes("twitter") || hostname.includes("x.com") ? "twitter" :
    hostname.includes("instagram") ? "instagram" :
    hostname.includes("youtube") ? "youtube" :
    hostname.includes("tiktok") ? "tiktok" : "web";

  let sourceHandle = null;
  let sourceUrl = null;

  if (platform === "youtube") {
    const channelEl =
      document.querySelector("ytd-channel-name yt-formatted-string") ||
      document.querySelector("#channel-name yt-formatted-string") ||
      document.querySelector("ytd-video-owner-renderer #channel-name a") ||
      document.querySelector("#owner #channel-name a");
    sourceHandle = channelEl?.innerText?.trim() || null;
    const channelLink = document.querySelector("ytd-video-owner-renderer a") || document.querySelector("#owner a");
    sourceUrl = channelLink?.href || null;
  }

  if (platform === "instagram") {
    const profileEl =
      document.querySelector("header a[role='link'] span") ||
      document.querySelector("article header a span") ||
      document.querySelector("header h2 a");
    sourceHandle = profileEl?.innerText?.trim() || null;
    const match = window.location.pathname.match(/^\/([^/]+)/);
    if (match) sourceUrl = `https://www.instagram.com/${match[1]}/`;
  }

  if (platform === "twitter") {
    const profileEl =
      document.querySelector("[data-testid='UserName'] span") ||
      document.querySelector("article [href*='/status/'] span");
    sourceHandle = profileEl?.innerText?.trim() || null;
    const match = window.location.pathname.match(/^\/([^/]+)/);
    if (match) sourceUrl = `https://x.com/${match[1]}`;
  }

  if (platform === "tiktok") {
    const profileEl =
      document.querySelector("[data-e2e='browse-username']") ||
      document.querySelector("h3[data-e2e='video-author-uniqueid']");
    sourceHandle = profileEl?.innerText?.trim() || null;
    const match = window.location.pathname.match(/^\/@([^/]+)/);
    if (match) sourceUrl = `https://www.tiktok.com/@${match[1]}`;
  }

  const headings = Array.from(article.querySelectorAll("h2, h3"))
    .map((h) => h.innerText.trim())
    .filter(Boolean);
  const hasMultipleTopics = headings.length >= 3;

  return { title, text, url, siteName, foundLinks, imageUrl, platform, hasMultipleTopics, sourceHandle, sourceUrl };
}
