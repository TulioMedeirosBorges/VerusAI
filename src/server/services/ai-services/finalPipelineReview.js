// services/ai-services/finalPipelineReview.js
// Sends the fully updated pipeline state to a final AI review step.

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return "";
}

function getClaimId(item) {
  const id = firstValue(
    item?.claimid,
    item?.claimId,
    item?.claim_id,
    item?.id,
    item?.claim?.id,
    "unknown",
  );
  return String(id);
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function mapByClaimId(items, idGetter = getClaimId) {
  const map = new Map();
  safeArray(items).forEach((item) => {
    const id = String(idGetter(item));
    if (id !== "" && id !== undefined && id !== null) {
      map.set(id, item);
    }
  });
  return map;
}

function groupByClaimId(items, idGetter = getClaimId) {
  const map = new Map();
  safeArray(items).forEach((item) => {
    const id = String(idGetter(item));
    const group = map.get(id) || [];
    group.push(item);
    map.set(id, group);
  });
  return map;
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

function buildCandidateLookup(candidates) {
  const byUrl = new Map();

  safeArray(candidates).forEach((candidate) => {
    const claimId = getClaimId(candidate);
    const url = normalizeUrl(candidate?.url || candidate?.candidate_url);
    if (!url) return;
    byUrl.set(`${claimId}::${url}`, candidate);
  });

  return byUrl;
}

function hasCandidateUrl(candidate) {
  return Boolean(normalizeUrl(candidate?.url || candidate?.candidate_url));
}

function getRouteCandidates(rotaClaim) {
  return [
    ...safeArray(rotaClaim?.necessitaApi),
    ...safeArray(rotaClaim?.necessitaFonteOficial),
    ...safeArray(rotaClaim?.nenhum),
  ];
}

function getRotaFromClaim(rotaClaim, candidate) {
  const url = normalizeUrl(candidate?.url || candidate?.candidate_url);
  if (!rotaClaim || !url) return "nao_roteado";

  const groups = [
    ["necessita_api", rotaClaim.necessitaApi],
    ["necessita_fonte_oficial", rotaClaim.necessitaFonteOficial],
    ["nenhum_processamento_adicional", rotaClaim.nenhum],
  ];

  for (const [label, items] of groups) {
    const found = safeArray(items).some((item) => {
      const itemUrl = normalizeUrl(item?.url || item?.candidate_url);
      return itemUrl === url;
    });
    if (found) return label;
  }

  return "nao_roteado";
}

function normalizeCandidateForFinalAI(candidate, previousCandidate, rota) {
  return {
    claimid: getClaimId(candidate),
    url: firstValue(
      candidate?.url,
      candidate?.candidate_url,
      previousCandidate?.url,
    ),
    titulo: firstValue(
      candidate?.titulo,
      candidate?.title,
      previousCandidate?.titulo,
    ),
    dominio: firstValue(candidate?.dominio, previousCandidate?.dominio),
    fonteId: firstValue(
      candidate?.fonteId,
      candidate?.fonte_id,
      previousCandidate?.fonteId,
    ),
    queryUsada: firstValue(
      candidate?.queryUsada,
      candidate?.query,
      previousCandidate?.queryUsada,
      previousCandidate?.query,
    ),
    tipoFonteCandidata: firstValue(
      candidate?.tipoFonteCandidata,
      candidate?.tipoFonte,
      previousCandidate?.tipoFonteCandidata,
      previousCandidate?.tipoFonte,
    ),
    prioridadeQuery: firstValue(
      candidate?.prioridadeQuery,
      candidate?.prioridade,
      previousCandidate?.prioridadeQuery,
      previousCandidate?.prioridade,
    ),
    statusBusca: firstValue(candidate?.status, previousCandidate?.status),
    trechoBusca: firstValue(
      candidate?.trechoBusca,
      previousCandidate?.trechoBusca,
    ),
    termosEncontrados: safeArray(
      firstValue(
        candidate?.termosEncontrados,
        previousCandidate?.termosEncontrados,
      ),
    ),
    faz_sentido: firstValue(
      candidate?.faz_sentido,
      candidate?.fazSentido,
      false,
    ),
    confianca_relacao: firstValue(
      candidate?.confianca_relacao,
      candidate?.confidence,
      candidate?.confidence_relation,
      null,
    ),
    motivo_verificacao: firstValue(candidate?.motivo, candidate?.reason),
    alerta: firstValue(candidate?.alerta, candidate?.alert, false),
    tipo_alerta: firstValue(
      candidate?.tipo_alerta,
      candidate?.tipoAlerta,
      null,
    ),
    necessita_api: firstValue(
      candidate?.necessita_api,
      candidate?.necessitaApi,
      candidate?.needs_api,
      false,
    ),
    api: firstValue(candidate?.api, candidate?.API, candidate?.api_name, null),
    motivo_api: firstValue(
      candidate?.motivo_api,
      candidate?.motivoApi,
      candidate?.api_reason,
    ),
    necessita_fonte_oficial: firstValue(
      candidate?.necessita_fonte_oficial,
      candidate?.necessitaFonteOficial,
      candidate?.needs_official_source,
      false,
    ),
    fonte_oficial: firstValue(
      candidate?.fonte_oficial,
      candidate?.fonteOficial,
      candidate?.official_source,
      null,
    ),
    motivo_fonte_oficial: firstValue(
      candidate?.motivo_fonte_oficial,
      candidate?.motivoFonteOficial,
      candidate?.official_source_reason,
    ),
    rota,
  };
}

function normalizeOfficialSourcesForFinalAI(officialClaim) {
  return {
    ok: officialClaim?.ok ?? false,
    etapa: officialClaim?.etapa || "",
    mensagem: officialClaim?.mensagem || "",
    resultados: safeArray(officialClaim?.resultados).map((sourceResult) => ({
      claim_id: firstValue(
        sourceResult?.claim_id,
        sourceResult?.claimid,
        sourceResult?.claimId,
      ),
      claimtexto: firstValue(
        sourceResult?.claimtexto,
        sourceResult?.claimTexto,
        sourceResult?.claim?.texto,
      ),
      necessita_fonte_oficial: toBoolean(
        firstValue(sourceResult?.necessita_fonte_oficial, false),
      ),
      fonte_oficial: firstValue(
        sourceResult?.fonte_oficial,
        sourceResult?.fonteOficial,
        sourceResult?.fonte,
        sourceResult?.source,
      ),
      busca_realizada: toBoolean(
        firstValue(sourceResult?.busca_realizada, false),
      ),
      fontes_pesquisadas: safeArray(sourceResult?.fontes_pesquisadas),
      evidencias_encontradas: safeArray(
        sourceResult?.evidencias_encontradas ||
          sourceResult?.melhores_evidencias,
      ),
      conclusao:
        sourceResult?.conclusao || sourceResult?.conclusao_preliminar || {},

      // Compatibilidade com respostas antigas salvas antes do novo prompt.
      fonte: sourceResult?.fonte || "",
      ok: sourceResult?.ok ?? true,
      claim: sourceResult?.claim || {},
      resultados: safeArray(sourceResult?.resultados),
      melhores_evidencias: safeArray(sourceResult?.melhores_evidencias),
      resumo: sourceResult?.resumo || {},
      conclusao_preliminar: sourceResult?.conclusao_preliminar || {},
    })),
    resumo: officialClaim?.resumo || {},
  };
}

function normalizeFinalPipelineForAI(resultado) {
  const claimsOriginais = safeArray(resultado?.etapa2_claims?.claims);
  const tiposPorClaimId = mapByClaimId(resultado?.etapa3_tiposdeclaims);
  const queriesPorClaimId = mapByClaimId(resultado?.etapa4_searchqueries);
  const candidatosBusca = safeArray(resultado?.etapa5_websearchcandidates);
  const candidatosBuscaPorUrl = buildCandidateLookup(candidatosBusca);
  const candidatosBuscaPorClaimId = groupByClaimId(candidatosBusca);
  const verificadosPorClaimId = groupByClaimId(
    resultado?.etapa6_verifyWebSearchCandidates?.claims,
  );
  const rotasPorClaimId = mapByClaimId(
    resultado?.etapa7_rotaCandidatos?.claims,
    (claim) => claim?.claimId ?? claim?.claimid ?? claim?.id ?? "unknown",
  );
  const oficiaisPorClaimId = mapByClaimId(
    resultado?.etapa8_officialFontes?.claims,
    (claim) => claim?.claimId ?? claim?.claimid ?? claim?.id ?? "unknown",
  );

  const claimIds = new Set([
    ...claimsOriginais.map((claim) => getClaimId(claim)),
    ...tiposPorClaimId.keys(),
    ...queriesPorClaimId.keys(),
    ...verificadosPorClaimId.keys(),
    ...rotasPorClaimId.keys(),
    ...oficiaisPorClaimId.keys(),
  ]);

  const contextoNoticia = {
    url: resultado?.url || resultado?.etapa2_claims?.contexto?.url || "",
    domain: resultado?.domain || "",
    veiculo:
      resultado?.sitename || resultado?.etapa2_claims?.contexto?.veiculo || "",
    datapublicacao:
      resultado?.publishdate ||
      resultado?.etapa2_claims?.contexto?.datapublicacao ||
      "",
    tipo: resultado?.tipo || resultado?.etapa2_claims?.contexto?.tipo || "",
    titulo: resultado?.titulo || "",
    status: resultado?.status || "",
    classificacaoFinal: {
      categoriapagina: resultado?.categoriapagina || "",
      categoriatextoprincipal: resultado?.categoriatextoprincipal || "",
      tipo: resultado?.tipo || "",
    },
  };

  const claims = Array.from(claimIds).map((claimId) => {
    const originalClaim =
      claimsOriginais.find((claim) => getClaimId(claim) === claimId) || {};
    const tipo = tiposPorClaimId.get(claimId) || {};
    const query = queriesPorClaimId.get(claimId) || {};
    const rota = rotasPorClaimId.get(claimId) || {};
    const official = oficiaisPorClaimId.get(claimId) || {};
    const candidatosVerificados = verificadosPorClaimId.get(claimId) || [];
    const candidatosRoteados = getRouteCandidates(rota).filter(hasCandidateUrl);
    const candidatosBuscaClaim = candidatosBuscaPorClaimId.get(claimId) || [];
    const candidatosAtualizados = candidatosVerificados.some(hasCandidateUrl)
      ? candidatosVerificados
      : candidatosRoteados.length > 0
        ? candidatosRoteados
        : candidatosBuscaClaim;

    return {
      claimid: claimId,
      texto: firstValue(
        rota?.claimTexto,
        originalClaim?.texto,
        query?.claimtexto,
        tipo?.claimtexto,
      ),
      tipo_claim: firstValue(
        rota?.claimTipo,
        originalClaim?.tipo,
        originalClaim?.tipoclaim,
      ),
      importancia: originalClaim?.importancia || "",
      motivo: originalClaim?.motivo || "",
      elementos: originalClaim?.elementos || {},
      verificacoes: originalClaim?.verificacoes || {},
      contextochecagem: originalClaim?.contextochecagem || "",
      tipoverificacao: firstValue(
        tipo?.tipoverificacao,
        tipo?.dadoscompletos?.tipoverificacao,
      ),
      categoriaprincipal: firstValue(
        tipo?.categoriaprincipal,
        tipo?.dadoscompletos?.categoriaprincipal,
      ),
      nivelprioridade: firstValue(tipo?.nivelprioridade, "media"),
      classificacao_verificacao: tipo?.dadoscompletos || tipo || {},
      buscas: {
        queries: safeArray(query?.queries),
        consultasAPIs: safeArray(query?.consultasapis || query?.consultasAPIs),
        alertasBusca: safeArray(query?.alertasbusca || query?.alertasBusca),
        observacoes: query?.observacoes || "",
      },
      candidatos_atualizados: candidatosAtualizados.map((candidate) => {
        const url = normalizeUrl(candidate?.url || candidate?.candidate_url);
        const previousCandidate = candidatosBuscaPorUrl.get(
          `${claimId}::${url}`,
        );
        return normalizeCandidateForFinalAI(
          candidate,
          previousCandidate,
          getRotaFromClaim(rota, candidate),
        );
      }),
      roteamento_atualizado: {
        necessitaApi: safeArray(rota?.necessitaApi).length,
        necessitaFonteOficial: safeArray(rota?.necessitaFonteOficial).length,
        nenhum: safeArray(rota?.nenhum).length,
      },
      fontes_oficiais_atualizadas: normalizeOfficialSourcesForFinalAI(official),
    };
  });

  return {
    etapa: "finalPipelineReviewInput",
    atualizado_apos_etapa: "etapa8_officialFontes",
    contextonoticia: contextoNoticia,
    claims,
    resumo_pipeline: {
      totalclaims: claims.length,
      total_candidatos_atualizados: claims.reduce(
        (total, claim) => total + claim.candidatos_atualizados.length,
        0,
      ),
      total_fontes_oficiais:
        resultado?.etapa8_officialFontes?.summary?.totalFontesCalls ?? 0,
      rota: resultado?.etapa7_rotaCandidatos?.summary || {},
    },
  };
}

function toNumber(value, fallback = 0) {
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".").replace("%", "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function normalizeChoice(value, validValues, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  return validValues.includes(normalized) ? normalized : fallback;
}

function toConfidence(value, fallback = 0) {
  const number = toNumber(value, fallback);
  const decimal = number > 1 && number <= 100 ? number / 100 : number;
  return Math.max(0, Math.min(1, decimal));
}

function normalizeClaimIdForOutput(value) {
  const raw = firstValue(value, "");
  const numeric = Number(raw);
  return Number.isInteger(numeric) && String(raw).trim() !== "" ? numeric : raw;
}

function normalizeEntityLists(entidades = {}) {
  return {
    pessoas: safeArray(entidades.pessoas),
    locais: safeArray(entidades.locais),
    cidades: safeArray(entidades.cidades),
    estados: safeArray(entidades.estados),
    paises: safeArray(entidades.paises),
    regioes: safeArray(entidades.regioes),
    instituicoes: safeArray(entidades.instituicoes),
    orgaos_publicos: safeArray(
      entidades.orgaos_publicos || entidades.orgaosPublicos,
    ),
    empresas: safeArray(entidades.empresas),
    projetos: safeArray(entidades.projetos),
    partidos: safeArray(entidades.partidos),
    cargos: safeArray(entidades.cargos),
    eventos: safeArray(entidades.eventos),
    conceitos: safeArray(entidades.conceitos),
    outros: safeArray(entidades.outros),
  };
}

function normalizeFonteUsada(fonte = {}) {
  return {
    url: fonte.url || "",
    dominio: fonte.dominio || fonte.domain || "",
    tipoFonte: normalizeChoice(
      fonte.tipoFonte || fonte.tipo_fonte,
      [
        "jornalistica",
        "oficial",
        "checagem",
        "documento_publico",
        "rede_social",
        "outra",
      ],
      "outra",
    ),
    peso_aproximado: normalizeChoice(
      fonte.peso_aproximado || fonte.pesoAproximado,
      ["alto", "medio", "baixo"],
      "baixo",
    ),
    como_foi_usada: normalizeChoice(
      fonte.como_foi_usada || fonte.comoFoiUsada,
      ["confirmacao", "contradicao", "contexto", "insuficiente"],
      "insuficiente",
    ),
  };
}

function normalizeFonteOficialUsada(fonte = {}) {
  return {
    url: fonte.url || "",
    dominio: fonte.dominio || fonte.domain || "",
    fonteOficial: fonte.fonteOficial || fonte.fonte_oficial || "",
    como_foi_usada: normalizeChoice(
      fonte.como_foi_usada || fonte.comoFoiUsada,
      ["confirmacao", "contradicao", "contexto", "insuficiente"],
      "insuficiente",
    ),
    explicacao: fonte.explicacao || "",
  };
}

const BUILD_FINAL_VERDICTS = [
  "confirmada",
  "parcialmente_confirmada",
  "inconclusiva",
  "contradita",
  "erro",
];

function normalizeBuildFinalVerdict(value, fallback = "inconclusiva") {
  const normalized = normalizeChoice(
    value,
    [...BUILD_FINAL_VERDICTS, "parcial"],
    fallback,
  );

  return normalized === "parcial" ? "parcialmente_confirmada" : normalized;
}

function inferBuildFinalVerdict(resultados = []) {
  if (resultados.length === 0) return "inconclusiva";
  if (resultados.every((resultado) => resultado.status === "erro")) {
    return "erro";
  }
  if (resultados.some((resultado) => resultado.status === "contradita")) {
    return "contradita";
  }
  if (resultados.some((resultado) => resultado.status === "parcial")) {
    return "parcialmente_confirmada";
  }
  if (
    resultados.length > 0 &&
    resultados.every((resultado) => resultado.status === "confirmada")
  ) {
    return "confirmada";
  }
  return "inconclusiva";
}

function inferBuildFinalConfidence(resultados = []) {
  if (resultados.length === 0) return 0;
  const total = resultados.reduce(
    (sum, resultado) => sum + toConfidence(resultado.confianca, 0),
    0,
  );
  return total / resultados.length;
}

function normalizeBuildFinalClaim(claim = {}) {
  const data = claim || {};

  return {
    claim_id: normalizeClaimIdForOutput(
      firstValue(data.claim_id, data.claimId, data.claimid, data.id),
    ),
    texto: firstValue(data.texto, data.claim_texto, data.claimTexto, data.text),
    veredito_sugerido: normalizeBuildFinalVerdict(
      firstValue(
        data.veredito_sugerido,
        data.vereditoSugerido,
        data.status_sugerido,
        data.statusSugerido,
        data.veredito,
        data.status,
      ),
    ),
    confianca_sugerida: toConfidence(
      firstValue(
        data.confianca_sugerida,
        data.confiancaSugerida,
        data.confianca,
        data.confidence,
      ),
      0,
    ),
    motivo: firstValue(data.motivo, data.justificativa, data.explicacao),
    precisa_nova_busca: toBoolean(
      firstValue(
        data.precisa_nova_busca,
        data.precisaNovaBusca,
        data.necessita_mais_busca,
        data.necessitaMaisBusca,
        false,
      ),
    ),
    motivo_precisa_nova_busca: firstValue(
      data.motivo_precisa_nova_busca,
      data.motivoPrecisaNovaBusca,
      data.motivo_necessita_mais_busca,
      data.motivoNecessitaMaisBusca,
    ),
    alertas: safeArray(data.alertas || data.alerts),
    fontes_chave: safeArray(
      data.fontes_chave || data.fontesChave || data.fontes,
    ),
  };
}

function normalizeAnaliseParaBuildFinal(analise = {}, resultados = []) {
  const data = analise || {};

  return {
    veredito_preliminar_sugerido: normalizeBuildFinalVerdict(
      firstValue(
        data.veredito_preliminar_sugerido,
        data.vereditoPreliminarSugerido,
        data.veredito,
        inferBuildFinalVerdict(resultados),
      ),
    ),
    confianca_geral_sugerida: toConfidence(
      firstValue(
        data.confianca_geral_sugerida,
        data.confiancaGeralSugerida,
        data.confianca,
        inferBuildFinalConfidence(resultados),
      ),
      0,
    ),
    precisa_nova_busca_global: toBoolean(
      firstValue(
        data.precisa_nova_busca_global,
        data.precisaNovaBuscaGlobal,
        data.necessita_mais_busca_global,
        data.necessitaMaisBuscaGlobal,
        resultados.some((resultado) => resultado.necessita_mais_busca),
      ),
    ),
    motivo_precisa_nova_busca_global: firstValue(
      data.motivo_precisa_nova_busca_global,
      data.motivoPrecisaNovaBuscaGlobal,
      data.motivo_necessita_mais_busca_global,
      data.motivoNecessitaMaisBuscaGlobal,
    ),
    principais_alertas_globais: safeArray(
      data.principais_alertas_globais ||
        data.principaisAlertasGlobais ||
        data.alertas_globais ||
        data.alertasGlobais,
    ),
    claims_mais_importantes: safeArray(
      data.claims_mais_importantes || data.claimsMaisImportantes,
    ).map(normalizeBuildFinalClaim),
  };
}

function normalizeSimpleCheckResult(resultado = {}) {
  const status = normalizeChoice(
    resultado.status,
    [
      "confirmada",
      "contradita",
      "parcial",
      "parcialmente_confirmada",
      "inconclusiva",
      "erro",
    ],
    "inconclusiva",
  );

  return {
    claim_id: normalizeClaimIdForOutput(
      firstValue(resultado.claim_id, resultado.claimId, resultado.claimid),
    ),
    texto: resultado.texto || "",
    importancia: normalizeChoice(
      resultado.importancia,
      ["alta", "media", "baixa"],
      "media",
    ),
    status: normalizeChoice(
      status === "parcialmente_confirmada" ? "parcial" : status,
      ["confirmada", "contradita", "parcial", "inconclusiva", "erro"],
      "inconclusiva",
    ),
    confianca: toConfidence(resultado.confianca, 0),

    resumo_verificacao:
      resultado.resumo_verificacao || resultado.resumoVerificacao || "",
    explicacao: resultado.explicacao || "",

    fontes_usadas: safeArray(
      resultado.fontes_usadas || resultado.fontesUsadas,
    ).map(normalizeFonteUsada),

    fontes_oficiais_usadas: safeArray(
      resultado.fontes_oficiais_usadas || resultado.fontesOficiaisUsadas,
    ).map(normalizeFonteOficialUsada),

    pontos_confirmam: safeArray(
      resultado.pontos_confirmam || resultado.pontosConfirmam,
    ),
    pontos_contradizem: safeArray(
      resultado.pontos_contradizem || resultado.pontosContradizem,
    ),
    pontos_inconclusivos: safeArray(
      resultado.pontos_inconclusivos || resultado.pontosInconclusivos,
    ),

    entidades_citadas: normalizeEntityLists(
      resultado.entidades_citadas || resultado.entidadesCitadas,
    ),

    alertas: safeArray(resultado.alertas),
    necessita_mais_busca: toBoolean(
      resultado.necessita_mais_busca || resultado.necessitaMaisBusca,
    ),
    motivo_necessita_mais_busca:
      resultado.motivo_necessita_mais_busca ||
      resultado.motivoNecessitaMaisBusca ||
      "",
  };
}

function normalizeSimpleCheckResumo(resumo = {}, resultados = []) {
  const counts = resultados.reduce(
    (acc, resultado) => {
      if (resultado.status === "confirmada") acc.confirmadas += 1;
      if (resultado.status === "contradita") acc.contraditas += 1;
      if (resultado.status === "parcial") acc.parciais += 1;
      if (resultado.status === "inconclusiva") acc.inconclusivas += 1;
      if (resultado.status === "erro") acc.erros += 1;
      return acc;
    },
    {
      confirmadas: 0,
      contraditas: 0,
      parciais: 0,
      inconclusivas: 0,
      erros: 0,
    },
  );

  return {
    total_claims: toNumber(
      resumo.total_claims || resumo.totalClaims,
      resultados.length,
    ),
    total_confirmadas: toNumber(
      resumo.total_confirmadas || resumo.totalConfirmadas,
      counts.confirmadas,
    ),
    total_contraditas: toNumber(
      resumo.total_contraditas || resumo.totalContraditas,
      counts.contraditas,
    ),
    total_parciais: toNumber(
      resumo.total_parciais || resumo.totalParciais,
      counts.parciais,
    ),
    total_inconclusivas: toNumber(
      resumo.total_inconclusivas || resumo.totalInconclusivas,
      counts.inconclusivas,
    ),
    total_erros: toNumber(
      resumo.total_erros || resumo.totalErros,
      counts.erros,
    ),
  };
}

function normalizeFinalReviewResponse(resultado) {
  const resultados = safeArray(resultado?.resultados || resultado?.claims).map(
    normalizeSimpleCheckResult,
  );
  const analiseParaBuildFinal =
    resultado?.analise_para_build_final || resultado?.analiseParaBuildFinal;

  return {
    ok: resultado?.ok !== false,
    etapa: "simpleCheckClaims",
    resultados,
    resumo: normalizeSimpleCheckResumo(resultado?.resumo, resultados),
    analise_para_build_final: normalizeAnaliseParaBuildFinal(
      analiseParaBuildFinal,
      resultados,
    ),
  };
}

function buildFinalReviewErrorResponse(dadosAtualizados, mensagem) {
  const resultados = safeArray(dadosAtualizados?.claims).map((claim) =>
    normalizeSimpleCheckResult({
      claim_id: claim.claimid,
      texto: claim.texto,
      importancia: claim.importancia || claim.nivelprioridade,
      status: "erro",
      confianca: 0,
      resumo_verificacao: "Analise final nao executada.",
      explicacao: mensagem,
      alertas: [mensagem],
    }),
  );

  return {
    ok: false,
    etapa: "simpleCheckClaims",
    resultados,
    resumo: normalizeSimpleCheckResumo({}, resultados),
    analise_para_build_final: normalizeAnaliseParaBuildFinal(
      {
        veredito_preliminar_sugerido: "erro",
        confianca_geral_sugerida: 0,
        precisa_nova_busca_global: true,
        motivo_precisa_nova_busca_global: mensagem,
        principais_alertas_globais: [mensagem],
        claims_mais_importantes: resultados.map((resultado) => ({
          claim_id: resultado.claim_id,
          texto: resultado.texto,
          veredito_sugerido: "erro",
          confianca_sugerida: 0,
          motivo: mensagem,
          precisa_nova_busca: true,
          motivo_precisa_nova_busca: mensagem,
          alertas: resultado.alertas,
          fontes_chave: [],
        })),
      },
      resultados,
    ),
  };
}

async function finalPipelineReview(resultadoPipeline) {
  const dadosAtualizados = normalizeFinalPipelineForAI(resultadoPipeline);
  const promptId = process.env.OPENAI_FINAL_PIPELINE_REVIEW_PROMPT_ID;

  if (!promptId) {
    const resultadoErro = buildFinalReviewErrorResponse(
      dadosAtualizados,
      "Prompt da analise final nao configurado. Defina OPENAI_FINAL_PIPELINE_REVIEW_PROMPT_ID.",
    );
    console.log(
      "[finalPipelineReview] resposta final:",
      JSON.stringify(resultadoErro, null, 2),
    );
    return resultadoErro;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: {
          id: promptId,
          version: "10",
          variables: {
            url: dadosAtualizados.contextonoticia.url,
            domain: dadosAtualizados.contextonoticia.domain,
            veiculo: dadosAtualizados.contextonoticia.veiculo,
            datapublicacao: dadosAtualizados.contextonoticia.datapublicacao,
            tipo: dadosAtualizados.contextonoticia.tipo,
            titulo: dadosAtualizados.contextonoticia.titulo,
            totalclaims: String(dadosAtualizados.claims.length),
            totalcandidatos: String(
              dadosAtualizados.resumo_pipeline.total_candidatos_atualizados,
            ),
            totalfontesoficiais: String(
              dadosAtualizados.resumo_pipeline.total_fontes_oficiais,
            ),
            dadosatualizados: JSON.stringify(dadosAtualizados),
            loteclaims: JSON.stringify(dadosAtualizados.claims),
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const resultadoErro = buildFinalReviewErrorResponse(
        dadosAtualizados,
        `Erro na API: ${response.status} - ${errorText}`,
      );
      console.log(
        "[finalPipelineReview] resposta final:",
        JSON.stringify(resultadoErro, null, 2),
      );
      return resultadoErro;
    }

    const data = await response.json();

    let texto = data.output_text;
    if (!texto && Array.isArray(data.output)) {
      texto = data.output
        .flatMap((item) => item.content || [])
        .filter((content) => content.type === "output_text")
        .map((content) => content.text)
        .join("");
    }

    if (!texto || texto.trim() === "") {
      const resultadoErro = buildFinalReviewErrorResponse(
        dadosAtualizados,
        "IA nao retornou resposta",
      );
      console.log(
        "[finalPipelineReview] resposta final:",
        JSON.stringify(resultadoErro, null, 2),
      );
      return resultadoErro;
    }

    const textoJson = extractJsonFromText(texto);
    const parsed = JSON.parse(textoJson);
    const normalizado = normalizeFinalReviewResponse(parsed);

    console.log(
      "[finalPipelineReview] resposta final:",
      JSON.stringify(normalizado, null, 2),
    );

    return normalizado;
  } catch (err) {
    const resultadoErro = buildFinalReviewErrorResponse(
      dadosAtualizados,
      `Erro ao executar analise final: ${err.message}`,
    );
    console.log(
      "[finalPipelineReview] resposta final:",
      JSON.stringify(resultadoErro, null, 2),
    );
    return resultadoErro;
  }
}

module.exports = {
  finalPipelineReview,
  normalizeFinalPipelineForAI,
  normalizeFinalReviewResponse,
};
