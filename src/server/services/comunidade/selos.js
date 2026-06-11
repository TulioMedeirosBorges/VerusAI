// Selos/badges e resumo de contribuições do usuário ("Minha atividade",
// comunidade e selos exibidos nos comentários).
const { db } = require("../../db.js");
const { normalizarEmailUsuario } = require("../../lib/utils.js");

// Contas que recebem todos os selos automaticamente (admin/demo), independente
// das contribuições. Para liberar para outra conta, basta adicionar o e-mail.
const EMAILS_TODOS_SELOS = new Set(["tuliobmedeiros@gmail.com"]);

function emailComTodosSelos(email) {
  return EMAILS_TODOS_SELOS.has(normalizarEmailUsuario(email));
}

// Selos/badges com base nos números de contribuição. Cada selo tem uma meta;
// abaixo dela mostramos o progresso, ao atingir fica "conquistado". Com
// `todosConquistados`, todos saem como conquistados (contas de EMAILS_TODOS_SELOS).
function definirBadgesAtividade(resumo, { todosConquistados = false } = {}) {
  const defs = [
    { id: "primeiros_passos", nome: "Primeiros passos", descricao: "Fez sua primeira contribuição.", meta: 1, valor: resumo.totalContribuicoes },
    { id: "primeira_opiniao", nome: "Primeira opinião", descricao: "Escreveu seu primeiro comentário.", meta: 1, valor: resumo.comentarios },
    { id: "comentarista", nome: "Comentarista", descricao: "Escreveu 10 comentários.", meta: 10, valor: resumo.comentarios },
    { id: "voz_ativa", nome: "Voz ativa", descricao: "Escreveu 40 comentários.", meta: 40, valor: resumo.comentarios },
    { id: "comentarista_elite", nome: "Comentarista de elite", descricao: "Escreveu 100 comentários.", meta: 100, valor: resumo.comentarios },
    { id: "curador", nome: "Curador", descricao: "Avaliou 25 notícias.", meta: 25, valor: resumo.reacoesNoticias },
    { id: "curador_dedicado", nome: "Curador dedicado", descricao: "Avaliou 100 notícias.", meta: 100, valor: resumo.reacoesNoticias },
    { id: "avaliador_fontes", nome: "Olho clínico", descricao: "Avaliou 10 fontes.", meta: 10, valor: resumo.reacoesFontes },
    { id: "critico_fontes", nome: "Crítico de fontes", descricao: "Avaliou 40 fontes.", meta: 40, valor: resumo.reacoesFontes },
    { id: "guardiao", nome: "Guardião", descricao: "Denunciou 3 fontes suspeitas.", meta: 3, valor: resumo.denuncias },
    { id: "fiscal", nome: "Fiscal", descricao: "Fez 15 denúncias de fontes.", meta: 15, valor: resumo.denuncias },
    { id: "apoiador", nome: "Apoiador", descricao: "Votou em 5 comentários da comunidade.", meta: 5, valor: resumo.votosComentarios },
    { id: "engajado", nome: "Engajado", descricao: "Votou em 30 comentários.", meta: 30, valor: resumo.votosComentarios },
    { id: "querido", nome: "Voz respeitada", descricao: "Recebeu 25 curtidas em comentários.", meta: 25, valor: resumo.curtidasRecebidas },
    { id: "influente", nome: "Influente", descricao: "Recebeu 75 curtidas em comentários.", meta: 75, valor: resumo.curtidasRecebidas },
    { id: "idolo", nome: "Ídolo da comunidade", descricao: "Recebeu 150 curtidas em comentários.", meta: 150, valor: resumo.curtidasRecebidas },
    { id: "veterano", nome: "Veterano", descricao: "Acumulou 150 contribuições.", meta: 150, valor: resumo.totalContribuicoes },
    { id: "lenda", nome: "Lenda", descricao: "Acumulou 300 contribuições.", meta: 300, valor: resumo.totalContribuicoes },
  ];
  return defs.map((d) => {
    const valor = todosConquistados ? d.meta : Number(d.valor || 0);
    return {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      meta: d.meta,
      progresso: Math.min(valor, d.meta),
      conquistado: valor >= d.meta,
    };
  });
}

// Resumo de contribuições de um usuário (e-mail logado ou cliente_id anônimo).
// Usado na página "Minha atividade" e para derivar os selos exibidos nos
// comentários — assim os dois lugares mostram exatamente os mesmos selos.
function obterResumoContribuicoes(email) {
  const vazio = {
    comentarios: 0,
    reacoesNoticias: 0,
    reacoesFontes: 0,
    denuncias: 0,
    votosComentarios: 0,
    curtidasRecebidas: 0,
    totalContribuicoes: 0,
  };
  if (!email) return vazio;

  const comentarios = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM noticia_feedback
         WHERE (usuario_email = ? OR cliente_id = ?)
           AND NULLIF(TRIM(comentario), '') IS NOT NULL`,
      )
      .get(email, email)?.n || 0,
  );
  const reacoesNoticias = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM noticia_feedback
         WHERE (usuario_email = ? OR cliente_id = ?) AND reacao IN ('like', 'dislike')`,
      )
      .get(email, email)?.n || 0,
  );
  const reacoesFontes = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM fonte_feedback
         WHERE usuario_email = ? AND reacao IN ('like', 'dislike')`,
      )
      .get(email)?.n || 0,
  );
  const denuncias = Number(
    db
      .prepare("SELECT COUNT(*) AS n FROM fonte_denuncias WHERE usuario_email = ?")
      .get(email)?.n || 0,
  );
  const votosComentarios = Number(
    db
      .prepare("SELECT COUNT(*) AS n FROM comentario_votos WHERE usuario_email = ?")
      .get(email)?.n || 0,
  );
  const curtidasRecebidas = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM comentario_votos cv
         JOIN noticia_feedback nf ON nf.id = cv.comentario_id
         WHERE (nf.usuario_email = ? OR nf.cliente_id = ?) AND cv.reacao = 'like'`,
      )
      .get(email, email)?.n || 0,
  );

  const resumo = {
    comentarios,
    reacoesNoticias,
    reacoesFontes,
    denuncias,
    votosComentarios,
    curtidasRecebidas,
  };
  resumo.totalContribuicoes =
    comentarios + reacoesNoticias + reacoesFontes + denuncias + votosComentarios;
  return resumo;
}

// Selos já conquistados por um usuário, ordenados do mais difícil (maior meta)
// para o mais simples — o cliente mostra os primeiros e resume o resto em "+N".
function obterSelosUsuario(email) {
  return definirBadgesAtividade(obterResumoContribuicoes(email), {
    todosConquistados: emailComTodosSelos(email),
  })
    .filter((b) => b.conquistado)
    .sort((a, b) => b.meta - a.meta)
    .map((b) => ({ id: b.id, nome: b.nome }));
}

// Catálogo estático dos selos (id, nome, descrição, meta), derivado das defs.
function catalogoSelos() {
  return definirBadgesAtividade({
    comentarios: 0,
    reacoesNoticias: 0,
    reacoesFontes: 0,
    denuncias: 0,
    votosComentarios: 0,
    curtidasRecebidas: 0,
    totalContribuicoes: 0,
  }).map((b) => ({ id: b.id, nome: b.nome, descricao: b.descricao, meta: b.meta }));
}

module.exports = {
  emailComTodosSelos,
  definirBadgesAtividade,
  obterResumoContribuicoes,
  obterSelosUsuario,
  catalogoSelos,
};
