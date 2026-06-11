// Feedback (like/dislike + comentários) das análises de notícias.
const { db } = require("../../db.js");
const {
  normalizarEmailUsuario,
  normalizarNomeUsuario,
} = require("../../lib/utils.js");
const { obterSelosUsuario } = require("./selos.js");

function obterResumoFeedback(url) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes,
         SUM(CASE WHEN NULLIF(TRIM(comentario), '') IS NOT NULL THEN 1 ELSE 0 END) AS comentarios
       FROM noticia_feedback
       WHERE url = ?`,
    )
    .get(url);

  return {
    likes: Number(row?.likes || 0),
    dislikes: Number(row?.dislikes || 0),
    comentarios: Number(row?.comentarios || 0),
  };
}

function datasDiferentesFeedback(criadoEm, atualizadoEm) {
  if (!criadoEm || !atualizadoEm) return false;
  return String(criadoEm).slice(0, 19) !== String(atualizadoEm).slice(0, 19);
}

function montarFeedbackPublico(row, usuarioEmail = "") {
  if (!row) return null;
  const email = row.usuario_email || row.cliente_id || "";
  const proprioUsuario =
    Boolean(usuarioEmail) &&
    normalizarEmailUsuario(email) === normalizarEmailUsuario(usuarioEmail);

  return {
    id: row.id ?? null,
    reacao: row.reacao || "",
    comentario: row.comentario || "",
    usuarioNome: normalizarNomeUsuario(row.usuario_nome, email),
    proprioUsuario,
    editado: Boolean(row.editado) || datasDiferentesFeedback(row.criado_em, row.atualizado_em),
    atualizadoEm: row.atualizado_em || row.criado_em || "",
    likes: Number(row.likes || 0),
    dislikes: Number(row.dislikes || 0),
    votoUsuario:
      row.voto_usuario === "like" || row.voto_usuario === "dislike"
        ? row.voto_usuario
        : "",
  };
}

function obterFeedbackUsuario(url, usuarioEmail) {
  if (!url || !usuarioEmail) return null;
  const row = db
    .prepare(
      `SELECT cliente_id, usuario_email, usuario_nome, reacao, comentario, editado, criado_em, atualizado_em
       FROM noticia_feedback
       WHERE url = ? AND cliente_id = ?`,
    )
    .get(url, usuarioEmail);

  return montarFeedbackPublico(row, usuarioEmail);
}

function obterComentariosFeedback(url, usuarioEmail) {
  if (!url) return [];
  const rows = db
    .prepare(
      `SELECT nf.id, nf.cliente_id, nf.usuario_email, nf.usuario_nome, nf.reacao,
              nf.comentario, nf.editado, nf.criado_em, nf.atualizado_em,
              COALESCE(SUM(CASE WHEN cv.reacao = 'like' THEN 1 ELSE 0 END), 0) AS likes,
              COALESCE(SUM(CASE WHEN cv.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes,
              MAX(CASE WHEN cv.usuario_email = ? THEN cv.reacao ELSE NULL END) AS voto_usuario
       FROM noticia_feedback nf
       LEFT JOIN comentario_votos cv ON cv.comentario_id = nf.id
       WHERE nf.url = ?
         AND NULLIF(TRIM(nf.comentario), '') IS NOT NULL
       GROUP BY nf.id
       ORDER BY julianday(nf.atualizado_em) DESC, nf.id DESC
       LIMIT 50`,
    )
    .all(usuarioEmail || "", url);

  // Selos do autor de cada comentário (cacheados por usuário dentro da lista
  // para não recalcular quando alguém comentou em mais de uma análise).
  const selosCache = new Map();
  const selosDoAutor = (emailAutor) => {
    const chave = normalizarEmailUsuario(emailAutor);
    if (!selosCache.has(chave)) selosCache.set(chave, obterSelosUsuario(emailAutor));
    return selosCache.get(chave);
  };

  return rows
    .map((row) => {
      const publico = montarFeedbackPublico(row, usuarioEmail);
      if (publico) {
        publico.selos = selosDoAutor(row.usuario_email || row.cliente_id || "");
      }
      return publico;
    })
    .filter((item) => item?.comentario);
}

function obterVotosComentario(comentarioId) {
  const votos = db
    .prepare(
      `SELECT
         SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes
       FROM comentario_votos WHERE comentario_id = ?`,
    )
    .get(comentarioId);
  return {
    likes: Number(votos?.likes || 0),
    dislikes: Number(votos?.dislikes || 0),
  };
}

module.exports = {
  obterResumoFeedback,
  montarFeedbackPublico,
  obterFeedbackUsuario,
  obterComentariosFeedback,
  obterVotosComentario,
};
