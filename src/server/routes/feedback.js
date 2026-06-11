// Rotas de feedback das análises: nova informação por e-mail, like/dislike,
// comentários e votos em comentários.
const { db } = require("../db.js");
const {
  normalizarUrlPublica,
  normalizarReacaoFeedback,
  normalizarComentarioFeedback,
  normalizarNovaInformacao,
  escapeHtmlEmail,
} = require("../lib/utils.js");
const { obterSessaoUsuario } = require("../services/sessoes.js");
const { transporter, emailEmpresaDestino } = require("../lib/email.js");
const {
  obterResumoFeedback,
  obterFeedbackUsuario,
  obterComentariosFeedback,
  obterVotosComentario,
} = require("../services/comunidade/feedbackNoticias.js");

module.exports = function registrarRotasFeedback(app) {
  app.post("/api/analises/nova-informacao", async (req, res) => {
    const sessao = obterSessaoUsuario(req.body?.authToken);
    const url = String(req.body?.url || "").trim();
    const titulo = String(req.body?.titulo || "").trim().slice(0, 300);
    const mensagem = normalizarNovaInformacao(req.body?.mensagem);
    const destino = emailEmpresaDestino();

    if (!sessao) {
      return res.status(401).json({
        ok: false,
        erro: "Entre na extensão para enviar uma nova informação.",
      });
    }

    if (!url || !normalizarUrlPublica(url)) {
      return res.status(400).json({
        ok: false,
        erro: "URL obrigatória para enviar a informação.",
      });
    }

    if (mensagem.length < 10) {
      return res.status(400).json({
        ok: false,
        erro: "Descreva a nova informação com pelo menos 10 caracteres.",
      });
    }

    if (!destino || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        ok: false,
        erro: "E-mail da empresa não configurado no servidor.",
      });
    }

    try {
      const tituloEmail = titulo || url;
      await transporter.sendMail({
        from: `"VerusAI" <${process.env.EMAIL_USER}>`,
        to: destino,
        replyTo: sessao.email,
        subject: `Nova informação sobre notícia - ${tituloEmail.slice(0, 90)}`,
        text:
          `Usuário: ${sessao.nome} <${sessao.email}>\n` +
          `Notícia: ${tituloEmail}\n` +
          `URL: ${url}\n\n` +
          `Nova informação:\n${mensagem}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
            <h2>Nova informação sobre notícia</h2>
            <p><strong>Usuário:</strong> ${escapeHtmlEmail(sessao.nome)} &lt;${escapeHtmlEmail(sessao.email)}&gt;</p>
            <p><strong>Notícia:</strong> ${escapeHtmlEmail(tituloEmail)}</p>
            <p><strong>URL:</strong> <a href="${escapeHtmlEmail(url)}">${escapeHtmlEmail(url)}</a></p>
            <hr/>
            <p style="white-space:pre-wrap">${escapeHtmlEmail(mensagem)}</p>
          </div>
        `,
      });

      res.json({ ok: true, mensagem: "Informação enviada para a empresa." });
    } catch (err) {
      console.error("[/api/analises/nova-informacao] erro:", err);
      res.status(500).json({
        ok: false,
        erro: "Não foi possível enviar a informação agora.",
      });
    }
  });

  app.get("/api/analises/feedback", (req, res) => {
    const url = String(req.query.url || "").trim();
    const sessao = obterSessaoUsuario(req.query.authToken);
    const usuarioEmail = sessao?.email || "";

    if (!url || !normalizarUrlPublica(url)) {
      return res.status(400).json({
        ok: false,
        erro: "URL obrigatoria para carregar feedback.",
      });
    }

    res.json({
      ok: true,
      resumo: obterResumoFeedback(url),
      usuario: sessao ? { email: sessao.email, nome: sessao.nome } : null,
      feedback: obterFeedbackUsuario(url, usuarioEmail),
      comentarios: obterComentariosFeedback(url, usuarioEmail),
    });
  });

  app.post("/api/analises/feedback", (req, res) => {
    const url = String(req.body?.url || "").trim();
    const titulo = String(req.body?.titulo || "").trim().slice(0, 300);
    const sessao = obterSessaoUsuario(req.body?.authToken);
    const reacao = normalizarReacaoFeedback(req.body?.reacao);
    const comentario = normalizarComentarioFeedback(req.body?.comentario);

    if (!url || !normalizarUrlPublica(url)) {
      return res.status(400).json({
        ok: false,
        erro: "URL obrigatoria para salvar feedback.",
      });
    }

    if (!sessao) {
      return res.status(401).json({
        ok: false,
        erro: "Entre na extensão para salvar sua opinião.",
      });
    }

    if (!reacao && !comentario) {
      return res.status(400).json({
        ok: false,
        erro: "Escolha like ou dislike, ou escreva uma opiniao.",
      });
    }

    try {
      db.prepare(
        `INSERT INTO noticia_feedback (
           url, titulo, cliente_id, usuario_email, usuario_nome, reacao, comentario, editado
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(url, cliente_id) DO UPDATE SET
           titulo = excluded.titulo,
           usuario_email = excluded.usuario_email,
           usuario_nome = excluded.usuario_nome,
           editado = CASE
             WHEN COALESCE(noticia_feedback.reacao, '') <> COALESCE(excluded.reacao, '')
               OR COALESCE(noticia_feedback.comentario, '') <> COALESCE(excluded.comentario, '')
             THEN 1
             ELSE COALESCE(noticia_feedback.editado, 0)
           END,
           reacao = excluded.reacao,
           comentario = excluded.comentario,
           atualizado_em = strftime('%Y-%m-%d %H:%M:%f', 'now')`,
      ).run(
        url,
        titulo,
        sessao.email,
        sessao.email,
        sessao.nome,
        reacao,
        comentario,
      );

      res.json({
        ok: true,
        resumo: obterResumoFeedback(url),
        usuario: { email: sessao.email, nome: sessao.nome },
        feedback: obterFeedbackUsuario(url, sessao.email),
        comentarios: obterComentariosFeedback(url, sessao.email),
      });
    } catch (err) {
      console.error("[/api/analises/feedback] erro:", err);
      res.status(500).json({
        ok: false,
        erro: "Nao foi possivel salvar a opiniao.",
      });
    }
  });

  app.post("/api/analises/comentario/voto", (req, res) => {
    const sessao = obterSessaoUsuario(req.body?.authToken);
    const comentarioId = Number(req.body?.comentarioId);
    const reacao = normalizarReacaoFeedback(req.body?.reacao);

    if (!sessao) {
      return res.status(401).json({
        ok: false,
        erro: "Entre na extensão para avaliar um comentário.",
      });
    }
    if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
      return res.status(400).json({ ok: false, erro: "Comentário inválido." });
    }
    if (!reacao) {
      return res
        .status(400)
        .json({ ok: false, erro: "Escolha like ou dislike." });
    }

    const comentario = db
      .prepare("SELECT id FROM noticia_feedback WHERE id = ?")
      .get(comentarioId);
    if (!comentario) {
      return res
        .status(404)
        .json({ ok: false, erro: "Comentário não encontrado." });
    }

    try {
      const existente = db
        .prepare(
          "SELECT reacao FROM comentario_votos WHERE comentario_id = ? AND usuario_email = ?",
        )
        .get(comentarioId, sessao.email);

      let votoUsuario = reacao;
      if (existente && existente.reacao === reacao) {
        // Clicar de novo na mesma reação remove o voto (toggle).
        db.prepare(
          "DELETE FROM comentario_votos WHERE comentario_id = ? AND usuario_email = ?",
        ).run(comentarioId, sessao.email);
        votoUsuario = "";
      } else {
        db.prepare(
          `INSERT INTO comentario_votos (comentario_id, usuario_email, reacao)
           VALUES (?, ?, ?)
           ON CONFLICT(comentario_id, usuario_email) DO UPDATE SET
             reacao = excluded.reacao,
             atualizado_em = CURRENT_TIMESTAMP`,
        ).run(comentarioId, sessao.email, reacao);
      }

      res.json({
        ok: true,
        comentarioId,
        votoUsuario,
        ...obterVotosComentario(comentarioId),
      });
    } catch (err) {
      console.error("[/api/analises/comentario/voto] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível avaliar o comentário." });
    }
  });
};
