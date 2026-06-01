// services/officialFontesRouter.js
// Verifica fontes oficiais em lote para evitar uma chamada OpenAI por claim/fonte.

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
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    if (firstBracket === -1 || firstBrace < firstBracket) {
      return text.slice(firstBrace, lastBrace + 1).trim();
    }
  }

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.slice(firstBracket, lastBracket + 1).trim();
  }

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function toId(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "sim", "yes", "y"].includes(
      value.trim().toLowerCase(),
    );
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

function normalizeOfficialSourceResponse(
  resultado,
  fonte,
  totalCandidatos = 0,
) {
  const resumo = resultado?.resumo || {};
  const conclusao = resultado?.conclusao_preliminar || {};
  const resultados = Array.isArray(resultado?.resultados)
    ? resultado.resultados
    : Array.isArray(resultado?.claims)
      ? resultado.claims
      : [];
  const melhoresEvidencias = Array.isArray(resultado?.melhores_evidencias)
    ? resultado.melhores_evidencias
    : Array.isArray(resultado?.melhoresEvidencias)
      ? resultado.melhoresEvidencias
      : [];

  return {
    ok: resultado?.ok !== false,
    etapa: "officialFontesRouter",
    fonte: resultado?.fonte || resultado?.source || fonte || "",
    claim: {
      texto:
        resultado?.claim?.texto ||
        resultado?.claim?.claimtexto ||
        resultado?.claimtexto ||
        "",
      tipo:
        resultado?.claim?.tipo ||
        resultado?.claim?.claimtipo ||
        resultado?.claimtipo ||
        "",
      fonte_sugerida:
        resultado?.claim?.fonte_sugerida ||
        resultado?.claim?.fonte ||
        resultado?.fonte ||
        fonte ||
        "",
      motivos: resultado?.claim?.motivos || resultado?.motivos || "",
    },
    resultados,
    melhores_evidencias: melhoresEvidencias,
    resumo: {
      total_candidatos_recebidos:
        resumo.total_candidatos_recebidos ?? totalCandidatos,
      total_analisados: resumo.total_analisados ?? resultados.length,
      total_fontes_oficiais: resumo.total_fontes_oficiais ?? 0,
      total_relevantes: resumo.total_relevantes ?? 0,
      total_confirmam: resumo.total_confirmam ?? 0,
      total_contradizem: resumo.total_contradizem ?? 0,
      total_contextualizam: resumo.total_contextualizam ?? 0,
      total_inconclusivos: resumo.total_inconclusivos ?? 0,
      total_irrelevantes: resumo.total_irrelevantes ?? 0,
    },
    conclusao_preliminar: {
      status: conclusao.status || "sem_evidencia_oficial",
      confianca: conclusao.confianca ?? 0.0,
      motivo: conclusao.motivo || "",
    },
  };
}

function getCandidateClaimId(candidate, fallbackClaimId) {
  return (
    candidate?.claimid ??
    candidate?.claim_id ??
    candidate?.claimId ??
    fallbackClaimId
  );
}

function getCandidateOfficialSource(candidate) {
  return (
    candidate?.fonte_oficial ||
    candidate?.fonteOficial ||
    candidate?.official_source ||
    candidate?.officialSource ||
    ""
  );
}

function getOfficialSourceReason(candidate) {
  return (
    candidate?.motivo_fonte_oficial ||
    candidate?.motivoFonteOficial ||
    candidate?.official_source_reason ||
    candidate?.reasonOfficialSource ||
    ""
  );
}

function needsOfficialSource(candidate) {
  return toBoolean(
    candidate?.necessita_fonte_oficial ??
      candidate?.necessitaFonteOficial ??
      candidate?.needs_official_source ??
      candidate?.needsOfficialSource ??
      false,
  );
}

function normalizeCandidateForPrompt(candidate, fallbackClaimId) {
  return {
    claim_id: getCandidateClaimId(candidate, fallbackClaimId),
    claimid: getCandidateClaimId(candidate, fallbackClaimId),
    url: candidate?.url || candidate?.candidate_url || "",
    titulo: candidate?.titulo || candidate?.title || "",
    dominio: candidate?.dominio || candidate?.domain || "",
    necessita_fonte_oficial: needsOfficialSource(candidate),
    fonte_oficial: getCandidateOfficialSource(candidate),
    motivo: candidate?.motivo || "",
    motivo_fonte_oficial: getOfficialSourceReason(candidate),
    confianca: candidate?.confianca_relacao || candidate?.confidence || null,
    alerta: candidate?.alerta ?? candidate?.alert ?? false,
    tipo_alerta: candidate?.tipo_alerta ?? candidate?.tipoAlerta ?? null,
  };
}

function normalizeBatchClaim(claimItem) {
  const claimId =
    claimItem?.claimId ??
    claimItem?.claimid ??
    claimItem?.id ??
    claimItem?.claim?.id ??
    "unknown";

  const candidatos = safeArray(
    claimItem?.candidatos ??
      claimItem?.necessitaFonteOficial ??
      claimItem?.candidates,
  );

  return {
    claimId,
    texto:
      claimItem?.texto ||
      claimItem?.claimTexto ||
      claimItem?.claim?.texto ||
      "",
    tipo:
      claimItem?.tipo || claimItem?.claimTipo || claimItem?.claim?.tipo || "",
    candidatos: candidatos.map((candidate) =>
      normalizeCandidateForPrompt(candidate, claimId),
    ),
  };
}

function buildNoCandidatesClaimResult(claim) {
  return {
    claimId: claim.claimId,
    ok: true,
    etapa: "searchOfficialSourceEvidence",
    mensagem: "Nenhum candidato recebido para verificar em fonte oficial",
    resultados: [],
    resumo: {
      total_candidatos: 0,
      total_com_necessidade_fonte_oficial: 0,
      total_buscados: 0,
      total_com_evidencia_oficial: 0,
      total_sem_evidencia_oficial: 0,
    },
  };
}

function buildErrorClaimResult(claim, mensagem, detalheOpenAI = "") {
  return {
    claimId: claim.claimId,
    ok: false,
    erro: true,
    etapa: "searchOfficialSourceEvidence",
    mensagem,
    detalheOpenAI,
    resultados: [],
    resumo: {
      total_candidatos: claim.candidatos?.length || 0,
      total_com_necessidade_fonte_oficial:
        claim.candidatos?.filter(needsOfficialSource).length || 0,
      total_buscados: 0,
      total_com_evidencia_oficial: 0,
      total_sem_evidencia_oficial: claim.candidatos?.length || 0,
    },
  };
}

function buildNoSearchResultItem(claim, candidate) {
  return {
    claim_id: getCandidateClaimId(candidate, claim.claimId),
    claimtexto: claim.texto,
    necessita_fonte_oficial: false,
    fonte_oficial: getCandidateOfficialSource(candidate),
    busca_realizada: false,
    fontes_pesquisadas: [],
    evidencias_encontradas: [],
    conclusao: {
      status: "sem_evidencia_oficial",
      motivo: "O candidato não exigia busca em fonte oficial.",
    },
  };
}

function buildNoOfficialNeededClaimResult(claim) {
  const resultados = claim.candidatos.map((candidate) =>
    buildNoSearchResultItem(claim, candidate),
  );

  return {
    claimId: claim.claimId,
    ok: true,
    etapa: "searchOfficialSourceEvidence",
    mensagem: "Nenhum candidato exigia busca em fonte oficial",
    resultados,
    resumo: {
      total_candidatos: claim.candidatos.length,
      total_com_necessidade_fonte_oficial: 0,
      total_buscados: 0,
      total_com_evidencia_oficial: 0,
      total_sem_evidencia_oficial: resultados.length,
    },
  };
}

function normalizeConfidence(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(
    0,
    Math.min(1, number > 1 && number <= 100 ? number / 100 : number),
  );
}

function normalizeEvidence(evidence = {}) {
  return {
    ...evidence,
    url: evidence.url || "",
    titulo: evidence.titulo || evidence.title || "",
    dominio: evidence.dominio || evidence.domain || "",
    dominio_oficial: toBoolean(evidence.dominio_oficial),
    fonte_confere_com_solicitada: toBoolean(
      evidence.fonte_confere_com_solicitada,
    ),
    faz_sentido: toBoolean(evidence.faz_sentido),
    tem_dados_uteis: toBoolean(evidence.tem_dados_uteis),
    dado_encontrado: evidence.dado_encontrado || "",
    trecho_relevante: evidence.trecho_relevante || "",
    data_referencia_dado: evidence.data_referencia_dado || "",
    tipo_relacao: evidence.tipo_relacao || "inconclusivo",
    confianca_relacao: normalizeConfidence(evidence.confianca_relacao, 0),
    alerta: toBoolean(evidence.alerta),
    tipo_alerta: evidence.tipo_alerta ?? null,
    usar_como_evidencia: toBoolean(evidence.usar_como_evidencia),
  };
}

function normalizeSearchOfficialResultItem(item = {}, claim) {
  const necessitaFonteOficial = needsOfficialSource(item);

  return {
    ...item,
    claim_id:
      item.claim_id ?? item.claimid ?? item.claimId ?? claim?.claimId ?? "",
    claimtexto: item.claimtexto || item.claimTexto || claim?.texto || "",
    necessita_fonte_oficial: necessitaFonteOficial,
    fonte_oficial:
      item.fonte_oficial ||
      item.fonteOficial ||
      item.official_source ||
      getCandidateOfficialSource(item),
    busca_realizada: toBoolean(item.busca_realizada),
    fontes_pesquisadas: safeArray(item.fontes_pesquisadas),
    evidencias_encontradas: safeArray(item.evidencias_encontradas).map(
      normalizeEvidence,
    ),
    conclusao: {
      status: item.conclusao?.status || "sem_evidencia_oficial",
      motivo: item.conclusao?.motivo || item.motivo || "",
    },
  };
}

function normalizeSearchOfficialResponse(resultado = {}, claim) {
  const rawResultados = Array.isArray(resultado)
    ? resultado
    : resultado.resultados || resultado.claims;
  const resultados = safeArray(rawResultados).map((item) =>
    normalizeSearchOfficialResultItem(item, claim),
  );

  const totalCandidatos = claim?.candidatos?.length || resultados.length;
  const totalComNecessidade = resultados.filter(
    (item) => item.necessita_fonte_oficial,
  ).length;
  const totalBuscados = resultados.filter(
    (item) => item.busca_realizada,
  ).length;
  const totalComEvidencia = resultados.filter((item) =>
    safeArray(item.evidencias_encontradas).some(
      (evidence) => evidence.usar_como_evidencia && evidence.dominio_oficial,
    ),
  ).length;

  return {
    claimId: claim?.claimId,
    ok: resultado.ok !== false,
    etapa: "searchOfficialSourceEvidence",
    mensagem: resultado.mensagem || "Verificacao em fontes oficiais completa",
    resultados,
    resumo: {
      total_candidatos: resultado.resumo?.total_candidatos ?? totalCandidatos,
      total_com_necessidade_fonte_oficial:
        resultado.resumo?.total_com_necessidade_fonte_oficial ??
        totalComNecessidade,
      total_buscados: resultado.resumo?.total_buscados ?? totalBuscados,
      total_com_evidencia_oficial:
        resultado.resumo?.total_com_evidencia_oficial ?? totalComEvidencia,
      total_sem_evidencia_oficial:
        resultado.resumo?.total_sem_evidencia_oficial ??
        Math.max(0, totalCandidatos - totalComEvidencia),
    },
    resposta_ia: resultado,
  };
}

function extractBatchItems(resultado) {
  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.claims)) return resultado.claims;
  if (Array.isArray(resultado?.resultados)) return resultado.resultados;
  if (resultado && typeof resultado === "object") return [resultado];
  return [];
}

function normalizeClaimOfficialResult(item, fallbackClaim) {
  const claimId =
    item?.claimId ??
    item?.claimid ??
    item?.claim_id ??
    item?.id ??
    fallbackClaim?.claimId;

  const isSourceLevel =
    item?.fonte ||
    item?.source ||
    item?.claim ||
    item?.conclusao_preliminar ||
    item?.resumo;

  const sourceItems = isSourceLevel
    ? [item]
    : safeArray(
        item?.resultados ||
          item?.fontes ||
          item?.fontes_oficiais ||
          item?.officialSources,
      );

  const resultados = sourceItems.map((sourceItem) =>
    normalizeOfficialSourceResponse(
      sourceItem,
      sourceItem?.fonte || sourceItem?.source || "",
      fallbackClaim?.candidatos?.length || 0,
    ),
  );

  return {
    claimId,
    ok: item?.ok !== false && resultados.every((result) => result.ok !== false),
    etapa: "officialFontesRouter",
    mensagem: item?.mensagem || item?.message || "Verificacao em lote completa",
    resultados,
  };
}

function normalizeOfficialBatchResponse(resultado, claimsBatch) {
  const claimsComCandidatos = claimsBatch.filter(
    (claim) => claim.candidatos.length > 0,
  );
  const responseHasClaimList = Array.isArray(resultado?.claims);
  const items = responseHasClaimList
    ? resultado.claims
    : extractBatchItems(resultado);

  if (items.length === 0) {
    return claimsBatch.map((claim) =>
      claim.candidatos.length === 0
        ? buildNoCandidatesClaimResult(claim)
        : buildErrorClaimResult(
            claim,
            "IA nao retornou resultado para esta claim",
          ),
    );
  }

  const groupedSourceItems = new Map();
  const claimLevelItems = [];

  items.forEach((item, index) => {
    const itemClaimId =
      item?.claimId ?? item?.claimid ?? item?.claim_id ?? item?.id;
    const looksLikeClaimLevel =
      responseHasClaimList ||
      (!item?.fonte &&
        !item?.source &&
        (Array.isArray(item?.resultados) ||
          Array.isArray(item?.fontes) ||
          Array.isArray(item?.fontes_oficiais) ||
          Array.isArray(item?.officialSources)));

    if (
      itemClaimId !== undefined &&
      itemClaimId !== null &&
      !looksLikeClaimLevel
    ) {
      const key = toId(itemClaimId);
      const entry = groupedSourceItems.get(key) || [];
      entry.push(item);
      groupedSourceItems.set(key, entry);
      return;
    }

    const fallbackById =
      itemClaimId !== undefined && itemClaimId !== null
        ? claimsBatch.find((claim) => toId(claim.claimId) === toId(itemClaimId))
        : null;

    claimLevelItems.push({
      item,
      fallbackClaim:
        fallbackById || claimsComCandidatos[index] || claimsComCandidatos[0],
    });
  });

  const normalizedByClaimId = new Map();

  groupedSourceItems.forEach((sourceItems, key) => {
    const fallbackClaim =
      claimsBatch.find((claim) => toId(claim.claimId) === key) ||
      claimsComCandidatos[0];
    normalizedByClaimId.set(
      key,
      normalizeClaimOfficialResult(
        { claimId: fallbackClaim?.claimId || key, resultados: sourceItems },
        fallbackClaim,
      ),
    );
  });

  claimLevelItems.forEach(({ item, fallbackClaim }) => {
    if (!fallbackClaim) return;
    normalizedByClaimId.set(
      toId(fallbackClaim.claimId),
      normalizeClaimOfficialResult(item, fallbackClaim),
    );
  });

  return claimsBatch.map((claim) => {
    if (claim.candidatos.length === 0) {
      return buildNoCandidatesClaimResult(claim);
    }

    return (
      normalizedByClaimId.get(toId(claim.claimId)) ||
      buildErrorClaimResult(claim, "IA nao retornou resultado para esta claim")
    );
  });
}

async function officialFontesRouterBatch(contextoNoticia, claimsParaVerificar) {
  const claimsBatch = safeArray(claimsParaVerificar).map(normalizeBatchClaim);
  const claimsComCandidatos = claimsBatch.filter(
    (claim) => claim.candidatos.length > 0,
  );
  const claimsComFonte = claimsBatch.filter((claim) =>
    claim.candidatos.some(needsOfficialSource),
  );
  const totalCandidatosRecebidos = claimsComCandidatos.reduce(
    (total, claim) => total + claim.candidatos.length,
    0,
  );
  const totalNecessitaFonteOficial = claimsComFonte.reduce(
    (total, claim) =>
      total + claim.candidatos.filter(needsOfficialSource).length,
    0,
  );

  console.log(
    `[officialFontesRouter] Processando ${claimsBatch.length} claims para fontes oficiais...`,
  );

  const promptId = process.env.OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID;
  if (!promptId) {
    console.warn(
      "[officialFontesRouter] Aviso: OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID nao configurado.",
    );
    const claimsSemPrompt = claimsBatch.map((claim) => {
      if (claim.candidatos.length === 0) {
        return buildNoCandidatesClaimResult(claim);
      }
      if (!claim.candidatos.some(needsOfficialSource)) {
        return buildNoOfficialNeededClaimResult(claim);
      }
      return buildErrorClaimResult(
        claim,
        "Prompt de verificacao de fontes oficiais nao configurado.",
      );
    });
    const precisaPrompt = claimsBatch.some((claim) =>
      claim.candidatos.some(needsOfficialSource),
    );
    return {
      ok: !precisaPrompt,
      etapa: "officialFontesRouter",
      mensagem: precisaPrompt
        ? "Prompt de verificacao de fontes oficiais nao configurado. Defina OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID."
        : "Nenhum candidato exigia busca em fonte oficial",
      claims: claimsSemPrompt,
      summary: {
        totalClaims: claimsBatch.length,
        totalCandidatos: totalCandidatosRecebidos,
        totalNecessitaFonteOficial,
        totalOpenAICalls: 0,
      },
    };
  }

  if (totalCandidatosRecebidos === 0) {
    return {
      ok: true,
      etapa: "officialFontesRouter",
      mensagem: "Nenhum candidato recebido para verificacao",
      claims: claimsBatch.map(buildNoCandidatesClaimResult),
      summary: {
        totalClaims: claimsBatch.length,
        totalCandidatos: 0,
        totalNecessitaFonteOficial: 0,
        totalOpenAICalls: 0,
      },
    };
  }

  async function verificarClaim(claim) {
    if (claim.candidatos.length === 0) {
      return buildNoCandidatesClaimResult(claim);
    }

    if (!claim.candidatos.some(needsOfficialSource)) {
      return buildNoOfficialNeededClaimResult(claim);
    }

    const candidatesPayload = JSON.stringify(claim.candidatos);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: {
          id: promptId,
          version: "13",
          variables: {
            claimtexto: claim.texto || "",
            candidatos: candidatesPayload,
          },
        },
        input:
          "Analise os candidatos de prompt.variables.candidatos para a claim em prompt.variables.claimtexto. " +
          "Retorne apenas JSON puro com ok=true, etapa='searchOfficialSourceEvidence', resultados=[] e resumo={}. " +
          "Nao retorne markdown nem comentarios fora do JSON.",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[officialFontesRouter] Erro na API para lote: ${response.status}`,
        errorText,
      );
      return buildErrorClaimResult(
        claim,
        `Erro na API: ${response.status}`,
        errorText,
      );
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
        "[officialFontesRouter] IA nao retornou texto para a claim.",
        JSON.stringify(data, null, 2),
      );
      return buildErrorClaimResult(
        claim,
        "IA nao retornou resposta",
        JSON.stringify(data, null, 2),
      );
    }

    const parsed = JSON.parse(extractJsonFromText(texto));
    return normalizeSearchOfficialResponse(parsed, claim);
  }

  const claims = [];
  let totalOpenAICalls = 0;

  for (const claim of claimsBatch) {
    try {
      const precisavaChamada = claim.candidatos.some(needsOfficialSource);
      const resultadoClaim = await verificarClaim(claim);
      if (precisavaChamada) totalOpenAICalls += 1;
      claims.push(resultadoClaim);
    } catch (err) {
      console.error(
        "[officialFontesRouter] Erro ao processar claim:",
        err.message,
      );
      claims.push(
        buildErrorClaimResult(claim, `Erro ao processar: ${err.message}`),
      );
      if (claim.candidatos.some(needsOfficialSource)) totalOpenAICalls += 1;
    }
  }

  console.log(
    `[officialFontesRouter] Resposta para ${claims.length} claims:`,
    JSON.stringify(claims, null, 2),
  );

  return {
    ok: claims.every((claim) => claim.ok !== false),
    etapa: "officialFontesRouter",
    mensagem: "Verificacao em fontes oficiais completa",
    claims,
    summary: {
      totalClaims: claimsBatch.length,
      totalCandidatos: totalCandidatosRecebidos,
      totalNecessitaFonteOficial,
      totalOpenAICalls,
    },
  };
}

async function officialFontesRouter(
  contextoNoticia,
  claimData,
  candidatosParaVerificar,
) {
  const batchResult = await officialFontesRouterBatch(contextoNoticia, [
    {
      claimId: claimData?.claimId || claimData?.claimid || claimData?.id,
      texto: claimData?.texto || claimData?.claimTexto || "",
      tipo: claimData?.tipo || claimData?.claimTipo || "",
      candidatos: candidatosParaVerificar,
    },
  ]);

  const firstClaim = batchResult.claims?.[0] || {};
  return {
    ok: firstClaim.ok ?? batchResult.ok,
    erro: firstClaim.erro,
    etapa: firstClaim.etapa || "searchOfficialSourceEvidence",
    mensagem: firstClaim.mensagem || batchResult.mensagem,
    detalheOpenAI: firstClaim.detalheOpenAI || batchResult.detalheOpenAI,
    resultados: firstClaim.resultados || [],
    resumo: firstClaim.resumo || {},
    resposta_ia: firstClaim.resposta_ia,
  };
}

module.exports = { officialFontesRouter, officialFontesRouterBatch };
