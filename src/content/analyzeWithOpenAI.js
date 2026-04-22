function extractPagePayload(article) {
  const title = document.title || document.querySelector("h1")?.innerText || null;
  const text = article.innerText.trim().slice(0, 8000);
  const url = window.location.href;

  const foundLinks = Array.from(article.querySelectorAll("a[href]"))
    .map((a) => ({ text: a.innerText.trim(), url: a.href }))
    .filter((l) => l.text && l.url.startsWith("http"))
    .slice(0, 20);

  const img = article.querySelector("img");
  const rawImageUrl = img?.src || null;
  const imageUrl = rawImageUrl && !rawImageUrl.startsWith("data:") ? rawImageUrl : null;

  const hostname = window.location.hostname;

  // Nome legível do site a partir do hostname
  const cleanHost = hostname.replace(/^www\./, "");
  const hostParts = cleanHost.split(".");
  const siteName = hostParts.length >= 2
    ? hostParts[hostParts.length - 2].charAt(0).toUpperCase() + hostParts[hostParts.length - 2].slice(1)
    : cleanHost;

  const platform =
    hostname.includes("facebook") ? "facebook" :
    hostname.includes("twitter") || hostname.includes("x.com") ? "twitter" :
    hostname.includes("instagram") ? "instagram" :
    hostname.includes("youtube") ? "youtube" :
    hostname.includes("tiktok") ? "tiktok" : "web";

  // Extrai nome do canal/perfil e URL da fonte
  let sourceHandle = null;
  let sourceUrl = null;

  if (platform === "youtube") {
    // Nome do canal: elemento acima do vídeo ou na página do canal
    const channelEl =
      document.querySelector("ytd-channel-name yt-formatted-string") ||
      document.querySelector("#channel-name yt-formatted-string") ||
      document.querySelector("ytd-video-owner-renderer #channel-name a") ||
      document.querySelector("#owner #channel-name a");
    sourceHandle = channelEl?.innerText?.trim() || null;

    const channelLink = document.querySelector("ytd-video-owner-renderer a") ||
      document.querySelector("#owner a");
    sourceUrl = channelLink?.href || null;
  }

  if (platform === "instagram") {
    // Nome do perfil: aparece no header do post ou da página
    const profileEl =
      document.querySelector("header a[role='link'] span") ||
      document.querySelector("article header a span") ||
      document.querySelector("header h2 a");
    sourceHandle = profileEl?.innerText?.trim() || null;

    // URL do perfil: pega o pathname /username/
    const match = window.location.pathname.match(/^\/([^/]+)/);
    if (match) sourceUrl = `https://www.instagram.com/${match[1]}/`;
  }

  if (platform === "twitter") {
    const profileEl = document.querySelector("[data-testid='UserName'] span") ||
      document.querySelector("article [href*='/status/'] span");
    sourceHandle = profileEl?.innerText?.trim() || null;
    const match = window.location.pathname.match(/^\/([^/]+)/);
    if (match) sourceUrl = `https://x.com/${match[1]}`;
  }

  if (platform === "tiktok") {
    const profileEl = document.querySelector("[data-e2e='browse-username']") ||
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

async function analyzeWithOpenAI(payload, frames) {
  try {
    const bodyObj = { ...payload, frames };
    const sizeKB = Math.round(new Blob([JSON.stringify(bodyObj)]).size / 1024);
    console.log(`[VerusAI] Payload size: ${sizeKB}KB | frames: ${frames.length} | imageUrl: ${payload.imageUrl ? "sim" : "não"}`);

    if (sizeKB > 9000) {
      console.warn("[VerusAI] Payload muito grande, removendo frames e imageUrl");
      bodyObj.imageUrl = null;
      bodyObj.frames = [];
    }

    const resposta = await chrome.runtime.sendMessage({
      type: "FETCH",
      url: "http://localhost:3000/analisar",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyObj,
    });

    if (!resposta.ok) throw new Error(`Servidor retornou ${resposta.status}`);
    return resposta.data;
  } catch (e) {
    return { pageType: "error", summary: "Erro ao conectar com o servidor de análise.", overallVerdict: "unverifiable", confidenceLabel: "baixa", confidenceScore: 0, claims: [], links: [], warnings: ["Falha de conexão"] };
  }
}
