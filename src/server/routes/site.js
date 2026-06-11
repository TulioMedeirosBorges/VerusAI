// Rotas do site estático: assets, página inicial com meta tags Open Graph por
// análise (preview rico ao compartilhar link), preview de links e proxy de HTML.
const express = require("express");
const path = require("path");
const fs = require("fs");
const { db } = require("../db.js");
const { normalizarUrlPublica, escapeHtmlEmail } = require("../lib/utils.js");
const { montarAnalisePublica } = require("../services/analises/analisePublica.js");
const {
  ehUrlGoogleNews,
  resolverUrlGoogleNews,
} = require("../services/integracoes/googleNews.js");
const {
  extractLinkPreviewMeta,
  normalizarUrlPreview,
  buildPublicLinkPreview,
} = require("../services/integracoes/linkPreview.js");

// ── Open Graph por análise ───────────────────────────────────────────────────
// Quando um link é compartilhado (ex.: /site/?analisar=<url>&run=1), crawlers do
// WhatsApp/X não executam JS — leem só o HTML inicial. Aqui, se a URL já tem uma
// análise no cache, injetamos meta tags OG com título, veredito e score para o
// link virar um card rico. Caso contrário, segue para o index.html estático.
const INDEX_HTML_PATH = path.join(__dirname, "../../../public/index.html");
let indexHtmlCache = null;

function lerIndexHtml() {
  if (indexHtmlCache == null) {
    indexHtmlCache = fs.readFileSync(INDEX_HTML_PATH, "utf8");
  }
  return indexHtmlCache;
}

function rotuloVereditoPublico(veredito) {
  if (veredito === "true") return "Verdadeiro";
  if (veredito === "false") return "Falso";
  return "Parcial";
}

function montarMetaTagsOg(analise, urlCompartilhada, base) {
  const titulo = (analise.titulo || "Análise de notícia").trim();
  const rotulo = rotuloVereditoPublico(analise.veredito);
  const score = Number.isFinite(Number(analise.score))
    ? `${Number(analise.score)}/100`
    : "";
  const cabecalho = [
    `Veredito: ${rotulo}`,
    score ? `Confiabilidade ${score}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const resumo = String(analise.resumo || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const descricao = [cabecalho, resumo].filter(Boolean).join(". ");
  const ogTitulo = `${titulo} — VerusAI`;
  const imagem = `${base}/assets/icons/IconVerusAi.png`;

  const e = escapeHtmlEmail;
  return [
    `<title>${e(ogTitulo)}</title>`,
    `<meta name="description" content="${e(descricao)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="VerusAI" />`,
    `<meta property="og:title" content="${e(ogTitulo)}" />`,
    `<meta property="og:description" content="${e(descricao)}" />`,
    `<meta property="og:url" content="${e(urlCompartilhada)}" />`,
    `<meta property="og:image" content="${e(imagem)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(ogTitulo)}" />`,
    `<meta name="twitter:description" content="${e(descricao)}" />`,
    `<meta name="twitter:image" content="${e(imagem)}" />`,
  ].join("\n    ");
}

module.exports = function registrarRotasSite(app) {
  app.use("/assets", express.static(path.join(__dirname, "../../../assets")));

  app.get(["/site", "/site/", "/site/index.html"], async (req, res, next) => {
    let alvo = normalizarUrlPublica(req.query.analisar);
    if (!alvo) return next();

    try {
      let row = db
        .prepare("SELECT * FROM cache_analises WHERE url = ?")
        .get(alvo);

      // Links do "Ao Vivo" chegam como redirecionador do Google Notícias; o cache
      // guarda a URL real do portal, então resolvemos antes de procurar.
      if (!row && ehUrlGoogleNews(alvo)) {
        const resolvido = await resolverUrlGoogleNews(alvo);
        if (resolvido !== alvo) {
          row = db
            .prepare("SELECT * FROM cache_analises WHERE url = ?")
            .get(resolvido);
        }
      }

      if (!row) return next();

      const analise = montarAnalisePublica(row);
      const base = `${req.protocol}://${req.get("host")}`;
      const urlCompartilhada = `${base}${req.originalUrl}`;
      const metas = montarMetaTagsOg(analise, urlCompartilhada, base);

      const html = lerIndexHtml().replace(
        /<title>[\s\S]*?<\/title>/i,
        metas,
      );

      res.set("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err) {
      console.warn("[og] falha ao montar preview:", err.message);
      return next();
    }
  });

  app.use("/site", express.static(path.join(__dirname, "../../../public")));

  app.get("/api/link-preview", async (req, res) => {
    const url = normalizarUrlPreview(req.query.url);

    if (!url) {
      return res.status(400).json({
        ok: false,
        erro: "URL invalida para preview.",
      });
    }

    try {
      const data = await buildPublicLinkPreview(url);
      return res.json({ ok: true, data });
    } catch (err) {
      console.warn("[/api/link-preview] erro:", err.message);
      return res.json({
        ok: false,
        erro: err.message || "Nao foi possivel carregar o preview.",
        data: extractLinkPreviewMeta("", url),
      });
    }
  });

  // Proxy de HTML para a análise por link no site (evita CORS no navegador).
  // O site baixa o HTML por aqui, parseia com DOMParser e monta o pageData.
  app.get("/api/fetch-html", async (req, res) => {
    const url = normalizarUrlPreview(req.query.url);

    if (!url) {
      return res.status(400).json({ ok: false, erro: "URL invalida." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const resposta = await fetch(url, {
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

      const contentType = resposta.headers.get("content-type") || "";
      const finalUrl = resposta.url || url;

      if (!contentType.includes("text/html")) {
        return res.status(415).json({
          ok: false,
          erro: "O link nao retornou uma pagina HTML para analise.",
          finalUrl,
        });
      }

      const html = await resposta.text();
      return res.json({ ok: true, url: finalUrl, html: html.slice(0, 3000000) });
    } catch (err) {
      console.warn("[/api/fetch-html] erro:", err.message);
      return res.status(502).json({
        ok: false,
        erro: "Nao foi possivel baixar a pagina deste link.",
      });
    } finally {
      clearTimeout(timeout);
    }
  });
};
