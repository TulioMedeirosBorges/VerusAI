const { classifyPage } = require("./classifyPage.js");

async function runPipeline(pageData) {
  const classificacao = await classifyPage(pageData);

  if (!classificacao.deveContinuarAnalise) {
    return {
      ok: true,
      etapa: "classifyPage",
      status: "ignorado",
      mensagem:
        "Essa página não parece ser uma notícia, opinião ou postagem social adequada para análise.",
      classificacao,
    };
  }

  return {
    ok: true,
    etapa: "classifyPage",
    status: "continuar",
    mensagem:
      "Página classificada com sucesso. Pode continuar para as próximas etapas do pipeline.",
    classificacao,
  };
}

module.exports = { runPipeline };
