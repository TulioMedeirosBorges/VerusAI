const { classifyPage } = require("./ai-services/classifyPage.js");
const { extractClaims } = require("./ai-services/extractClaims.js");
const { detectClaimType } = require("./ai-services/detectClaimType.js");
const {
  generateSearchQueries,
} = require("./ai-services/generateSearchQueries.js");
const { webSearchCandidates } = require("./ai-services/webSearchCandidates.js");
const {
  verifyWebSearchCandidates,
} = require("./ai-services/verifyWebSearchCandidates.js");
const { routeVerifiedCandidates } = require("./routeVerifiedCandidates.js");
const {
  officialFontesRouterBatch,
} = require("./ai-services/officialFontesRouter.js");
const {
  finalPipelineReview,
} = require("./ai-services/finalPipelineReview.js");
const { claimAudit } = require("./ai-services/claimAudit.js");
const { buildFinal } = require("./ai-services/buildFinal.js");

function normalizeApiName(candidate) {
  return (
    candidate?.api ??
    candidate?.API ??
    candidate?.api_name ??
    candidate?.apiName ??
    candidate?.apiname ??
    null
  );
}

function normalizeCandidateQuery(candidate) {
  return (
    candidate?.query ??
    candidate?.motivo_api ??
    candidate?.motivo ??
    candidate?.url ??
    candidate?.candidate_url ??
    candidate?.candidateUrl ??
    candidate?.candidate ??
    ""
  );
}

function normalizeClaimTypeIndividual(
  contextoGeral,
  claimOriginal,
  claimTypeData,
) {
  return {
    // ===== CONTEXTO GERAL DA NOTÍCIA =====
    contextonoticia: {
      url: contextoGeral?.url || "",
      veiculo: contextoGeral?.veiculo || "",
      datapublicacao:
        contextoGeral?.datapublicacao || contextoGeral?.dataPublicacao || "",
      tipo: contextoGeral?.tipo || "",
      totalclaims:
        contextoGeral?.totalclaims || contextoGeral?.totalClaims || 0,
      noticiacomplexa:
        contextoGeral?.noticiacomplexa ??
        contextoGeral?.noticiaComplexa ??
        false,
      observacoes: contextoGeral?.observacoes || "",
    },

    // ===== DADOS DA CLAIM INDIVIDUAL =====
    claim: {
      id:
        claimOriginal?.id ||
        claimTypeData?.claimid ||
        claimTypeData?.claimId ||
        0,
      texto: claimOriginal?.texto || "",
      tipoclaim: claimOriginal?.tipo || claimOriginal?.tipoclaim || "",
      importancia: claimOriginal?.importancia || "",
      motivo: claimOriginal?.motivo || "",

      verificacoes: {
        ano: claimOriginal?.verificacoes?.ano ?? false,
        data: claimOriginal?.verificacoes?.data ?? false,
        local: claimOriginal?.verificacoes?.local ?? false,
        pessoa: claimOriginal?.verificacoes?.pessoa ?? false,
        instituicao: claimOriginal?.verificacoes?.instituicao ?? false,
      },

      elementos: {
        datas: Array.isArray(claimOriginal?.elementos?.datas)
          ? claimOriginal.elementos.datas
          : [],
        locais: Array.isArray(claimOriginal?.elementos?.locais)
          ? claimOriginal.elementos.locais
          : [],
        pessoas: Array.isArray(claimOriginal?.elementos?.pessoas)
          ? claimOriginal.elementos.pessoas
          : [],
        instituicoes: Array.isArray(claimOriginal?.elementos?.instituicoes)
          ? claimOriginal.elementos.instituicoes
          : [],
        numeros: Array.isArray(claimOriginal?.elementos?.numeros)
          ? claimOriginal.elementos.numeros
          : [],
      },

      contextochecagem:
        claimOriginal?.contextochecagem ||
        claimOriginal?.contextoChecagem ||
        "",
    },

    // ===== DADOS NORMALIZADOS DO TIPO DE VERIFICAÇÃO =====
    tipoverificacao: {
      tipo:
        claimTypeData?.tipoverificacao || claimTypeData?.tipoVerificacao || "",
      categoriaprincipal:
        claimTypeData?.categoriaprincipal ||
        claimTypeData?.categoriaPrincipal ||
        "",

      precisawebsearch:
        claimTypeData?.precisawebsearch ??
        claimTypeData?.precisaWebSearch ??
        false,
      precisaapioficial:
        claimTypeData?.precisaapioficial ??
        claimTypeData?.precisaAPIOficial ??
        false,
      precisafonteestatistica:
        claimTypeData?.precisafonteestatistica ??
        claimTypeData?.precisaFonteEstatistica ??
        false,

      dependedeanocorreto:
        claimTypeData?.dependedeanocorreto ??
        claimTypeData?.dependeDeAnoCorreto ??
        false,
      dependededatacorreta:
        claimTypeData?.dependededatacorreta ??
        claimTypeData?.dependeDeDataCorreta ??
        false,
      dependedelocalcorreto:
        claimTypeData?.dependedelocalcorreto ??
        claimTypeData?.dependeDeLocalCorreto ??
        false,

      fontesrecomendadas: Array.isArray(claimTypeData?.fontesrecomendadas)
        ? claimTypeData.fontesrecomendadas
        : Array.isArray(claimTypeData?.fontesRecomendadas)
          ? claimTypeData.fontesRecomendadas
          : [],

      apisrecomendadas: Array.isArray(claimTypeData?.apisrecomendadas)
        ? claimTypeData.apisrecomendadas
        : Array.isArray(claimTypeData?.apisRecomendadas)
          ? claimTypeData.apisRecomendadas
          : [],

      nivelprioridade: ["baixa", "media", "alta"].includes(
        claimTypeData?.nivelprioridade,
      )
        ? claimTypeData.nivelprioridade
        : ["baixa", "media", "alta"].includes(claimTypeData?.nivelPrioridade)
          ? claimTypeData.nivelPrioridade
          : "media",

      estrategiachecagem:
        claimTypeData?.estrategiachecagem ||
        claimTypeData?.estrategiaChecagem ||
        "",
      motivoclassificacao:
        claimTypeData?.motivoclassificacao ||
        claimTypeData?.motivoClassificacao ||
        claimTypeData?.motivo ||
        "",
    },
  };
}

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

async function runPipeline(pageData, options = {}) {
  const onProgress =
    typeof options.onProgress === "function" ? options.onProgress : () => {};
  const notifyProgress = (stage, label, detail = "") => {
    onProgress({
      stage,
      totalStages: 11,
      label,
      detail,
      updatedAt: new Date().toISOString(),
    });
  };

  console.log("\n========== INICIANDO PIPELINE ==========");
  console.log("[runPipeline] URL:", pageData.url);

  notifyProgress(
    1,
    "Classificando a pagina",
    "Confirmando se o conteudo principal e uma noticia analisavel.",
  );

  // ========== ETAPA 1: CLASSIFICAÇÃO DA PÁGINA ==========
  console.log("\n[1/11] 📋 Classificando página...");
  const classificacao = await classifyPage(pageData);

  console.log("[runPipeline] classificação normalizada:", classificacao);
  console.log(
    "[runPipeline] textolimpo preview:",
    classificacao.textolimpo?.slice(0, 200),
  );
  console.log(
    "[runPipeline] textolimpo length:",
    classificacao.textolimpo?.length,
  );

  let resultado;

  if (classificacao.categoriatextoprincipal !== "noticia") {
    console.log("\n⚠️  Página NÃO é notícia. Encerrando pipeline.");

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
      "[runPipeline] JSON final (ignorado):",
      JSON.stringify(resultado, null, 2),
    );
    console.log("========== PIPELINE FINALIZADO ==========\n");

    return resultado;
  }

  console.log("\n✅ Página é notícia! Continuando...");

  resultado = {
    ...montarResultadoBase(pageData, classificacao),

    status: "continuar",
    mensagem:
      "Página classificada como notícia. Pode continuar para as próximas etapas do pipeline.",

    textonoticia: classificacao.textolimpo,
    motivonaosernoticia: "",
  };

  resultado.debugValidacao = validarResultadoPipeline(resultado);

  notifyProgress(
    2,
    "Extraindo afirmacoes verificaveis",
    "Separando as claims que precisam de checagem.",
  );

  // ========== ETAPA 2: EXTRAÇÃO DE CLAIMS ==========
  console.log("\n[2/11] 🔍 Extraindo claims...");
  const claims = await extractClaims(classificacao, pageData);
  console.log(
    `[runPipeline] ✅ Claims extraídas: ${claims?.claims?.length || 0}`,
  );

  resultado.etapa2_claims = {
    total: claims?.claims?.length || 0,
    contexto: claims?.contexto || {},
    claims: claims?.claims || [],
    resumo: claims?.resumo || {},
  };

  if (!claims?.claims || claims.claims.length === 0) {
    console.log("\n⚠️  Nenhuma claim extraída. Finalizando pipeline.");
    console.log(
      "[runPipeline] JSON final:",
      JSON.stringify(resultado, null, 2),
    );
    console.log("========== PIPELINE FINALIZADO ==========\n");
    return resultado;
  }

  notifyProgress(
    3,
    "Detectando o tipo das claims",
    "Identificando datas, nomes, locais, numeros e prioridade.",
  );

  // ========== ETAPA 3: DETECÇÃO DE TIPO DE CADA CLAIM ==========
  console.log("\n[3/11] 🏷️  Detectando tipo de cada claim...");
  const claimsComTipo = await detectClaimType(claims);
  console.log(
    `[runPipeline] ✅ Claims classificadas: ${claimsComTipo?.length || 0}`,
  );

  // Mapa seguro por claimid para evitar desalinhamento de índices
  const tiposPorClaimId = {};
  claimsComTipo.forEach((tipo) => {
    if (tipo.claimid !== undefined) {
      tiposPorClaimId[tipo.claimid] = tipo;
    }
  });

  resultado.etapa3_tiposdeclaims = claims.claims.map((claim) => {
    const tipo = tiposPorClaimId[claim.id] || {};
    return {
      claimid: claim.id,
      claimtexto: claim.texto || "",
      tipoverificacao: tipo.tipoverificacao || "",
      categoriaprincipal: tipo.categoriaprincipal || "",
      nivelprioridade: tipo.nivelprioridade || "media",
      erro: tipo.erro || false,
      dadoscompletos: tipo,
    };
  });

  notifyProgress(
    4,
    "Gerando consultas de busca",
    "Preparando pesquisas especificas para cada afirmacao.",
  );

  // ========== ETAPA 4: GERAÇÃO DE QUERIES DE BUSCA ==========
  console.log(
    "\n[4/11] 🔎 Gerando queries de busca para TODAS as claims de uma vez...",
  );

  // Normaliza dados usando lookup seguro por claimid
  const dadosNormalizados = claims.claims.map((claim) => {
    const tipoResult = tiposPorClaimId[claim.id] || {};
    return normalizeClaimTypeIndividual(claims.contexto, claim, tipoResult);
  });

  console.log(
    `[runPipeline] 📦 Dados normalizados:`,
    JSON.stringify(dadosNormalizados, null, 2),
  );

  const claimsNormalizadas = dadosNormalizados.map((d) => d.claim);

  // tiposNormalizados agora é array de objetos completos do detectClaimType
  // para que generateSearchQueries receba categoriaprincipal e nivelprioridade
  const tiposNormalizados = claims.claims.map(
    (claim) => tiposPorClaimId[claim.id] || {},
  );

  const contextoBase = dadosNormalizados[0].contextonoticia;

  const contextoNoticia = {
    url: contextoBase.url || pageData.url || "",
    veiculo: contextoBase.veiculo || pageData.siteName || "",
    datapublicacao: contextoBase.datapublicacao || pageData.publishDate || "",
    tipo: classificacao.tipo || "",
    noticiacomplexa: claims.resumo?.complexa ? "true" : "false",
    observacoes: claims.resumo?.observacoes || "",
  };

  const resultadoQueries = await generateSearchQueries(
    contextoNoticia,
    claimsNormalizadas,
    tiposNormalizados,
  );

  let queriesPorClaim = [];

  if (resultadoQueries.ok && Array.isArray(resultadoQueries.claims)) {
    queriesPorClaim = resultadoQueries.claims.map((claimResult, index) => ({
      claimid: claims.claims[index].id,
      claimtexto: claims.claims[index].texto,
      ...claimResult,
    }));
    console.log(
      `[runPipeline] ✅ Queries geradas com sucesso para ${queriesPorClaim.length} claims!`,
    );
  } else {
    console.error(
      `[runPipeline] ❌ Erro ao gerar queries:`,
      resultadoQueries.mensagem,
    );
    if (Array.isArray(resultadoQueries.claims)) {
      queriesPorClaim = resultadoQueries.claims.map((claimResult, index) => ({
        claimid: claims.claims[index].id,
        claimtexto: claims.claims[index].texto,
        ...claimResult,
      }));
    } else {
      queriesPorClaim = claims.claims.map((claim) => ({
        claimid: claim.id,
        claimtexto: claim.texto,
        erro: true,
        mensagem: resultadoQueries.mensagem || "Erro ao gerar queries",
      }));
    }
  }

  resultado.etapa4_searchqueries = queriesPorClaim;

  notifyProgress(
    5,
    "Selecionando fontes candidatas",
    "Filtrando resultados que parecem uteis para a verificacao.",
  );

  // ========== ETAPA 5: SELEÇÃO DE CANDIDATOS DE BUSCA WEB ==========
  console.log(
    "\n[5/11] 🌐 Selecionando candidatos de busca web para TODAS as claims de uma vez...",
  );

  // Usa lookup seguro por claimid também aqui
  const claimsParaCandidatos = claims.claims.map((claim) => ({
    claim: claim,
    classificacaoverificacao: tiposPorClaimId[claim.id] || {},
  }));

  const searchQueriesResults = {
    ok: true,
    claims: queriesPorClaim,
  };

  const contextoNoticiaFinal = {
    url: pageData.url || "",
    veiculo: pageData.siteName || "",
    datapublicacao: pageData.publishDate || "",
    observacoes: claims.resumo?.observacoes || "",
  };

  const resultadoCandidatos = await webSearchCandidates(
    claimsParaCandidatos,
    searchQueriesResults,
    contextoNoticiaFinal,
  );

  let candidatosPorClaim = [];

  if (resultadoCandidatos.ok && Array.isArray(resultadoCandidatos.claims)) {
    candidatosPorClaim = resultadoCandidatos.claims;
    console.log(
      `[runPipeline] ✅ Candidatos selecionados com sucesso para ${candidatosPorClaim.length} claims!`,
    );
  } else {
    console.error(
      `[runPipeline] ❌ Erro ao selecionar candidatos:`,
      resultadoCandidatos.mensagem,
    );
    if (Array.isArray(resultadoCandidatos.claims)) {
      candidatosPorClaim = resultadoCandidatos.claims;
    } else {
      candidatosPorClaim = claims.claims.map((claim) => ({
        claimid: claim.id,
        erro: true,
        mensagem:
          resultadoCandidatos.mensagem || "Erro ao selecionar candidatos",
      }));
    }
  }

  resultado.etapa5_websearchcandidates = candidatosPorClaim;

  notifyProgress(
    6,
    "Verificando links encontrados",
    "Comparando candidatos com o texto das claims.",
  );

  // ========== ETAPA 6: VERIFICAÇÃO DE LINKS ENCONTRADOS PELO WEB SEARCH CANDIDATES ==========
  console.log("\n[6/11] 🔗 Verificando links encontrados para cada claim...");
  const resultadoVerificacao = await verifyWebSearchCandidates(
    contextoNoticiaFinal,
    claimsParaCandidatos,
    searchQueriesResults,
    resultadoCandidatos,
  );

  resultado.etapa6_verifyWebSearchCandidates = resultadoVerificacao;

  notifyProgress(
    7,
    "Roteando evidencias",
    "Separando o que exige fonte oficial, API ou so contexto.",
  );

  // ========== ETAPA 7: ROTEAMENTO DE CANDIDATOS (COM OU SEM API) ==========
  console.log("\n[7/11] 🚦 Roteando candidatos verificados (API vs sem API)...");
  const rotaCandidatos = routeVerifiedCandidates(
    resultadoVerificacao.claims || [],
  );

  resultado.etapa7_rotaCandidatos = rotaCandidatos;

  const metadadosClaimPorId = new Map(
    claimsParaCandidatos.map((item) => [
      item.claim?.id || item.id || item.claimid || 0,
      {
        texto: item.claim?.texto || item.texto || "",
        tipo: item.claim?.tipo || item.claim?.tipoclaim || item.tipo || "",
      },
    ]),
  );

  notifyProgress(
    8,
    "Consultando fontes oficiais",
    "Conferindo dados em fontes institucionais quando necessario.",
  );

  // ========== ETAPA 8: VERIFICAÇÃO EM FONTES OFICIAIS VIA IA ==========
  console.log("\n[8/11] 🧭 Enviando para IA verificar em fontes oficiais...");

  const claimsParaFontesOficiais = rotaCandidatos.claims.map((claim) => {
    const metadadosClaim = metadadosClaimPorId.get(claim.claimId) || {};
    return {
      claimId: claim.claimId,
      texto: claim.claimTexto || metadadosClaim.texto || "",
      tipo: claim.claimTipo || metadadosClaim.tipo || "",
      candidatos: [
        ...(claim.necessitaFonteOficial || []),
        ...(claim.nenhum || []),
      ],
    };
  });

  const resultadoFontesOficiaisBatch = await officialFontesRouterBatch(
    contextoNoticia,
    claimsParaFontesOficiais,
  );
  const resultadoFontesOficiais = resultadoFontesOficiaisBatch.claims || [];

  resultado.etapa8_officialFontes = {
    claims: resultadoFontesOficiais,
    summary: {
      totalClaims: rotaCandidatos.summary.totalClaims,
      totalFontesCalls: resultadoFontesOficiais.reduce(
        (total, claim) =>
          total +
          (claim.resumo?.total_buscados ??
            (claim.resultados || []).filter(
              (resultado) => resultado.busca_realizada,
            ).length),
        0,
      ),
      totalOpenAICalls:
        resultadoFontesOficiaisBatch.summary?.totalOpenAICalls || 0,
    },
  };

  notifyProgress(
    9,
    "Revisando a analise final",
    "Consolidando veredito, confianca e alertas.",
  );

  // ========== ETAPA 9: IA FINAL COM DADOS ATUALIZADOS DO PIPELINE ==========
  console.log(
    "\n[9/11] Enviando dados finais atualizados para a IA final...",
  );
  const resultadoAnaliseFinal = await finalPipelineReview(resultado);
  resultado.etapa9_finalPipelineReview = resultadoAnaliseFinal;

  notifyProgress(
    10,
    "Auditando claims",
    "Revisando fontes, contexto e risco de veredito exagerado.",
  );

  // ========== ETAPA 10: AUDITORIA DAS CLAIMS ==========
  console.log("\n[10/11] Auditando resultado das claims...");
  const resultadoClaimAudit = await claimAudit(resultado);
  resultado.etapa10_claimAudit = resultadoClaimAudit;

  notifyProgress(
    11,
    "Montando resposta visual",
    "Preparando o resultado final para o painel.",
  );

  // ========== ETAPA 11: BUILD FINAL PARA FRONT-END ==========
  console.log("\n[11/11] Montando build final para o front-end...");
  const resultadoBuildFinal = await buildFinal(resultado);
  resultado.etapa11_buildFinal = resultadoBuildFinal;

  console.log("\n========== RESUMO DO PIPELINE ==========");
  console.log(`✅ Etapa 1 - Classificação: ${resultado.tipo}`);
  console.log(
    `✅ Etapa 2 - Claims extraídas: ${resultado.etapa2_claims.total}`,
  );
  console.log(
    `✅ Etapa 3 - Tipos detectados: ${resultado.etapa3_tiposdeclaims.length}`,
  );
  console.log(
    `✅ Etapa 4 - Queries geradas: ${resultado.etapa4_searchqueries.length}`,
  );
  console.log(
    `✅ Etapa 5 - Candidatos selecionados: ${resultado.etapa5_websearchcandidates.length}`,
  );
  console.log(
    `✅ Etapa 6 - Verificação de links: ${Array.isArray(resultado.etapa6_verifyWebSearchCandidates?.claims) ? resultado.etapa6_verifyWebSearchCandidates.claims.length : 0}`,
  );
  console.log(
    `✅ Etapa 7 - Roteamento por claim: ${resultado.etapa7_rotaCandidatos.summary.totalClaims} claims | API=${resultado.etapa7_rotaCandidatos.summary.totalNecessitaApi} | FonteOficial=${resultado.etapa7_rotaCandidatos.summary.totalNecessitaFonteOficial} | Sem processamento=${resultado.etapa7_rotaCandidatos.summary.totalNenhum}`,
  );
  console.log(
    `✅ Etapa 8 - Verificação em fontes oficiais: ${resultado.etapa8_officialFontes.summary.totalFontesCalls} verificações`,
  );
  console.log(
    `Etapa 9 - IA final: ${resultado.etapa9_finalPipelineReview.ok ? "ok" : "nao executada/erro"}`,
  );
  console.log(
    `Etapa 10 - Claim audit: ${resultado.etapa10_claimAudit.ok ? "ok" : "nao executada/erro"}`,
  );
  console.log(
    `Etapa 11 - Build final: ${resultado.etapa11_buildFinal.ok ? "ok" : "nao executada/erro"}`,
  );
  console.log("========================================\n");

  console.log("[runPipeline] JSON final:", JSON.stringify(resultado, null, 2));
  console.log("========== PIPELINE FINALIZADO ==========\n");

  return resultado;
}

module.exports = { runPipeline };
