function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function extractMeta(html, url) {
  const head = String(html || "").slice(0, 500000);
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  function metaValue(names) {
    for (const name of names) {
      const re = new RegExp(
        `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      );
      const reverse = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`,
        "i",
      );
      const match = head.match(re) || head.match(reverse);
      if (match?.[1]) return decodeHtmlEntities(match[1].trim());
    }
    return "";
  }

  const finalUrl = url || "";
  const title =
    metaValue(["og:title", "twitter:title"]) ||
    decodeHtmlEntities(titleMatch?.[1]?.replace(/\s+/g, " ").trim() || "");
  const description = metaValue([
    "description",
    "og:description",
    "twitter:description",
  ]);
  let image = metaValue(["og:image", "twitter:image"]);

  if (!image) {
    const imageMatch = head.match(
      /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i,
    );
    image = imageMatch?.[1] || "";
  }

  if (image) {
    try {
      image = new URL(image, finalUrl).href;
    } catch (err) {
      image = "";
    }
  }

  let domain = "";
  try {
    domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch (err) {}

  return {
    url: finalUrl,
    domain,
    title,
    description,
    image,
  };
}

async function buildLinkPreview(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.7",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    const finalUrl = res.url || url;

    if (!contentType.includes("text/html")) {
      return extractMeta("", finalUrl);
    }

    const html = await res.text();
    return extractMeta(html, finalUrl);
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "LINK_PREVIEW") {
    buildLinkPreview(request.url)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => {
        console.log("[VerusAI background] link preview erro:", err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (request.type === "FETCH") {
    console.log("[VerusAI background] FETCH:", request.url);
    fetch(request.url, {
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body ? JSON.stringify(request.body) : undefined,
    })
      .then(async (res) => {
        console.log("[VerusAI background] resposta:", res.status, res.headers.get("content-type"));
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          sendResponse({ ok: res.ok, status: res.status, data });
        } else {
          const data = await res.text();
          sendResponse({ ok: res.ok, status: res.status, data });
        }
      })
      .catch((err) => {
        console.log("[VerusAI background] erro:", err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (request.type === "CONFIGS_UPDATED") {
    chrome.runtime.sendMessage({ type: "CONFIGS_UPDATED", configs: request.configs });
  }
});
