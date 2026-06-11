// Rotas do ranking/denúncia de fontes (veículos de notícia).
const { db } = require("../db.js");
const {
  dominioDaUrl,
  normalizarReacaoFeedback,
  normalizarComentarioFeedback,
  escapeHtmlEmail,
} = require("../lib/utils.js");
const { obterSessaoUsuario } = require("../services/sessoes.js");
const { transporter, emailEmpresaDestino } = require("../lib/email.js");
const {
  FONTES_NOTICIA_CONHECIDAS,
  FAMA_FONTE,
  ehDominioNaoNoticia,
  normalizarDominioFonte,
  normalizarMotivoDenuncia,
  obterResumoFonte,
} = require("../services/comunidade/fontesComunidade.js");

module.exports = function registrarRotasFontes(app) {
  app.get("/api/fontes", (req, res) => {
    const sessao = obterSessaoUsuario(req.query.authToken);
    const usuarioEmail = sessao?.email || "";

    // 1. Agrega as análises por domínio (veículo de notícia).
    const rows = db
      .prepare("SELECT url, veredicto, score FROM cache_analises")
      .all();
    const mapa = new Map();
    function garantirFonte(dominio) {
      if (!mapa.has(dominio)) {
        mapa.set(dominio, {
          dominio,
          totalAnalises: 0,
          verdadeiras: 0,
          falsas: 0,
          mistas: 0,
          somaScore: 0,
        });
      }
      return mapa.get(dominio);
    }

    rows.forEach((row) => {
      const dominio = dominioDaUrl(row.url);
      if (!dominio || ehDominioNaoNoticia(dominio)) return;
      const fonte = garantirFonte(dominio);
      fonte.totalAnalises += 1;
      if (row.veredicto === "true") fonte.verdadeiras += 1;
      else if (row.veredicto === "false") fonte.falsas += 1;
      else fonte.mistas += 1;
      fonte.somaScore += Number(row.score || 0);
    });

    // Semeia o ranking com veículos de notícia conhecidos (mesmo sem análise).
    FONTES_NOTICIA_CONHECIDAS.forEach((dominio) => {
      if (!ehDominioNaoNoticia(dominio)) garantirFonte(dominio);
    });

    // 2. Likes / dislikes por domínio.
    const votosMapa = new Map();
    db.prepare(
      `SELECT dominio,
         SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes
       FROM fonte_feedback GROUP BY dominio`,
    )
      .all()
      .forEach((v) => votosMapa.set(v.dominio, v));

    // 3. Denúncias por domínio.
    const denunciaMapa = new Map();
    db.prepare(
      "SELECT dominio, COUNT(*) AS total FROM fonte_denuncias GROUP BY dominio",
    )
      .all()
      .forEach((d) => denunciaMapa.set(d.dominio, Number(d.total || 0)));

    // 4. Reação do usuário logado (se houver).
    const reacoesUsuario = new Map();
    if (usuarioEmail) {
      db.prepare(
        "SELECT dominio, reacao FROM fonte_feedback WHERE usuario_email = ?",
      )
        .all(usuarioEmail)
        .forEach((m) => reacoesUsuario.set(m.dominio, m.reacao));
    }

    // Inclui domínios que só têm votos/denúncias (sem análise no cache).
    votosMapa.forEach((_, dominio) => {
      if (!ehDominioNaoNoticia(dominio)) garantirFonte(dominio);
    });
    denunciaMapa.forEach((_, dominio) => {
      if (!ehDominioNaoNoticia(dominio)) garantirFonte(dominio);
    });

    const fontes = Array.from(mapa.values()).map((fonte) => {
      const votos = votosMapa.get(fonte.dominio) || {};
      const likes = Number(votos.likes || 0);
      const dislikes = Number(votos.dislikes || 0);
      return {
        dominio: fonte.dominio,
        analisada: fonte.totalAnalises > 0,
        totalAnalises: fonte.totalAnalises,
        verdadeiras: fonte.verdadeiras,
        falsas: fonte.falsas,
        mistas: fonte.mistas,
        mediaScore: fonte.totalAnalises
          ? Math.round(fonte.somaScore / fonte.totalAnalises)
          : 0,
        likes,
        dislikes,
        saldo: likes - dislikes,
        fama: FAMA_FONTE.has(fonte.dominio) ? FAMA_FONTE.get(fonte.dominio) : 999,
        denuncias: Number(denunciaMapa.get(fonte.dominio) || 0),
        reacaoUsuario: reacoesUsuario.get(fonte.dominio) || "",
      };
    });

    // Ranking por saldo de likes/dislikes; sem votos, ordena por fama/popularidade.
    fontes.sort(
      (a, b) =>
        b.saldo - a.saldo ||
        b.likes - a.likes ||
        Number(b.analisada) - Number(a.analisada) ||
        b.totalAnalises - a.totalAnalises ||
        a.fama - b.fama ||
        a.dominio.localeCompare(b.dominio),
    );

    res.json({
      ok: true,
      usuario: sessao ? { email: sessao.email, nome: sessao.nome } : null,
      fontes,
    });
  });

  // Resumo de UMA fonte (usado pelo selo da extensão ao visitar um site).
  app.get("/api/fontes/uma", (req, res) => {
    const sessao = obterSessaoUsuario(req.query.authToken);
    const dominio = normalizarDominioFonte(req.query.dominio);

    if (!dominio || ehDominioNaoNoticia(dominio)) {
      return res.json({ ok: true, noRanking: false, dominio: dominio || "" });
    }

    let totalAnalises = 0;
    db.prepare("SELECT url FROM cache_analises")
      .all()
      .forEach((row) => {
        if (dominioDaUrl(row.url) === dominio) totalAnalises += 1;
      });

    const resumo = obterResumoFonte(dominio);
    const conhecida = FAMA_FONTE.has(dominio);
    const noRanking =
      conhecida ||
      totalAnalises > 0 ||
      resumo.likes > 0 ||
      resumo.dislikes > 0 ||
      resumo.denuncias > 0;

    let reacaoUsuario = "";
    if (sessao) {
      const row = db
        .prepare(
          "SELECT reacao FROM fonte_feedback WHERE dominio = ? AND usuario_email = ?",
        )
        .get(dominio, sessao.email);
      reacaoUsuario = row?.reacao || "";
    }

    res.json({
      ok: true,
      noRanking,
      dominio,
      analisada: totalAnalises > 0,
      totalAnalises,
      likes: resumo.likes,
      dislikes: resumo.dislikes,
      denuncias: resumo.denuncias,
      reacaoUsuario,
      logado: Boolean(sessao),
    });
  });

  app.post("/api/fontes/voto", (req, res) => {
    const sessao = obterSessaoUsuario(req.body?.authToken);
    const dominio = normalizarDominioFonte(req.body?.dominio);
    const reacao = normalizarReacaoFeedback(req.body?.reacao);

    if (!sessao) {
      return res.status(401).json({
        ok: false,
        erro: "Entre na extensão para avaliar uma fonte.",
      });
    }
    if (!dominio) {
      return res.status(400).json({ ok: false, erro: "Fonte inválida." });
    }
    if (!reacao) {
      return res
        .status(400)
        .json({ ok: false, erro: "Escolha like ou dislike." });
    }

    try {
      const existente = db
        .prepare(
          "SELECT reacao FROM fonte_feedback WHERE dominio = ? AND usuario_email = ?",
        )
        .get(dominio, sessao.email);

      let reacaoUsuario = reacao;
      if (existente && existente.reacao === reacao) {
        // Clicar de novo na mesma reação remove o voto (toggle).
        db.prepare(
          "DELETE FROM fonte_feedback WHERE dominio = ? AND usuario_email = ?",
        ).run(dominio, sessao.email);
        reacaoUsuario = "";
      } else {
        db.prepare(
          `INSERT INTO fonte_feedback (dominio, usuario_email, reacao)
           VALUES (?, ?, ?)
           ON CONFLICT(dominio, usuario_email) DO UPDATE SET
             reacao = excluded.reacao,
             atualizado_em = CURRENT_TIMESTAMP`,
        ).run(dominio, sessao.email, reacao);
      }

      res.json({ ok: true, dominio, reacaoUsuario, ...obterResumoFonte(dominio) });
    } catch (err) {
      console.error("[/api/fontes/voto] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível salvar a avaliação." });
    }
  });

  app.post("/api/fontes/denuncia", async (req, res) => {
    const sessao = obterSessaoUsuario(req.body?.authToken);
    const dominio = normalizarDominioFonte(req.body?.dominio);
    const motivo = normalizarMotivoDenuncia(req.body?.motivo);
    const comentario = normalizarComentarioFeedback(req.body?.comentario);

    if (!sessao) {
      return res.status(401).json({
        ok: false,
        erro: "Entre na extensão para denunciar uma fonte.",
      });
    }
    if (!dominio) {
      return res.status(400).json({ ok: false, erro: "Fonte inválida." });
    }
    if (!motivo) {
      return res
        .status(400)
        .json({ ok: false, erro: "Selecione um motivo para a denúncia." });
    }

    try {
      db.prepare(
        `INSERT INTO fonte_denuncias (dominio, usuario_email, usuario_nome, motivo, comentario)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(dominio, usuario_email) DO UPDATE SET
           usuario_nome = excluded.usuario_nome,
           motivo = excluded.motivo,
           comentario = excluded.comentario,
           atualizado_em = CURRENT_TIMESTAMP`,
      ).run(dominio, sessao.email, sessao.nome, motivo, comentario);

      // Notifica a empresa por e-mail (best-effort, não bloqueia a denúncia).
      const destino = emailEmpresaDestino();
      if (destino && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter
          .sendMail({
            from: `"VerusAI" <${process.env.EMAIL_USER}>`,
            to: destino,
            replyTo: sessao.email,
            subject: `Denúncia de fonte - ${dominio}`,
            text:
              `Usuário: ${sessao.nome} <${sessao.email}>\n` +
              `Fonte denunciada: ${dominio}\n` +
              `Motivo: ${motivo}\n\n` +
              `Comentário:\n${comentario || "(sem comentário)"}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
                <h2>Denúncia de fonte</h2>
                <p><strong>Usuário:</strong> ${escapeHtmlEmail(sessao.nome)} &lt;${escapeHtmlEmail(sessao.email)}&gt;</p>
                <p><strong>Fonte:</strong> ${escapeHtmlEmail(dominio)}</p>
                <p><strong>Motivo:</strong> ${escapeHtmlEmail(motivo)}</p>
                <hr/>
                <p style="white-space:pre-wrap">${escapeHtmlEmail(comentario || "(sem comentário)")}</p>
              </div>
            `,
          })
          .catch((err) =>
            console.warn("[/api/fontes/denuncia] e-mail ignorado:", err.message),
          );
      }

      res.json({
        ok: true,
        dominio,
        jaDenunciou: true,
        mensagem: "Denúncia registrada. Obrigado por ajudar.",
        ...obterResumoFonte(dominio),
      });
    } catch (err) {
      console.error("[/api/fontes/denuncia] erro:", err);
      res
        .status(500)
        .json({ ok: false, erro: "Não foi possível registrar a denúncia." });
    }
  });
};
