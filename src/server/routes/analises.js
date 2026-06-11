// Rotas públicas das análises salvas: listagem com filtros, mais curtidas,
// trending da semana, detalhe, lookup por URLs e remoção (admin).
const { db } = require("../db.js");
const { montarAnalisePublica } = require("../services/analises/analisePublica.js");

// Recebe uma lista de URLs (links de uma página) e retorna quais já têm
// análise salva no cache, com veredito e score — usado pela extensão para
// marcar na página os links de notícias já checadas pelo VerusAI.
function normalizarUrlComparavel(value) {
  try {
    const u = new URL(String(value || "").trim());
    if (!/^https?:$/i.test(u.protocol)) return "";
    u.hash = "";
    let s = (
      u.protocol +
      "//" +
      u.hostname.replace(/^www\./i, "") +
      u.pathname +
      u.search
    ).toLowerCase();
    return s.replace(/\/$/, "");
  } catch (e) {
    return "";
  }
}

module.exports = function registrarRotasAnalises(app) {
  app.get("/api/analises", (req, res) => {
    const { pagina = 1, busca = "", veredicto = "" } = req.query;
    const limite = Math.max(
      1,
      Math.min(500, parseInt(req.query.limite, 10) || 12),
    );
    const offset = (Math.max(1, parseInt(pagina, 10) || 1) - 1) * limite;
    let where = "WHERE 1=1";
    const params = [];
    if (busca) {
      where += " AND (ca.url LIKE ? OR ca.titulo LIKE ?)";
      params.push(`%${busca}%`, `%${busca}%`);
    }
    if (veredicto) {
      where += " AND ca.veredicto = ?";
      params.push(veredicto);
    }
    const total = db
      .prepare(`SELECT COUNT(*) as n FROM cache_analises ca ${where}`)
      .get(...params).n;
    const rows = db
      .prepare(
        `SELECT ca.url, ca.titulo, ca.veredicto, ca.score, ca.fontes_consultadas,
                ca.entidades, ca.resultado, ca.criado_em,
                COALESCE(SUM(CASE WHEN nf.reacao = 'like' THEN 1 ELSE 0 END), 0) AS total_likes,
                COALESCE(SUM(CASE WHEN nf.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS total_dislikes
         FROM cache_analises ca
         LEFT JOIN noticia_feedback nf ON ca.url = nf.url
         ${where}
         GROUP BY ca.url
         ORDER BY ca.criado_em DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limite, offset);
    res.json({
      total,
      paginas: Math.ceil(total / limite),
      analises: rows.map((row) => montarAnalisePublica(row, false)),
    });
  });

  app.get("/api/analises/mais-curtidas", (req, res) => {
    const limite = Math.max(1, Math.min(10, parseInt(req.query.limite, 10) || 1));
    const rows = db
      .prepare(
        `SELECT ca.url, ca.titulo, ca.veredicto, ca.score,
                ca.fontes_consultadas, ca.entidades, ca.resultado, ca.criado_em,
                COALESCE(SUM(CASE WHEN nf.reacao = 'like' THEN 1 ELSE 0 END), 0) AS total_likes
         FROM cache_analises ca
         LEFT JOIN noticia_feedback nf ON ca.url = nf.url
         GROUP BY ca.url
         HAVING total_likes > 0
         ORDER BY total_likes DESC, ca.criado_em DESC
         LIMIT ?`,
      )
      .all(limite);
    res.json({
      analises: rows.map((row) => ({
        ...montarAnalisePublica(row, false),
        total_likes: Number(row.total_likes),
      })),
    });
  });

  // "Mais checadas da semana": destaque editorial das checagens mais relevantes
  // do período — prioriza conteúdo sinalizado (falso/misto), ordenado pelo
  // engajamento (curtidas + descurtidas + comentários) e pela data. Se a janela
  // recente estiver vazia, amplia para todo o histórico para nunca ficar vazio.
  app.get("/api/analises/trending", (req, res) => {
    const limite = Math.max(1, Math.min(12, parseInt(req.query.limite, 10) || 4));
    const dias = Math.max(1, Math.min(90, parseInt(req.query.dias, 10) || 7));

    const buscar = (comJanela) =>
      db
        .prepare(
          `SELECT ca.url, ca.titulo, ca.veredicto, ca.score, ca.verificacoes,
                  ca.fontes_consultadas, ca.entidades, ca.resultado, ca.criado_em,
                  COALESCE(SUM(CASE WHEN nf.reacao = 'like' THEN 1 ELSE 0 END), 0) AS total_likes,
                  COALESCE(SUM(CASE WHEN nf.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS total_dislikes,
                  COALESCE(SUM(CASE WHEN NULLIF(TRIM(nf.comentario), '') IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_comentarios
           FROM cache_analises ca
           LEFT JOIN noticia_feedback nf ON ca.url = nf.url
           WHERE ca.veredicto IN ('false', 'mixed')
             ${comJanela ? "AND julianday(ca.criado_em) >= julianday('now', ?)" : ""}
           GROUP BY ca.url
           ORDER BY (total_likes + total_dislikes + total_comentarios) DESC,
                    CASE ca.veredicto WHEN 'false' THEN 0 ELSE 1 END,
                    ca.criado_em DESC
           LIMIT ?`,
        )
        .all(...(comJanela ? [`-${dias} days`, limite] : [limite]));

    let rows = buscar(true);
    let escopo = "semana";
    if (!rows.length) {
      rows = buscar(false);
      escopo = "geral";
    }

    res.json({
      escopo,
      periodoDias: dias,
      analises: rows.map((row) => ({
        ...montarAnalisePublica(row, false),
        total_likes: Number(row.total_likes),
        total_dislikes: Number(row.total_dislikes),
        total_comentarios: Number(row.total_comentarios),
        interacoes:
          Number(row.total_likes) +
          Number(row.total_dislikes) +
          Number(row.total_comentarios),
      })),
    });
  });

  app.get("/api/analises/detalhe", (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ erro: "URL obrigatória" });
    const row = db
      .prepare(
        "SELECT url, titulo, veredicto, score, fontes_consultadas, entidades, resultado, criado_em FROM cache_analises WHERE url = ?",
      )
      .get(url);
    if (!row) return res.status(404).json({ erro: "Não encontrada" });
    const analise = montarAnalisePublica(row, true);
    res.json({
      analise,
      resultado: analise.resultado,
      criado_em: row.criado_em,
    });
  });

  app.post("/api/analises/por-urls", (req, res) => {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
    const pedido = new Set(
      urls.map(normalizarUrlComparavel).filter(Boolean).slice(0, 400),
    );
    if (!pedido.size) return res.json({ ok: true, analises: [] });

    const rows = db
      .prepare("SELECT url, titulo, veredicto, score FROM cache_analises")
      .all();

    const analises = [];
    const vistos = new Set();
    for (const row of rows) {
      const norm = normalizarUrlComparavel(row.url);
      if (!norm || !pedido.has(norm) || vistos.has(norm)) continue;
      vistos.add(norm);
      analises.push({
        url: row.url,
        urlNorm: norm,
        titulo: row.titulo || "",
        veredito: row.veredicto || "",
        score: row.score ?? null,
      });
    }

    res.json({ ok: true, analises });
  });

  app.delete("/api/analises", (req, res) => {
    const { url, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY)
      return res.status(403).json({ erro: "Não autorizado" });
    db.prepare("DELETE FROM cache_analises WHERE url = ?").run(url);
    res.json({ mensagem: "Removida" });
  });
};
