// Rotas do chat de notícias (pergunta à IA + histórico por usuário).
const { db } = require("../db.js");
const { normalizarEmailUsuario } = require("../lib/utils.js");
const {
  responderChatNoticias: responderChatNoticiasAI,
} = require("../services/ai-services/chatNoticias.js");

module.exports = function registrarRotasChat(app) {
  app.post("/chat/noticias", async (req, res) => {
    try {
      const pergunta = String(req.body?.pergunta || "").trim();
      const page =
        req.body?.page && typeof req.body.page === "object" ? req.body.page : {};
      const email = normalizarEmailUsuario(req.body?.email);

      if (!pergunta) {
        return res.status(400).json({
          ok: false,
          erro: "Pergunta obrigatoria.",
        });
      }

      const resposta = await responderChatNoticiasAI({ pergunta });
      let id = null;

      if (email) {
        const insert = db
          .prepare(
            `INSERT INTO chat_historico (email, url, titulo, pergunta, resposta)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(email, page.url || "", page.title || "", pergunta, resposta);
        id = insert.lastInsertRowid;
      }

      return res.json({
        ok: true,
        id,
        resposta,
        escopo: "noticias",
        criado_em: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[/chat/noticias] erro:", err);
      return res.status(500).json({
        ok: false,
        erro: err.message || "Erro interno no chat de noticias.",
      });
    }
  });

  app.get("/chat/historico", (req, res) => {
    const email = normalizarEmailUsuario(req.query.email);
    const limite = Math.max(
      1,
      Math.min(100, parseInt(req.query.limite, 10) || 50),
    );

    if (!email) {
      return res.status(400).json({ ok: false, erro: "E-mail obrigatorio." });
    }

    const historico = db
      .prepare(
        `SELECT id, email, url, titulo, pergunta, resposta, criado_em
         FROM chat_historico
         WHERE email = ?
         ORDER BY criado_em DESC
         LIMIT ?`,
      )
      .all(email, limite);

    res.json({ ok: true, historico });
  });

  app.delete("/chat/historico", (req, res) => {
    const email = normalizarEmailUsuario(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, erro: "E-mail obrigatorio." });
    }

    db.prepare("DELETE FROM chat_historico WHERE email = ?").run(email);
    res.json({ ok: true, mensagem: "Historico removido." });
  });
};
