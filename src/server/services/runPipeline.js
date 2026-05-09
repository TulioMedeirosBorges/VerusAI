const { classifyPage } = require("./ai-services/classifyPage.js");
const { extractClaims } = require("./ai-services/extractClaims.js");

function validarResultadoPipeline(resultado) {
  const obrigatoriosBase = [
    "ok",
    "etapa",
    "status",
    "mensagem",
    "url",
    "domain",
    "categoriapagina",
    "categoriatextoprincipal",
    "tipo",
    "classificacao",
  ];

  const faltando = obrigatoriosBase.filter((campo) => {
    return resultado[campo] === undefined || resultado[campo] === null;
  });

  const avisos = [];

  if (resultado.ok !== true) {
    avisos.push("Campo 'ok' deveria ser true.");
  }

  if (resultado.etapa !== "classifyPage") {
    avisos.push("Campo 'etapa' deveria ser 'classifyPage'.");
  }

  if (!["continuar", "ignorado"].includes(resultado.status)) {
    avisos.push("Campo 'status' deveria ser 'continuar' ou 'ignorado'.");
  }

  if (!resultado.tipo) {
    avisos.push("Campo 'tipo' vazio.");
  }

  if (!resultado.categoriatextoprincipal) {
    avisos.push("Campo 'categoriatextoprincipal' vazio.");
  }

  if (!resultado.classificacao || typeof resultado.classificacao !== "object") {
    avisos.push("Campo 'classificacao' ausente ou inválido.");
  }

  if (resultado.classificacao && !resultado.classificacao.motivoclassificacao) {
    avisos.push("Campo 'classificacao.motivoclassificacao' vazio.");
  }

  if (resultado.status === "continuar") {
    if (resultado.categoriatextoprincipal !== "noticia") {
      avisos.push(
        "Status está 'continuar', mas categoriatextoprincipal não é 'noticia'.",
      );
    }

    if (!resultado.titulo) {
      avisos.push("Campo 'titulo' vazio para notícia.");
    }

    if (!resultado.textolimpo) {
      avisos.push("Campo 'textolimpo' vazio para notícia.");
    }

    if (!resultado.textonoticia) {
      avisos.push("Campo 'textonoticia' vazio para notícia.");
    }
  }

  if (resultado.status === "ignorado") {
    if (resultado.categoriatextoprincipal === "noticia") {
      avisos.push(
        "Status está 'ignorado', mas categoriatextoprincipal é 'noticia'.",
      );
    }

    if (!resultado.motivonaosernoticia) {
      avisos.push("Campo 'motivonaosernoticia' vazio para página ignorada.");
    }
  }

  return {
    valido: faltando.length === 0 && avisos.length === 0,
    faltando,
    avisos,
  };
}

function montarResultadoBase(pageData, classificacao) {
  return {
    ok: true,
    etapa: "classifyPage",

    url: pageData.url || "",
    domain: pageData.domain || "",
    sitename: pageData.siteName || "",
    pagetype: pageData.pageType || "",
    language: pageData.language || "",

    publishdate: pageData.publishDate || pageData.publishdate || "",

    categoriapagina: classificacao.categoriapagina,
    categoriatextoprincipal: classificacao.categoriatextoprincipal,
    tipo: classificacao.tipo,

    titulo: classificacao.tituloprovavel,
    textolimpo: classificacao.textolimpo,

    classificacao,
  };
}

async function runPipeline(pageData) {
  const classificacao = await classifyPage(pageData);

  console.log("[runPipeline] classificação normalizada:", classificacao);
  console.log(
    "[runPipeline] textolimpo:",
    classificacao.textolimpo?.slice(0, 1000),
  );

  let resultado;

  if (classificacao.categoriatextoprincipal !== "noticia") {
    resultado = {
      ...montarResultadoBase(pageData, classificacao),

      status: "ignorado",
      mensagem:
        "Essa página não foi classificada como notícia. A análise de veracidade não será iniciada.",

      textonoticia: "",
      motivonaosernoticia:
        classificacao.motivonaosernoticia ||
        "O conteúdo principal não foi classificado como notícia.",
    };

    resultado.debugValidacao = validarResultadoPipeline(resultado);

    console.log(
      "[runPipeline] JSON final:",
      JSON.stringify(resultado, null, 2),
    );

    return resultado;
  }

  resultado = {
    ...montarResultadoBase(pageData, classificacao),

    status: "continuar",
    mensagem:
      "Página classificada como notícia. Pode continuar para as próximas etapas do pipeline.",

    textonoticia: classificacao.textolimpo,
    motivonaosernoticia: "",
  };

  resultado.debugValidacao = validarResultadoPipeline(resultado);

  const claims = await extractClaims(classificacao, pageData.url);
  resultado.claims = claims;

  console.log("[runPipeline] JSON final:", JSON.stringify(resultado, null, 2));

  return resultado;
}

module.exports = { runPipeline };
