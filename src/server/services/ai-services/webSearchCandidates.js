// services/ai-services/webSearchCandidates.js
// Analisa candidatos de busca web para verificação de claims

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

function normalizeWebSearchCandidates(
  claimData,
  searchQueriesResult,
  contextoNoticia,
) {
  const claim = claimData.claim || claimData;
  const tipoVerif =
    claimData.classificacaoverificacao || claimData.tipoVerificacao || {};
  const queriesData = searchQueriesResult || {};

  return {
    claim: {
      id: claim.id || 0,
      texto: claim.texto || "",
      tipo: claim.tipoclaim || claim.tipo || "",
    },

    verificacao: {
      tipo: tipoVerif.tipoverificacao || tipoVerif.tipo || "",
      categoria: tipoVerif.categoriaprincipal || tipoVerif.categoria || "",
      prioridade: tipoVerif.nivelprioridade || tipoVerif.prioridade || "media",
      estrategia: tipoVerif.estrategiachecagem || tipoVerif.estrategia || "",
    },

    contextoOriginal: {
      url: contextoNoticia?.url || "",
      veiculo: contextoNoticia?.veiculo || "",
      dataPublicacao: contextoNoticia?.datapublicacao || "",
      observacoes: contextoNoticia?.observacoes || "",
    },

    buscas: {
      queries: queriesData.queries || [],
      consultasAPIs:
        queriesData.consultasapis || queriesData.consultasAPIs || [],
      alertas: queriesData.alertasbusca || queriesData.alertasBusca || [],
      observacoes: queriesData.observacoes || "",
    },
  };
}

function normalizeWebSearchCandidatesBatch(
  claimsArray,
  searchQueriesResults,
  contextoNoticia,
) {
  if (!Array.isArray(claimsArray)) return [];

  const resultsMap = new Map();
  if (searchQueriesResults?.claims) {
    searchQueriesResults.claims.forEach((result) => {
      resultsMap.set(result.claimid, result);
    });
  }

  return claimsArray.map((claimData) => {
    const claimId = claimData.claim?.id || claimData.id || 0;
    const searchResult = resultsMap.get(claimId) || {};
    return normalizeWebSearchCandidates(
      claimData,
      searchResult,
      contextoNoticia,
    );
  });
}

async function webSearchCandidates(
  claimsArray,
  searchQueriesResults,
  contextoNoticia,
) {
  console.log(
    `[webSearchCandidates] Processando ${claimsArray.length} claims em lote...`,
  );

  // Normaliza os dados antes de enviar para a IA
  const claimsNormalizadas = normalizeWebSearchCandidatesBatch(
    claimsArray,
    searchQueriesResults,
    contextoNoticia,
  );

  console.log(
    `[webSearchCandidates] ✅ Dados normalizados:`,
    JSON.stringify(claimsNormalizadas, null, 2),
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: process.env.OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID,
        version: "9",
        variables: {
          url: contextoNoticia.url || "",
          veiculo: contextoNoticia.veiculo || "",
          datapublicacao: contextoNoticia.datapublicacao || "",
          tipo: contextoNoticia.tipo || "",
          totalclaims: String(claimsNormalizadas.length),
          noticiacomplexa: contextoNoticia.noticiacomplexa || "false",
          observacoes: contextoNoticia.observacoes || "",
          loteclaims: JSON.stringify(
            claimsNormalizadas.map((claim) => ({
              id: claim.claim.id || 0,
              texto: claim.claim.texto || "",
              tipo: claim.claim.tipo || "",
              tipoverificacao: claim.verificacao.tipo || "",
              categoriaprincipal: claim.verificacao.categoria || "",
              nivelprioridade: claim.verificacao.prioridade || "media",
              estrategia: claim.verificacao.estrategia || "",
              contextoOriginal: {
                url: claim.contextoOriginal?.url || "",
                veiculo: claim.contextoOriginal?.veiculo || "",
                dataPublicacao: claim.contextoOriginal?.dataPublicacao || "",
                observacoes: claim.contextoOriginal?.observacoes || "",
              },
              buscas: {
                queries: claim.buscas.queries || [],
                consultasAPIs: claim.buscas.consultasAPIs || [],
                alertas: claim.buscas.alertas || [],
                observacoes: claim.buscas.observacoes || "",
              },
            })),
          ),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[webSearchCandidates] ❌ Erro na API: ${response.status}`,
      errorText,
    );
    return {
      ok: false,
      etapa: "webSearchCandidates",
      erro: true,
      status: response.status,
      mensagem: `Erro na API: ${response.status}`,
      detalheOpenAI: errorText,
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.claim.id,
        erro: true,
        mensagem: `Erro na API: ${response.status}`,
      })),
    };
  }

  const data = await response.json();

  if (data.error) {
    console.error(
      `[webSearchCandidates] ❌ Erro de API no corpo da resposta:`,
      JSON.stringify(data, null, 2),
    );
    return {
      ok: false,
      etapa: "webSearchCandidates",
      erro: true,
      mensagem: "Erro retornado pela API OpenAI",
      detalheOpenAI: JSON.stringify(data, null, 2),
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.claim.id,
        erro: true,
        mensagem: "Erro retornado pela API OpenAI",
      })),
    };
  }

  let texto = data.output_text;
  if (!texto && Array.isArray(data.output)) {
    texto = data.output
      .flatMap((item) => item.content || [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("");
  }

  if (!texto || texto.trim() === "") {
    console.warn(
      `[webSearchCandidates] ⚠️ IA não retornou texto. resposta completa: ${JSON.stringify(
        data,
        null,
        2,
      )}`,
    );
    return {
      ok: false,
      etapa: "webSearchCandidates",
      erro: true,
      mensagem: "IA não retornou resposta",
      detalheOpenAI: JSON.stringify(data, null, 2),
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.claim.id,
        erro: true,
        mensagem: "IA não retornou resposta",
      })),
    };
  }

  let resultado;
  try {
    resultado = JSON.parse(texto);
    console.log(
      `[webSearchCandidates] ✅ Resposta da IA para ${claimsNormalizadas.length} claims:`,
      JSON.stringify(resultado, null, 2),
    );
  } catch (e) {
    console.error(
      `[webSearchCandidates] ❌ JSON inválido recebido da IA:`,
      texto,
    );
    return {
      ok: false,
      etapa: "webSearchCandidates",
      erro: true,
      mensagem: "Resposta não é JSON válido",
      detalheOpenAI: texto,
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.claim.id,
        erro: true,
        mensagem: "Resposta não é JSON válido",
      })),
    };
  }

  // Valida estrutura do retorno: aceitar respostas com `claims` ou `fontesCandidatas`
  if (
    !resultado.ok ||
    resultado.etapa !== "webSearchCandidates" ||
    (!Array.isArray(resultado.claims) &&
      !Array.isArray(resultado.fontesCandidatas))
  ) {
    const detalhe = JSON.stringify(resultado, null, 2);
    console.error(
      `[webSearchCandidates] ❌ Estrutura de retorno inválida:`,
      detalhe,
    );
    const mensagemErro =
      resultado.mensagem ||
      resultado.message ||
      "Estrutura de retorno inválida";

    return {
      ok: false,
      etapa: "webSearchCandidates",
      erro: true,
      mensagem: `Estrutura de retorno inválida: ${mensagemErro}`,
      detalheOpenAI: detalhe,
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.claim.id,
        erro: true,
        mensagem: `Estrutura de retorno inválida: ${mensagemErro}`,
      })),
    };
  }

  // Compatibilidade: normalize `fontesCandidatas` para `claims` quando necessário
  if (
    !Array.isArray(resultado.claims) &&
    Array.isArray(resultado.fontesCandidatas)
  ) {
    resultado.claims = resultado.fontesCandidatas.map((f, idx) => {
      const claimid =
        f.claimId ?? f.claimid ?? claimsNormalizadas[idx]?.claim?.id ?? null;
      return {
        claimid,
        fonteId: f.fonteId || f.fonte_id || null,
        titulo: f.titulo || "",
        url: f.url || "",
        dominio: f.dominio || "",
        tipoFonteCandidata: f.tipoFonteCandidata || f.tipoFonte || "",
        prioridadeQuery: f.prioridadeQuery || f.prioridade || "",
        queryUsada: f.queryUsada || f.query || "",
        status: f.status || "candidato",
        trechoBusca: f.trechoBusca || "",
        termosEncontrados: f.termosEncontrados || [],
        motivoRelevancia: f.motivoRelevancia || f.motivo || "",
        raw: f,
      };
    });
  }

  return resultado;
}

module.exports = { webSearchCandidates };
