// services/ai-services/verifyWebSearchCandidates.js
// Verifica se os links encontrados pelo webSearchCandidates fazem sentido para cada claim

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return text;

  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function normalizeVerifyWebSearchResultItem(item) {
  return {
    claimid: item.claimid ?? item.claim_id ?? item.claimId ?? null,
    url:
      item.url ??
      item.candidate_url ??
      item.candidateUrl ??
      item.candidate ??
      "",
    faz_sentido: item.faz_sentido ?? item.fazSentido ?? item.valid ?? false,
    confianca_relacao:
      item.confianca_relacao ??
      item.confidence ??
      item.confidence_relation ??
      null,
    motivo: item.motivo ?? item.reason ?? item.explanation ?? "",
    motivo_api:
      item.motivo_api ??
      item.motivoApi ??
      item.api_reason ??
      item.reason_api ??
      "",
    alerta: item.alerta ?? item.alert ?? false,
    tipo_alerta: item.tipo_alerta ?? item.tipoAlerta ?? item.alert_type ?? null,
    necessita_api:
      item.necessita_api ?? item.necessitaApi ?? item.needs_api ?? false,
    api: item.api ?? item.API ?? item.api_name ?? null,
    necessita_fonte_oficial:
      item.necessita_fonte_oficial ??
      item.necessitaFonteOficial ??
      item.needs_official_source ??
      false,
    fonte_oficial:
      item.fonte_oficial ??
      item.fonteOficial ??
      item.official_source ??
      item.officialSource ??
      null,
    motivo_fonte_oficial:
      item.motivo_fonte_oficial ??
      item.motivoFonteOficial ??
      item.official_source_reason ??
      item.reasonOfficialSource ??
      "",
    raw: item,
  };
}

function normalizeVerifyWebSearchCandidates(
  contextoNoticia,
  claimsParaCandidatos,
  searchQueriesResults,
  webSearchCandidatesResult,
) {
  const queriesMap = new Map();
  if (Array.isArray(searchQueriesResults?.claims)) {
    searchQueriesResults.claims.forEach((claimResult) => {
      const id = claimResult.claimid ?? claimResult.claimId ?? claimResult.id;
      if (id !== undefined) {
        queriesMap.set(id, claimResult);
      }
    });
  }

  const candidatosPorClaim = new Map();
  if (Array.isArray(webSearchCandidatesResult?.claims)) {
    webSearchCandidatesResult.claims.forEach((candidatura) => {
      const claimId =
        candidatura.claimid ?? candidatura.claimId ?? (candidatura.claim || 0);
      const entry = candidatosPorClaim.get(claimId) || [];
      entry.push({
        fonteId: candidatura.fonteId || candidatura.fonte_id || "",
        url: candidatura.url || "",
        dominio: candidatura.dominio || "",
        titulo: candidatura.titulo || "",
        tipoFonteCandidata:
          candidatura.tipoFonteCandidata || candidatura.tipoFonte || "",
        prioridadeQuery:
          candidatura.prioridadeQuery || candidatura.prioridade || "",
        queryUsada: candidatura.queryUsada || candidatura.query || "",
        tipoQueryOrigem: candidatura.tipoQueryOrigem || "",
        relacaoInicial: candidatura.relacaoInicial || "",
        motivoRelevancia:
          candidatura.motivoRelevancia || candidatura.motivo || "",
        status: candidatura.status || "candidato",
        trechoBusca: candidatura.trechoBusca || "",
        termosEncontrados: candidatura.termosEncontrados || [],
      });
      candidatosPorClaim.set(claimId, entry);
    });
  }

  return {
    contextonoticia: {
      url: contextoNoticia?.url || "",
      veiculo: contextoNoticia?.veiculo || "",
      dataPublicacao: contextoNoticia?.datapublicacao || "",
      tipo: contextoNoticia?.tipo || "",
      observacoes: contextoNoticia?.observacoes || "",
    },
    claims: claimsParaCandidatos.map((claimItem) => {
      const claimId =
        claimItem.claim?.id || claimItem.id || claimItem.claimid || 0;
      const queryResult = queriesMap.get(claimId) || {};
      const queries = Array.isArray(queryResult.queries)
        ? queryResult.queries
        : safeArray(queryResult.queries || queryResult.query);

      return {
        claimId,
        claimTexto: claimItem.claim?.texto || claimItem.texto || "",
        claimTipo: claimItem.claim?.tipo || claimItem.tipo || "",
        tipoverificacao:
          claimItem.classificacaoverificacao?.tipoverificacao ||
          claimItem.tipoVerificacao ||
          "",
        categoriaprincipal:
          claimItem.classificacaoverificacao?.categoriaprincipal ||
          claimItem.categoriaPrincipal ||
          "",
        nivelprioridade:
          claimItem.classificacaoverificacao?.nivelprioridade ||
          claimItem.prioridade ||
          "media",
        estrategia:
          claimItem.classificacaoverificacao?.estrategiachecagem ||
          claimItem.estrategia ||
          "",
        queries,
        candidaturas: candidatosPorClaim.get(claimId) || [],
      };
    }),
  };
}

async function verifyWebSearchCandidates(
  contextoNoticia,
  claimsParaCandidatos,
  searchQueriesResults,
  webSearchCandidatesResult,
) {
  console.log(
    `[verifyWebSearchCandidates] Processando ${
      claimsParaCandidatos.length
    } claims para verificar links...`,
  );

  const promptId = process.env.OPENAI_VERIFY_WEB_SEARCH_CANDIDATES_PROMPT_ID;
  if (!promptId) {
    console.warn(
      "[verifyWebSearchCandidates] Aviso: OPENAI_VERIFY_WEB_SEARCH_CANDIDATES_PROMPT_ID não configurado.",
    );
    return {
      ok: false,
      etapa: "verifyWebSearchCandidates",
      mensagem:
        "Prompt de verificação de links não configurado. Defina OPENAI_VERIFY_WEB_SEARCH_CANDIDATES_PROMPT_ID.",
      claims: claimsParaCandidatos.map((claimItem) => ({
        claimid: claimItem.claim?.id || claimItem.id || claimItem.claimid || 0,
        erro: true,
        mensagem:
          "Verificação de links não executada porque o prompt não está configurado.",
      })),
    };
  }

  const normalized = normalizeVerifyWebSearchCandidates(
    contextoNoticia,
    claimsParaCandidatos,
    searchQueriesResults,
    webSearchCandidatesResult,
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: promptId,
        version: "16",
        variables: {
          url: normalized.contextonoticia.url,
          veiculo: normalized.contextonoticia.veiculo,
          datapublicacao: normalized.contextonoticia.dataPublicacao,
          tipo: normalized.contextonoticia.tipo,
          observacoes: normalized.contextonoticia.observacoes,
          totalclaims: String(normalized.claims.length),
          totalcandidatos: String(
            normalized.claims.reduce(
              (sum, claim) => sum + (claim.candidaturas?.length || 0),
              0,
            ),
          ),
          loteclaims: JSON.stringify(normalized.claims),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[verifyWebSearchCandidates] ❌ Erro na API: ${response.status}`,
      errorText,
    );
    return {
      ok: false,
      etapa: "verifyWebSearchCandidates",
      erro: true,
      status: response.status,
      mensagem: `Erro na API: ${response.status}`,
      detalheOpenAI: errorText,
      claims: claimsParaCandidatos.map((claimItem) => ({
        claimid: claimItem.claim?.id || claimItem.id || claimItem.claimid || 0,
        erro: true,
        mensagem: `Erro na API: ${response.status}`,
      })),
    };
  }

  const data = await response.json();

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
      "[verifyWebSearchCandidates] ⚠️ IA não retornou texto. resposta completa:",
      JSON.stringify(data, null, 2),
    );
    return {
      ok: false,
      etapa: "verifyWebSearchCandidates",
      erro: true,
      mensagem: "IA não retornou resposta",
      detalheOpenAI: JSON.stringify(data, null, 2),
      claims: claimsParaCandidatos.map((claimItem) => ({
        claimid: claimItem.claim?.id || claimItem.id || claimItem.claimid || 0,
        erro: true,
        mensagem: "IA não retornou resposta",
      })),
    };
  }

  let resultado;
  try {
    const textoJson = extractJsonFromText(texto);
    resultado = JSON.parse(textoJson);

    if (!resultado.ok) resultado.ok = true;
    if (!resultado.etapa) resultado.etapa = "verifyWebSearchCandidates";

    if (
      Array.isArray(resultado.resultados) &&
      !Array.isArray(resultado.claims)
    ) {
      resultado.claims = resultado.resultados.map(
        normalizeVerifyWebSearchResultItem,
      );
    } else if (Array.isArray(resultado.claims)) {
      resultado.claims = resultado.claims.map(
        normalizeVerifyWebSearchResultItem,
      );
    }

    console.log(
      `[verifyWebSearchCandidates] ✅ Resposta da IA:`,
      JSON.stringify(resultado, null, 2),
    );
  } catch (e) {
    console.error(
      `[verifyWebSearchCandidates] ❌ JSON inválido recebido da IA:`,
      texto,
    );
    return {
      ok: false,
      etapa: "verifyWebSearchCandidates",
      erro: true,
      mensagem: "Resposta não é JSON válido",
      detalheOpenAI: texto,
      claims: claimsParaCandidatos.map((claimItem) => ({
        claimid: claimItem.claim?.id || claimItem.id || claimItem.claimid || 0,
        erro: true,
        mensagem: "Resposta não é JSON válido",
      })),
    };
  }

  if (!resultado.ok || resultado.etapa !== "verifyWebSearchCandidates") {
    return {
      ok: false,
      etapa: "verifyWebSearchCandidates",
      erro: true,
      mensagem: resultado.mensagem || "Resposta da IA não passou na validação",
      detalheOpenAI: JSON.stringify(resultado, null, 2),
      claims: claimsParaCandidatos.map((claimItem) => ({
        claimid: claimItem.claim?.id || claimItem.id || claimItem.claimid || 0,
        erro: true,
        mensagem: resultado.mensagem || "Resposta inválida",
      })),
    };
  }

  return resultado;
}

module.exports = { verifyWebSearchCandidates };
