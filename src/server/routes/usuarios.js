// Rotas de usuários: "Minha atividade", estatísticas para o dashboard,
// comunidade (ranking/selos/atividade recente) e denúncia de usuário.
const { db } = require("../db.js");
const {
  normalizarEmailUsuario,
  normalizarNomeUsuario,
  normalizarComentarioFeedback,
  escapeHtmlEmail,
} = require("../lib/utils.js");
const { obterSessaoUsuario } = require("../services/sessoes.js");
const { transporter, emailEmpresaDestino } = require("../lib/email.js");
const {
  emailComTodosSelos,
  definirBadgesAtividade,
  obterResumoContribuicoes,
  obterSelosUsuario,
  catalogoSelos,
} = require("../services/comunidade/selos.js");
const {
  normalizarMotivoDenunciaUsuario,
} = require("../services/comunidade/fontesComunidade.js");

let _comunidadeCache = null;
let _comunidadeCacheTs = 0;
const COMUNIDADE_CACHE_TTL_MS = 30 * 1000;

module.exports = function registrarRotasUsuarios(app) {
  app.get("/api/usuario/atividade", (req, res) => {
    const sessao = obterSessaoUsuario(req.query.authToken);
    if (!sessao) {
      return res
        .status(401)
        .json({ ok: false, erro: "Entre pela extensão para ver sua atividade." });
    }
    const email = sessao.email;

    try {
      // Comentários em notícias (com título da análise e curtidas recebidas).
      const comentariosRows = db
        .prepare(
          `SELECT nf.url, nf.comentario, nf.reacao, nf.atualizado_em,
                  COALESCE(NULLIF(ca.titulo, ''), NULLIF(nf.titulo, ''), nf.url) AS titulo,
                  COALESCE(SUM(CASE WHEN cv.reacao = 'like' THEN 1 ELSE 0 END), 0) AS likes,
                  COALESCE(SUM(CASE WHEN cv.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes
           FROM noticia_feedback nf
           LEFT JOIN cache_analises ca ON ca.url = nf.url
           LEFT JOIN comentario_votos cv ON cv.comentario_id = nf.id
           WHERE (nf.usuario_email = ? OR nf.cliente_id = ?)
             AND NULLIF(TRIM(nf.comentario), '') IS NOT NULL
           GROUP BY nf.id
           ORDER BY julianday(nf.atualizado_em) DESC
           LIMIT 50`,
        )
        .all(email, email);

      const fontesRows = db
        .prepare(
          `SELECT dominio, reacao, atualizado_em FROM fonte_feedback
           WHERE usuario_email = ? AND reacao IN ('like', 'dislike')
           ORDER BY julianday(atualizado_em) DESC LIMIT 50`,
        )
        .all(email);

      const denunciasRows = db
        .prepare(
          `SELECT dominio, motivo, comentario, criado_em FROM fonte_denuncias
           WHERE usuario_email = ?
           ORDER BY julianday(criado_em) DESC LIMIT 50`,
        )
        .all(email);

      const resumo = obterResumoContribuicoes(email);

      res.json({
        ok: true,
        usuario: { email: sessao.email, nome: sessao.nome },
        resumo,
        badges: definirBadgesAtividade(resumo, {
          todosConquistados: emailComTodosSelos(email),
        }),
        comentarios: comentariosRows.map((r) => ({
          url: r.url,
          titulo: r.titulo,
          comentario: r.comentario,
          reacao: r.reacao || "",
          data: r.atualizado_em,
          likes: Number(r.likes || 0),
          dislikes: Number(r.dislikes || 0),
        })),
        fontesAvaliadas: fontesRows.map((r) => ({
          dominio: r.dominio,
          reacao: r.reacao,
          data: r.atualizado_em,
        })),
        denuncias: denunciasRows.map((r) => ({
          dominio: r.dominio,
          motivo: r.motivo,
          comentario: r.comentario,
          data: r.criado_em,
        })),
      });
    } catch (err) {
      console.error("[/api/usuario/atividade] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível carregar sua atividade." });
    }
  });

  // Estatísticas de usuários para o Dashboard: total de cadastrados e quem já
  // realizou análises (contagem distinta + nomes), público.
  app.get("/api/usuarios/estatisticas", (req, res) => {
    try {
      const totalUsuarios = Number(
        db.prepare("SELECT COUNT(*) AS n FROM usuarios").get()?.n || 0,
      );
      const totalAnalises = Number(
        db.prepare("SELECT COUNT(*) AS n FROM cache_analises").get()?.n || 0,
      );

      const rows = db
        .prepare(
          `SELECT aa.email,
                  COALESCE(NULLIF(u.nome, ''), '') AS nome_conta,
                  MAX(aa.nome) AS nome_analise,
                  COUNT(*) AS total,
                  MAX(aa.criado_em) AS ultima
           FROM analise_autores aa
           LEFT JOIN usuarios u ON lower(u.email) = lower(aa.email)
           GROUP BY lower(aa.email)
           ORDER BY total DESC, ultima DESC
           LIMIT 100`,
        )
        .all();

      const analistas = rows.map((r) => ({
        nome: normalizarNomeUsuario(r.nome_conta || r.nome_analise, r.email),
        total: Number(r.total || 0),
        ultima: r.ultima || "",
      }));

      res.json({
        ok: true,
        totalUsuarios,
        totalAnalises,
        totalAnalistas: analistas.length,
        analistas,
      });
    } catch (err) {
      console.error("[/api/usuarios/estatisticas] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível carregar as estatísticas." });
    }
  });

  // ── COMUNIDADE: ranking de engajamento, catálogo de selos e atividade ──────
  app.get("/api/comunidade", (req, res) => {
    try {
      if (
        _comunidadeCache &&
        Date.now() - _comunidadeCacheTs < COMUNIDADE_CACHE_TTL_MS
      ) {
        return res.json(_comunidadeCache);
      }

      const totalMembros = Number(
        db.prepare("SELECT COUNT(*) AS n FROM usuarios").get()?.n || 0,
      );

      // Ranking: para cada usuário registrado, calcula engajamento e selos.
      const usuarios = db.prepare("SELECT email, nome FROM usuarios").all();
      const ranking = usuarios
        .map((u) => {
          const resumo = obterResumoContribuicoes(u.email);
          const selos = definirBadgesAtividade(resumo, {
            todosConquistados: emailComTodosSelos(u.email),
          })
            .filter((b) => b.conquistado)
            .sort((a, b) => b.meta - a.meta)
            .map((b) => ({ id: b.id, nome: b.nome }));
          return {
            nome: normalizarNomeUsuario(u.nome, u.email),
            selos,
            totalSelos: selos.length,
            // Pontos de engajamento: cada contribuição vale 1; curtida recebida, 2.
            pontos: resumo.totalContribuicoes + resumo.curtidasRecebidas * 2,
            comentarios: resumo.comentarios,
            curtidasRecebidas: resumo.curtidasRecebidas,
          };
        })
        .filter((m) => m.pontos > 0 || m.totalSelos > 0)
        .sort((a, b) => b.pontos - a.pontos || b.totalSelos - a.totalSelos)
        .slice(0, 12);

      // Atividade recente: últimos comentários em qualquer análise.
      const recentes = db
        .prepare(
          `SELECT nf.usuario_email, nf.cliente_id, nf.usuario_nome, nf.comentario,
                  nf.atualizado_em, nf.url,
                  COALESCE(NULLIF(ca.titulo, ''), NULLIF(nf.titulo, ''), nf.url) AS titulo
           FROM noticia_feedback nf
           LEFT JOIN cache_analises ca ON ca.url = nf.url
           WHERE NULLIF(TRIM(nf.comentario), '') IS NOT NULL
           ORDER BY julianday(nf.atualizado_em) DESC
           LIMIT 8`,
        )
        .all();

      const selosCache = new Map();
      const selosDe = (email) => {
        const chave = normalizarEmailUsuario(email);
        if (!selosCache.has(chave)) selosCache.set(chave, obterSelosUsuario(email));
        return selosCache.get(chave);
      };

      const atividade = recentes.map((r) => {
        const email = r.usuario_email || r.cliente_id || "";
        return {
          nome: normalizarNomeUsuario(r.usuario_nome, email),
          selos: selosDe(email),
          comentario: String(r.comentario || "").slice(0, 240),
          titulo: r.titulo,
          url: r.url,
          data: r.atualizado_em,
        };
      });

      const payload = {
        ok: true,
        totalMembros,
        ranking,
        catalogo: catalogoSelos(),
        atividade,
      };
      _comunidadeCache = payload;
      _comunidadeCacheTs = Date.now();
      res.json(payload);
    } catch (err) {
      console.error("[/api/comunidade] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível carregar a comunidade." });
    }
  });

  // Denúncia de um usuário a partir de um comentário dele.
  app.post("/api/usuarios/denuncia", (req, res) => {
    const sessao = obterSessaoUsuario(req.body?.authToken);
    const comentarioId = Number(req.body?.comentarioId);
    const motivo = normalizarMotivoDenunciaUsuario(req.body?.motivo);
    const comentario = normalizarComentarioFeedback(req.body?.comentario);

    if (!sessao) {
      return res.status(401).json({
        ok: false,
        erro: "Entre na extensão para denunciar um usuário.",
      });
    }
    if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
      return res.status(400).json({ ok: false, erro: "Comentário inválido." });
    }
    if (!motivo) {
      return res
        .status(400)
        .json({ ok: false, erro: "Selecione um motivo para a denúncia." });
    }

    const alvo = db
      .prepare(
        "SELECT usuario_email, cliente_id, usuario_nome FROM noticia_feedback WHERE id = ?",
      )
      .get(comentarioId);
    if (!alvo) {
      return res.status(404).json({ ok: false, erro: "Comentário não encontrado." });
    }

    const denunciadoEmail = alvo.usuario_email || alvo.cliente_id || "";
    const denunciadoNome = normalizarNomeUsuario(alvo.usuario_nome, denunciadoEmail);

    if (
      normalizarEmailUsuario(denunciadoEmail) === normalizarEmailUsuario(sessao.email)
    ) {
      return res
        .status(400)
        .json({ ok: false, erro: "Você não pode denunciar a si mesmo." });
    }

    try {
      db.prepare(
        `INSERT INTO usuario_denuncias
           (comentario_id, denunciado_email, denunciado_nome, usuario_email, usuario_nome, motivo, comentario)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(comentario_id, usuario_email) DO UPDATE SET
           motivo = excluded.motivo,
           comentario = excluded.comentario,
           denunciado_email = excluded.denunciado_email,
           denunciado_nome = excluded.denunciado_nome,
           atualizado_em = CURRENT_TIMESTAMP`,
      ).run(
        comentarioId,
        denunciadoEmail,
        denunciadoNome,
        sessao.email,
        sessao.nome,
        motivo,
        comentario,
      );

      // Notifica a empresa por e-mail (best-effort, não bloqueia a denúncia).
      const destino = emailEmpresaDestino();
      if (destino && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter
          .sendMail({
            from: `"VerusAI" <${process.env.EMAIL_USER}>`,
            to: destino,
            replyTo: sessao.email,
            subject: `Denúncia de usuário - ${denunciadoNome || denunciadoEmail}`,
            text:
              `Denunciante: ${sessao.nome} <${sessao.email}>\n` +
              `Usuário denunciado: ${denunciadoNome} <${denunciadoEmail}>\n` +
              `Comentário #${comentarioId}\n` +
              `Motivo: ${motivo}\n\n` +
              `Detalhes:\n${comentario || "(sem detalhes)"}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
                <h2>Denúncia de usuário</h2>
                <p><strong>Denunciante:</strong> ${escapeHtmlEmail(sessao.nome)} &lt;${escapeHtmlEmail(sessao.email)}&gt;</p>
                <p><strong>Usuário denunciado:</strong> ${escapeHtmlEmail(denunciadoNome)} &lt;${escapeHtmlEmail(denunciadoEmail)}&gt;</p>
                <p><strong>Comentário:</strong> #${comentarioId}</p>
                <p><strong>Motivo:</strong> ${escapeHtmlEmail(motivo)}</p>
                <hr/>
                <p style="white-space:pre-wrap">${escapeHtmlEmail(comentario || "(sem detalhes)")}</p>
              </div>
            `,
          })
          .catch((err) =>
            console.warn("[/api/usuarios/denuncia] e-mail ignorado:", err.message),
          );
      }

      res.json({ ok: true, mensagem: "Denúncia registrada. Obrigado por ajudar." });
    } catch (err) {
      console.error("[/api/usuarios/denuncia] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível registrar a denúncia." });
    }
  });
};
