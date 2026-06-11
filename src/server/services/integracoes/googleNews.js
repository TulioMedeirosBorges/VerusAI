// Notícias ao vivo: montagem/parse do RSS do Google Notícias e resolução dos
// links redirecionadores (news.google.com/articles|read) para a URL real.
const { decodeHtmlEntities, dominioDaUrl } = require("../../lib/utils.js");

// Cada tópico aponta para um ID de seção do Google Notícias (quando estável)
// ou para um termo de busca (mais resiliente — os IDs de seção mudam).
const NOTICIAS_AO_VIVO_TOPICOS = {
  geral: {},
  brasil: { id: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVjBHZ0pGUlNnQVAB" },
  mundo: { id: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVjBHZ0pGUlNnQVAB" },
  saude: { id: "CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVjBLQUFQAQ" },
  economia: { q: "economia" },
  tecnologia: { q: "tecnologia" },
  ciencia: { q: "ciência" },
  esportes: { q: "esportes" },
};

function montarUrlRssNoticias({ topico, busca }) {
  const sufixo = "hl=pt-BR&gl=BR&ceid=BR:pt-419";
  const termo = busca || NOTICIAS_AO_VIVO_TOPICOS[topico]?.q;
  if (termo) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(termo)}&${sufixo}`;
  }
  const id = NOTICIAS_AO_VIVO_TOPICOS[topico]?.id;
  if (id) {
    return `https://news.google.com/rss/topics/${id}?${sufixo}`;
  }
  return `https://news.google.com/rss?${sufixo}`;
}

function extrairTagRss(bloco, tag) {
  const match = bloco.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  if (!match) return "";
  return decodeHtmlEntities(
    match[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parsearRssNoticias(xml) {
  const itens = [];
  const blocos = String(xml || "").match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const bloco of blocos) {
    const tituloBruto = extrairTagRss(bloco, "title");
    const link = extrairTagRss(bloco, "link");
    if (!tituloBruto || !link) continue;

    const sourceMatch = bloco.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const fonte = sourceMatch
      ? decodeHtmlEntities(sourceMatch[1].replace(/<[^>]+>/g, "").trim())
      : "";

    // O Google costuma anexar " - Fonte" ao título; removemos para ficar limpo.
    let titulo = tituloBruto;
    if (fonte && titulo.endsWith(` - ${fonte}`)) {
      titulo = titulo.slice(0, -(fonte.length + 3)).trim();
    }

    const pubDate = extrairTagRss(bloco, "pubDate");
    const data = pubDate ? new Date(pubDate) : null;

    itens.push({
      titulo,
      url: link,
      fonte: fonte || dominioDaUrl(link),
      publicadoEm:
        data && !Number.isNaN(data.getTime()) ? data.toISOString() : "",
    });

    if (itens.length >= 30) break;
  }

  return itens;
}

// Links do RSS do Google Notícias (news.google.com/rss/articles/...) são
// redirecionadores: não entregam o conteúdo da matéria, só apontam para o
// portal real. A análise precisa da URL do portal, então resolvemos o link
// antes de usá-lo. O Google exige duas etapas: ler a página do artigo para
// extrair assinatura/timestamp e então consultar o endpoint "batchexecute".
const GOOGLE_NEWS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const googleNewsUrlCache = new Map();

function ehUrlGoogleNews(valor) {
  try {
    const url = new URL(String(valor || "").trim());
    if (!/(^|\.)news\.google\.com$/i.test(url.hostname)) return false;
    return /\/(articles|read)\//.test(url.pathname);
  } catch (e) {
    return false;
  }
}

function idArtigoGoogleNews(valor) {
  try {
    const partes = new URL(valor).pathname.split("/");
    const i = partes.findIndex((p) => p === "articles" || p === "read");
    return i >= 0 ? partes[i + 1] || "" : "";
  } catch (e) {
    return "";
  }
}

async function resolverUrlGoogleNews(valor) {
  if (!ehUrlGoogleNews(valor)) return valor;

  const id = idArtigoGoogleNews(valor);
  if (!id) return valor;

  const emCache = googleNewsUrlCache.get(id);
  if (emCache && Date.now() - emCache.salvoEm < GOOGLE_NEWS_CACHE_TTL_MS) {
    return emCache.url;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)",
    };

    const pagina = await fetch(`https://news.google.com/articles/${id}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: { ...headers, Accept: "text/html,*/*;q=0.7" },
    });
    const html = await pagina.text();
    const assinatura = html.match(/data-n-a-sg="([^"]+)"/);
    const timestamp = html.match(/data-n-a-ts="([^"]+)"/);
    if (!assinatura || !timestamp) return valor;

    const articleReq = [
      "Fbv4je",
      JSON.stringify([
        "garturlreq",
        [
          ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null,
            null, null, null, null, 0, 1],
          "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
        ],
        id,
        Number(timestamp[1]),
        assinatura[1],
      ]),
    ];
    const body =
      "f.req=" + encodeURIComponent(JSON.stringify([[articleReq]]));

    const resposta = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      },
    );
    const texto = await resposta.text();
    const match = texto.match(/(https?:\/\/[^"\\]+)/);
    const urlReal = match ? match[1] : "";

    if (urlReal && !ehUrlGoogleNews(urlReal)) {
      googleNewsUrlCache.set(id, { url: urlReal, salvoEm: Date.now() });
      return urlReal;
    }
    return valor;
  } catch (err) {
    console.warn("[google-news] falha ao resolver link:", err.message);
    return valor;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  montarUrlRssNoticias,
  parsearRssNoticias,
  ehUrlGoogleNews,
  resolverUrlGoogleNews,
};
