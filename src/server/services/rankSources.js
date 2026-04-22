const DOMAIN_WEIGHTS = [
  { pattern: /\.gov\.br$|\.jus\.br$|\.leg\.br$|\.mp\.br$|\.def\.br$/, score: 100, tier: "official" },
  { pattern: /who\.int$|un\.org$|unesco\.org$|oecd\.org$|worldbank\.org$/, score: 95, tier: "international_org" },
  { pattern: /ibge\.gov\.br$|ipea\.gov\.br$|fiocruz\.br$|embrapa\.br$/, score: 90, tier: "official_research" },
  { pattern: /reuters\.com$|bbc\.com$|bbc\.co\.uk$|apnews\.com$/, score: 88, tier: "international_news" },
  { pattern: /agenciabrasil\.ebc\.com\.br$|agencia\.senado\.leg\.br$/, score: 85, tier: "official_news" },
  { pattern: /folha\.uol\.com\.br$|estadao\.com\.br$|g1\.globo\.com$|cnnbrasil\.com\.br$|valor\.com\.br$|nexojornal\.com\.br$|poder360\.com\.br$|uol\.com\.br$|veja\.abril\.com\.br$/, score: 72, tier: "major_news" },
  { pattern: /twitter\.com$|x\.com$|facebook\.com$|instagram\.com$|tiktok\.com$|youtube\.com$|threads\.net$/, score: 8, tier: "social" },
  { pattern: /blogspot\.com$|wordpress\.com$|medium\.com$|substack\.com$/, score: 18, tier: "blog" },
];

function getDomainScore(url) {
  if (!url) return { score: 0, tier: "unknown" };
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const entry of DOMAIN_WEIGHTS) {
      if (entry.pattern.test(hostname)) return { score: entry.score, tier: entry.tier };
    }
    return { score: 35, tier: "other" };
  } catch {
    return { score: 0, tier: "unknown" };
  }
}

function rankSources(resultados) {
  const comFonte = resultados.filter((r) => r.url && r.fonte);

  comFonte.sort((a, b) => {
    const scoreA = getDomainScore(a.url).score + (a.sourceType === "primary" ? 15 : 0) + (a.status === "supported" ? 5 : 0);
    const scoreB = getDomainScore(b.url).score + (b.sourceType === "primary" ? 15 : 0) + (b.status === "supported" ? 5 : 0);
    return scoreB - scoreA;
  });

  // Remove duplicatas por domínio
  const seen = new Set();
  const deduped = comFonte.filter((r) => {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, "");
      if (seen.has(host)) return false;
      seen.add(host);
      return true;
    } catch {
      return false;
    }
  });

  return deduped.slice(0, 5).map((r) => ({
    ...r,
    domainTier: getDomainScore(r.url).tier,
    domainScore: getDomainScore(r.url).score,
  }));
}

module.exports = { rankSources, getDomainScore };
