// Rotas do pipeline de análise: início assíncrono (job), consulta de status e
// análise síncrona legada.
const { db } = require("../db.js");
const { obterSessaoUsuario } = require("../services/sessoes.js");
const { salvarAnaliseNoCache } = require("../services/analises/salvarAnalise.js");
const { runPipeline } = require("../services/pipeline/runPipeline.js");

const analysisJobs = new Map();
const ANALYSIS_JOB_TTL_MS = 30 * 60 * 1000;

function validarPageData(pageData) {
  if (!pageData || typeof pageData !== "object") {
    return "Dados da pagina ausentes.";
  }

  if (!pageData.url) {
    return "URL da pagina e obrigatoria.";
  }

  return "";
}

function prepararAnaliseAutenticada(body) {
  const sessao = obterSessaoUsuario(body?.authToken);
  if (!sessao) {
    return {
      erro: {
        status: 401,
        payload: {
          ok: false,
          erro: "Entre na extensão para iniciar uma análise.",
        },
      },
    };
  }

  const pageData = { ...(body || {}) };
  delete pageData.authToken;
  return { sessao, pageData };
}

// Registra que um usuário realizou uma análise (alimenta o dashboard).
function registrarAutorAnalise(sessao, url) {
  if (!sessao?.email) return;
  try {
    db.prepare(
      "INSERT INTO analise_autores (email, nome, url) VALUES (?, ?, ?)",
    ).run(sessao.email, sessao.nome || "", String(url || "").slice(0, 1000));
  } catch (err) {
    console.warn("[analise_autores] falha ao registrar autor:", err.message);
  }
}

function limparJobsAntigos() {
  const agora = Date.now();

  for (const [jobId, job] of analysisJobs.entries()) {
    const finalizadoEm = job.finishedAtMs || job.updatedAtMs || job.startedAtMs;
    if (finalizadoEm && agora - finalizadoEm > ANALYSIS_JOB_TTL_MS) {
      analysisJobs.delete(jobId);
    }
  }
}

function criarJobId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function iniciarAnalysisJob(pageData, sessao = null) {
  limparJobsAntigos();

  const agora = Date.now();
  const job = {
    id: criarJobId(),
    status: "processing",
    startedAt: new Date(agora).toISOString(),
    startedAtMs: agora,
    updatedAt: new Date(agora).toISOString(),
    updatedAtMs: agora,
    finishedAt: null,
    finishedAtMs: null,
    progress: null,
    resultado: null,
    erro: null,
  };

  analysisJobs.set(job.id, job);

  runPipeline(pageData, {
    onProgress: (progress) => {
      const agoraProgresso = Date.now();
      job.progress = {
        ...progress,
        updatedAt: progress.updatedAt || new Date(agoraProgresso).toISOString(),
      };
      job.updatedAt = job.progress.updatedAt;
      job.updatedAtMs = agoraProgresso;
    },
  })
    .then((resultado) => {
      const fim = Date.now();
      try {
        job.publicacao = salvarAnaliseNoCache(resultado, pageData);
        registrarAutorAnalise(sessao, job.publicacao?.url || pageData.url);
      } catch (saveErr) {
        console.error("[cache_analises] erro ao salvar job:", saveErr);
        job.publicacaoErro =
          saveErr.message || "Erro ao salvar analise no banco.";
      }
      job.status = "done";
      job.resultado = resultado;
      job.updatedAt = new Date(fim).toISOString();
      job.updatedAtMs = fim;
      job.finishedAt = job.updatedAt;
      job.finishedAtMs = fim;
    })
    .catch((err) => {
      const fim = Date.now();
      console.error("[/analisar job] erro:", err);
      job.status = "error";
      job.erro = err.message || "Erro interno ao analisar a pagina.";
      job.updatedAt = new Date(fim).toISOString();
      job.updatedAtMs = fim;
      job.finishedAt = job.updatedAt;
      job.finishedAtMs = fim;
    });

  return job;
}

function montarResultadoSidebar(resultado) {
  if (!resultado || typeof resultado !== "object") {
    return resultado;
  }

  const buildFinal = resultado.etapa11_buildFinal || resultado.etapa10_buildFinal;

  if (buildFinal) {
    return {
      ok: resultado.ok,
      etapa: resultado.etapa,
      status: resultado.status,
      etapa10_claimAudit: resultado.etapa10_claimAudit,
      etapa11_buildFinal: buildFinal,
    };
  }

  if (resultado.etapa === "classifyPage") {
    return {
      ok: resultado.ok,
      etapa: resultado.etapa,
      status: resultado.status,
      mensagem: resultado.mensagem,
      tipo: resultado.tipo,
      categoriatextoprincipal: resultado.categoriatextoprincipal,
      motivonaosernoticia: resultado.motivonaosernoticia,
      classificacao: resultado.classificacao,
    };
  }

  return {
    ok: resultado.ok,
    etapa: resultado.etapa,
    status: resultado.status,
    mensagem: resultado.mensagem,
    etapa2_claims: resultado.etapa2_claims
      ? { total: resultado.etapa2_claims.total }
      : undefined,
  };
}

module.exports = function registrarRotasAnalisar(app) {
  app.post("/analisar/start", (req, res) => {
    const autenticada = prepararAnaliseAutenticada(req.body);
    if (autenticada.erro) {
      return res.status(autenticada.erro.status).json(autenticada.erro.payload);
    }

    const pageData = autenticada.pageData;
    const erroValidacao = validarPageData(pageData);

    if (erroValidacao) {
      return res.status(400).json({
        ok: false,
        erro: erroValidacao,
      });
    }

    const job = iniciarAnalysisJob(pageData, autenticada.sessao);

    return res.status(202).json({
      ok: true,
      jobId: job.id,
      status: job.status,
      startedAt: job.startedAt,
      progress: job.progress,
    });
  });

  app.get("/analisar/status/:jobId", (req, res) => {
    limparJobsAntigos();

    const job = analysisJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        ok: false,
        status: "not_found",
        erro: "Analise nao encontrada ou expirada.",
      });
    }

    const payload = {
      ok: job.status !== "error",
      jobId: job.id,
      status: job.status,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      finishedAt: job.finishedAt,
      progress: job.progress,
    };

    if (job.status === "done") payload.resultado = montarResultadoSidebar(job.resultado);
    if (job.status === "done") payload.publicacao = job.publicacao || null;
    if (job.status === "error") payload.erro = job.erro;

    return res.status(200).json(payload);
  });

  app.post("/analisar", async (req, res) => {
    // Remove o timeout padrão do Express (permite tempo ilimitado)
    req.setTimeout(0);
    res.setTimeout(0);

    try {
      const autenticada = prepararAnaliseAutenticada(req.body);
      if (autenticada.erro) {
        return res.status(autenticada.erro.status).json(autenticada.erro.payload);
      }

      const pageData = autenticada.pageData;
      const erroValidacao = validarPageData(pageData);

      if (erroValidacao) {
        return res.status(400).json({
          ok: false,
          erro: erroValidacao,
        });
      }

      if (!pageData || typeof pageData !== "object") {
        return res.status(400).json({
          ok: false,
          erro: "Dados da página ausentes.",
        });
      }

      if (!pageData.url) {
        return res.status(400).json({
          ok: false,
          erro: "URL da página é obrigatória.",
        });
      }

      const resultado = await runPipeline(pageData);
      try {
        const pub = salvarAnaliseNoCache(resultado, pageData);
        registrarAutorAnalise(autenticada.sessao, pub?.url || pageData.url);
      } catch (saveErr) {
        console.error("[cache_analises] erro ao salvar /analisar:", saveErr);
      }

      return res.status(200).json(resultado);
    } catch (err) {
      console.error("[/analisar] erro:", err);

      return res.status(500).json({
        ok: false,
        erro: err.message || "Erro interno ao analisar a página.",
      });
    }
  });
};
