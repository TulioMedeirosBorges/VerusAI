// Rotas de notícias ao vivo (RSS do Google Notícias) e resolução de links
// redirecionadores para a URL real do portal.
const { normalizarUrlPublica } = require("../lib/utils.js");
const {
  montarUrlRssNoticias,
  parsearRssNoticias,
  ehUrlGoogleNews,
  resolverUrlGoogleNews,
} = require("../services/integracoes/googleNews.js");

const NOTICIAS_AO_VIVO_CACHE_TTL_MS = 3 * 60 * 1000;
const noticiasAoVivoCache = new Map();

module.exports = function registrarRotasNoticias(app) {
  // Resolve um link do Google Notícias para a URL real do portal, usado pelo
  // site antes de analisar uma notícia do "Ao Vivo".
  app.get("/api/resolver-noticia", async (req, res) => {
    const original = String(req.query.url || "").trim();
    if (!normalizarUrlPublica(original)) {
      return res.status(400).json({ erro: "URL inválida." });
    }

    if (!ehUrlGoogleNews(original)) {
      return res.json({ url: original, resolvido: false });
    }

    const url = await resolverUrlGoogleNews(original);
    res.json({ url, resolvido: url !== original });
  });

  app.get("/api/noticias-ao-vivo", async (req, res) => {
    const busca = String(req.query.busca || "").trim().slice(0, 120);
    const topico = String(req.query.topico || "geral").trim().toLowerCase();
    const feedUrl = montarUrlRssNoticias({ topico, busca });

    const cacheKey = feedUrl;
    const agora = Date.now();
    const emCache = noticiasAoVivoCache.get(cacheKey);
    if (emCache && agora - emCache.salvoEm < NOTICIAS_AO_VIVO_CACHE_TTL_MS) {
      return res.json({
        noticias: emCache.noticias,
        atualizadoEm: new Date(emCache.salvoEm).toISOString(),
        cache: true,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const resposta = await fetch(feedUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.7",
          "User-Agent":
            "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)",
        },
      });

      if (!resposta.ok) {
        throw new Error(`RSS respondeu ${resposta.status}`);
      }

      const xml = await resposta.text();
      const noticias = parsearRssNoticias(xml);
      noticiasAoVivoCache.set(cacheKey, { noticias, salvoEm: agora });

      res.json({
        noticias,
        atualizadoEm: new Date(agora).toISOString(),
        cache: false,
      });
    } catch (err) {
      console.warn("[noticias-ao-vivo] falha ao buscar RSS:", err.message);
      if (emCache) {
        return res.json({
          noticias: emCache.noticias,
          atualizadoEm: new Date(emCache.salvoEm).toISOString(),
          cache: true,
          aviso: "Exibindo última versão em cache.",
        });
      }
      res
        .status(502)
        .json({ erro: "Não foi possível carregar as notícias ao vivo." });
    } finally {
      clearTimeout(timeout);
    }
  });
};
