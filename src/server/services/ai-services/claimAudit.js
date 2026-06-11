// services/ai-services/claimAudit.js
// Audits each simpleCheckClaims result before buildFinal.

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const { normalizeFinalPipelineForAI } = require("./finalPipelineReview.js");
const { getOutputText } = require("./openaiText.js");

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

function normalizeTextKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function normalizeChoice(value, validValues, fallback) {
  const normalized = normalizeTextKey(value);
  return validValues.includes(normalized) ? normalized : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = normalizeTextKey(value);
    if (["true", "1", "sim", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "nao", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

function getClaimId(item) {
  return String(
    firstValue(
      item?.claim_id,
      item?.claimId,
      item?.claimid,
      item?.id,
      item?.claim?.id,
      "unknown",
    ),
  );
}

function mapByClaimId(items) {
  const map = new Map();
  safeArray(items).forEach((item) => {
    const id = getClaimId(item);
    if (id) map.set(id, item);
  });
  return map;
}

function mapSimpleCheckStatusToAuditResult(status) {
  const normalized = normalizeTextKey(status);
  const aliases = {
    confirmada: "confirmada",
    confirmado: "confirmada",
    negada: "negada",
    nao_confirmada: "negada",
    contradita: "negada",
    falso: "negada",
    falsa: "negada",
    parcialmente_confirmada: "parcialmente_confirmada",
    parcial: "parcialmente_confirmada",
    inconclusiva: "sem_evidencia_suficiente",
    inconclusivo: "sem_evidencia_suficiente",
    erro: "sem_evidencia_suficiente",
    fora_de_contexto: "fora_de_contexto",
  };

  return aliases[normalized] || "sem_evidencia_suficiente";
}

const DECISOES_AUDITORIA = [
  "manter_resultado",
  "revisar_explicacao",
  "rebaixar_conclusao",
  "exigir_fonte_oficial",
  "refazer_busca",
  "rejeitar_checagem",
];

const RESULTADOS_RECOMENDADOS = [
  "manter",
  "confirmada",
  "negada",
  "parcialmente_confirmada",
  "sem_evidencia_suficiente",
  "fora_de_contexto",
];

const NIVEIS = ["alto", "medio", "baixo"];

const TIPOS_PROBLEMA = [
  "fonte_insuficiente",
  "fonte_fraca",
  "contexto_errado",
  "data_inconsistente",
  "numero_inconsistente",
  "pessoa_errada",
  "local_errado",
  "pais_errado",
  "conclusao_exagerada",
  "falta_fonte_oficial",
  "evidencia_parcial",
  "explicacao_incoerente",
  "outro",
];

const TIPOS_FONTE = [
  "oficial",
  "jornalistica",
  "checagem",
  "institucional",
  "outra",
];

const AVALIACOES_FONTE = ["forte", "media", "fraca"];

function normalizeProblem(problema = {}) {
  if (typeof problema === "string") {
    return {
      tipo: "outro",
      gravidade: "media",
      descricao: problema,
      impacto_na_checagem: "",
    };
  }

  return {
    tipo: normalizeChoice(problema.tipo, TIPOS_PROBLEMA, "outro"),
    gravidade: normalizeChoice(problema.gravidade, NIVEIS, "media"),
    descricao: firstValue(problema.descricao, problema.mensagem, ""),
    impacto_na_checagem: firstValue(
      problema.impacto_na_checagem,
      problema.impactoNaChecagem,
      problema.impacto,
      "",
    ),
  };
}

function normalizeImportantSource(fonte = {}) {
  if (typeof fonte === "string") {
    return {
      url: fonte,
      tipo_fonte: "outra",
      avaliacao: "media",
      motivo: "",
    };
  }

  return {
    url: firstValue(fonte.url, fonte.link, ""),
    tipo_fonte: normalizeChoice(
      firstValue(fonte.tipo_fonte, fonte.tipoFonte, fonte.tipo),
      TIPOS_FONTE,
      "outra",
    ),
    avaliacao: normalizeChoice(fonte.avaliacao, AVALIACOES_FONTE, "media"),
    motivo: firstValue(fonte.motivo, fonte.justificativa, ""),
  };
}

function normalizeAuditResponse(resultado = {}, input = {}) {
  const simpleCheck = input.resultado_simplecheck || {};
  const originalStatus = firstValue(
    resultado.resultado_original_simplecheck,
    simpleCheck.status,
    simpleCheck.veredito,
    "",
  );
  const problemas = safeArray(resultado.problemas_encontrados).map(
    normalizeProblem,
  );
  const precisaNovaBusca = toBoolean(
    firstValue(
      resultado.precisa_nova_busca,
      resultado.precisaNovaBusca,
      simpleCheck.necessita_mais_busca,
      false,
    ),
  );
  const precisaFonteOficial = toBoolean(
    firstValue(
      resultado.precisa_fonte_oficial,
      resultado.precisaFonteOficial,
      false,
    ),
  );
  const fonteOficialAusente = toBoolean(
    firstValue(
      resultado.fonte_oficial_ausente,
      resultado.fonteOficialAusente,
      false,
    ),
  );
  const aprovado = toBoolean(
    firstValue(resultado.aprovado, resultado.pode_ir_para_buildFinal, true),
    true,
  );

  return {
    ok: resultado?.ok !== false,
    etapa: "claimAudit",
    claim_id: firstValue(resultado.claim_id, resultado.claimId, input.claim_id),
    aprovado,
    decisao_auditoria: normalizeChoice(
      firstValue(resultado.decisao_auditoria, resultado.decisaoAuditoria),
      DECISOES_AUDITORIA,
      aprovado ? "manter_resultado" : "revisar_explicacao",
    ),
    resultado_original_simplecheck: originalStatus,
    resultado_recomendado: normalizeChoice(
      firstValue(
        resultado.resultado_recomendado,
        resultado.resultadoRecomendado,
      ),
      RESULTADOS_RECOMENDADOS,
      "manter",
    ),
    nivel_confianca_auditoria: normalizeChoice(
      firstValue(
        resultado.nivel_confianca_auditoria,
        resultado.nivelConfiancaAuditoria,
      ),
      NIVEIS,
      aprovado ? "medio" : "baixo",
    ),
    risco_alucinacao: normalizeChoice(
      resultado.risco_alucinacao,
      NIVEIS,
      "medio",
    ),
    risco_fonte_fraca: normalizeChoice(
      resultado.risco_fonte_fraca,
      NIVEIS,
      "medio",
    ),
    risco_contexto_errado: normalizeChoice(
      resultado.risco_contexto_errado,
      NIVEIS,
      "medio",
    ),
    risco_veredito_exagerado: normalizeChoice(
      resultado.risco_veredito_exagerado,
      NIVEIS,
      "medio",
    ),
    precisa_nova_busca: precisaNovaBusca,
    precisa_fonte_oficial: precisaFonteOficial,
    fonte_oficial_ausente: fonteOficialAusente,
    problemas_encontrados: problemas,
    pontos_bem_sustentados: safeArray(resultado.pontos_bem_sustentados),
    pontos_nao_sustentados: safeArray(resultado.pontos_nao_sustentados),
    pontos_que_precisam_de_mais_evidencia: safeArray(
      resultado.pontos_que_precisam_de_mais_evidencia,
    ),
    fontes_mais_importantes: safeArray(resultado.fontes_mais_importantes).map(
      normalizeImportantSource,
    ),
    ajuste_recomendado: firstValue(resultado.ajuste_recomendado, ""),
    justificativa_auditoria: firstValue(resultado.justificativa_auditoria, ""),
    pode_ir_para_buildFinal: toBoolean(
      firstValue(resultado.pode_ir_para_buildFinal, aprovado),
      aprovado,
    ),
  };
}

function buildAuditInputs(resultadoPipeline, extras = {}) {
  const dadosAtualizados =
    extras.dadosatualizados || normalizeFinalPipelineForAI(resultadoPipeline);
  const simpleCheckClaims =
    extras.simpleCheckClaims ||
    resultadoPipeline?.etapa9_finalPipelineReview ||
    {};

  const contexto = dadosAtualizados?.contextonoticia || {};
  const claimsOriginais = safeArray(dadosAtualizados?.claims);
  const simpleResults = safeArray(
    simpleCheckClaims.resultados || simpleCheckClaims.claims,
  );
  const claimsPorId = mapByClaimId(claimsOriginais);
  const simplePorId = mapByClaimId(simpleResults);
  const claimIds = new Set([
    ...claimsOriginais.map(getClaimId),
    ...simpleResults.map(getClaimId),
  ]);

  return Array.from(claimIds).map((claimId) => {
    const claim = claimsPorId.get(claimId) || {};
    const simpleCheck = simplePorId.get(claimId) || {};
    const fontesOficiaisAtualizadas = claim.fontes_oficiais_atualizadas;
    const temFontesOficiaisAtualizadas =
      fontesOficiaisAtualizadas &&
      Object.keys(fontesOficiaisAtualizadas).length > 0;
    const fontesOficiais = [
      ...safeArray(simpleCheck.fontes_oficiais_usadas),
      ...(temFontesOficiaisAtualizadas ? [fontesOficiaisAtualizadas] : []),
    ];

    return {
      claim_id: firstValue(simpleCheck.claim_id, claim.claimid, claimId),
      url: contexto.url || "",
      veiculo: contexto.veiculo || "",
      datapublicacao: contexto.datapublicacao || "",
      tipo: contexto.tipo || "",
      claimtexto: firstValue(claim.texto, simpleCheck.texto, ""),
      claimtipo: firstValue(
        claim.tipo_claim,
        claim.tipoverificacao,
        claim.categoriaprincipal,
        simpleCheck.tipo,
        "",
      ),
      resultado_simplecheck: simpleCheck,
      fontes_usadas: safeArray(simpleCheck.fontes_usadas),
      fontes_verificadas: safeArray(claim.candidatos_atualizados),
      fontes_oficiais: fontesOficiais,
      observacoes: {
        resumo_pipeline: dadosAtualizados?.resumo_pipeline || {},
        analise_para_build_final:
          simpleCheckClaims?.analise_para_build_final || {},
        alertas_simplecheck: safeArray(simpleCheck.alertas),
        necessita_mais_busca: toBoolean(simpleCheck.necessita_mais_busca),
        motivo_necessita_mais_busca:
          simpleCheck.motivo_necessita_mais_busca || "",
        classificacao_verificacao: claim.classificacao_verificacao || {},
        buscas: claim.buscas || {},
        roteamento_atualizado: claim.roteamento_atualizado || {},
      },
    };
  });
}

function buildPromptVariables(input) {
  return {
    url: input.url || "",
    veiculo: input.veiculo || "",
    datapublicacao: input.datapublicacao || "",
    tipo: input.tipo || "",
    claimtexto: input.claimtexto || "",
    claimtipo: input.claimtipo || "",
    resultado_simplecheck: JSON.stringify(input.resultado_simplecheck || {}),
    fontes_usadas: JSON.stringify(input.fontes_usadas || []),
    fontes_verificadas: JSON.stringify(input.fontes_verificadas || []),
    fontes_oficiais: JSON.stringify(input.fontes_oficiais || []),
    observacoes: JSON.stringify(input.observacoes || {}),
  };
}

function emptyAuditResponse(input, mensagem, overrides = {}) {
  const simpleCheck = input?.resultado_simplecheck || {};
  const problema = {
    tipo: "outro",
    gravidade: overrides.gravidade || "media",
    descricao: mensagem,
    impacto_na_checagem:
      overrides.impacto ||
      "A auditoria automatica nao foi concluida; buildFinal deve tratar como observacao tecnica.",
  };

  return normalizeAuditResponse(
    {
      ok: overrides.ok ?? false,
      claim_id: input?.claim_id || "",
      aprovado: overrides.aprovado ?? true,
      decisao_auditoria: overrides.decisao_auditoria || "revisar_explicacao",
      resultado_original_simplecheck: simpleCheck.status || "",
      resultado_recomendado:
        overrides.resultado_recomendado ||
        mapSimpleCheckStatusToAuditResult(simpleCheck.status),
      nivel_confianca_auditoria: overrides.nivel_confianca_auditoria || "baixo",
      risco_alucinacao: overrides.risco_alucinacao || "medio",
      risco_fonte_fraca: overrides.risco_fonte_fraca || "medio",
      risco_contexto_errado: overrides.risco_contexto_errado || "medio",
      risco_veredito_exagerado: overrides.risco_veredito_exagerado || "medio",
      precisa_nova_busca:
        overrides.precisa_nova_busca ??
        toBoolean(simpleCheck.necessita_mais_busca),
      precisa_fonte_oficial: overrides.precisa_fonte_oficial ?? false,
      fonte_oficial_ausente: overrides.fonte_oficial_ausente ?? false,
      problemas_encontrados: [problema],
      pontos_bem_sustentados: [],
      pontos_nao_sustentados: [],
      pontos_que_precisam_de_mais_evidencia: [],
      fontes_mais_importantes: [],
      ajuste_recomendado: mensagem,
      justificativa_auditoria: mensagem,
      pode_ir_para_buildFinal: overrides.pode_ir_para_buildFinal ?? true,
    },
    input,
  );
}

function buildResumo(auditorias = []) {
  const audits = safeArray(auditorias);
  return {
    total_claims: audits.length,
    total_aprovadas: audits.filter((audit) => audit.aprovado).length,
    total_reprovadas: audits.filter((audit) => !audit.aprovado).length,
    total_precisa_nova_busca: audits.filter((audit) => audit.precisa_nova_busca)
      .length,
    total_precisa_fonte_oficial: audits.filter(
      (audit) => audit.precisa_fonte_oficial,
    ).length,
    total_pode_ir_para_buildFinal: audits.filter(
      (audit) => audit.pode_ir_para_buildFinal,
    ).length,
    total_risco_alto: audits.filter(
      (audit) =>
        audit.risco_alucinacao === "alto" ||
        audit.risco_fonte_fraca === "alto" ||
        audit.risco_contexto_errado === "alto" ||
        audit.risco_veredito_exagerado === "alto",
    ).length,
  };
}

async function callAuditPrompt(input, promptId) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: promptId,
        version: "1",
        variables: buildPromptVariables(input),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erro na API claimAudit: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();
  const texto = getOutputText(data);

  if (!texto || texto.trim() === "") {
    throw new Error("IA claimAudit nao retornou resposta.");
  }

  return JSON.parse(extractJsonFromText(texto));
}

async function claimAudit(resultadoPipeline, extras = {}) {
  const inputs = buildAuditInputs(resultadoPipeline, extras);
  const promptId = process.env.OPENAI_CLAIM_AUDIT_PROMPT_ID;

  if (!inputs.length) {
    return {
      ok: true,
      etapa: "claimAudit",
      audits: [],
      resumo: buildResumo([]),
    };
  }

  if (!promptId) {
    const audits = inputs.map((input) =>
      emptyAuditResponse(
        input,
        "Prompt claimAudit nao configurado. Defina OPENAI_CLAIM_AUDIT_PROMPT_ID.",
      ),
    );
    const resultado = {
      ok: false,
      etapa: "claimAudit",
      audits,
      resumo: buildResumo(audits),
    };
    console.log(
      "[claimAudit] resposta final:",
      JSON.stringify(resultado, null, 2),
    );
    return resultado;
  }

  const audits = [];

  for (const input of inputs) {
    try {
      const parsed = await callAuditPrompt(input, promptId);
      audits.push(normalizeAuditResponse(parsed, input));
    } catch (err) {
      audits.push(
        emptyAuditResponse(
          input,
          `Erro ao executar claimAudit: ${err.message}`,
        ),
      );
    }
  }

  const resultado = {
    ok: audits.every((audit) => audit.ok !== false),
    etapa: "claimAudit",
    audits,
    resumo: buildResumo(audits),
  };

  console.log(
    "[claimAudit] resposta final:",
    JSON.stringify(resultado, null, 2),
  );

  return resultado;
}

module.exports = {
  claimAudit,
  buildAuditInputs,
  normalizeAuditResponse,
};
