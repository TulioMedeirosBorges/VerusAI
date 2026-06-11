// Preview de links (Open Graph) usado pelo /api/link-preview e /api/fetch-html.
const { decodeHtmlEntities } = require("../../lib/utils.js");

function extractLinkPreviewMeta(html, url) {
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
  let domain = "";
  try {
    domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch (e) {}

  let image = metaValue(["og:image", "twitter:image"]);
  if (image) {
    try {
      image = new URL(image, finalUrl).href;
    } catch (e) {
      image = "";
    }
  }

  return {
    url: finalUrl,
    domain,
    title:
      metaValue(["og:title", "twitter:title"]) ||
      decodeHtmlEntities(titleMatch?.[1]?.replace(/\s+/g, " ").trim() || ""),
    description: metaValue([
      "description",
      "og:description",
      "twitter:description",
    ]),
    image,
  };
}

function normalizarUrlPreview(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.href;
  } catch (e) {
    return "";
  }
}

async function buildPublicLinkPreview(url) {
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
        "User-Agent":
          "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    const finalUrl = res.url || url;

    if (!contentType.includes("text/html")) {
      return extractLinkPreviewMeta("", finalUrl);
    }

    const html = await res.text();
    return extractLinkPreviewMeta(html, finalUrl);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  extractLinkPreviewMeta,
  normalizarUrlPreview,
  buildPublicLinkPreview,
};
