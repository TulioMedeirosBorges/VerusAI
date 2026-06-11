// services/ai-services/buildFinal.js
// Sends the final pipeline review to the buildFinal AI step.

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

function decodeHtmlEntities(value) {
  let decoded = String(value == null ? "" : value);
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  for (let i = 0; i < 2; i++) {
    const next = decoded.replace(
      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
      (match, entity) => {
        const lower = entity.toLowerCase();

        if (lower.startsWith("#x")) {
          const code = Number.parseInt(lower.slice(2), 16);
          if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
            return match;
          }
          return String.fromCodePoint(code);
        }

        if (lower.startsWith("#")) {
          const code = Number.parseInt(lower.slice(1), 10);
          if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
            return match;
          }
          return String.fromCodePoint(code);
        }

        return Object.prototype.hasOwnProperty.call(named, lower)
          ? named[lower]
          : match;
      },
    );

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\w:-]*(?:\s[^<>]*)?>/i.test(value);
}

function normalizeTextWhitespace(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(value) {
  const decoded = decodeHtmlEntities(value).replace(
    /```(?:html)?\s*([\s\S]*?)```/gi,
    "$1",
  );

  if (!looksLikeHtml(decoded)) {
    return normalizeTextWhitespace(decoded);
  }

  return normalizeTextWhitespace(
    decoded
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(
        /<\/(?:p|div|section|article|header|footer|h[1-6]|li|ul|ol|tr|table|blockquote)>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " "),
  );
}

function normalizePlainText(value) {
  return htmlToPlainText(value);
}

function isUrlFieldName(key) {
  const normalized = String(key || "").toLowerCase();
  return (
    normalized === "url" ||
    normalized === "href" ||
    normalized === "link" ||
    normalized === "wikipedia" ||
    normalized.includes("url") ||
    normalized.includes("link")
  );
}

function normalizePublicTextDeep(value, key = "") {
  if (typeof value === "string") {
    if (key === "htmlFinal") return value.trim();
    if (isUrlFieldName(key)) return value.trim();
    return normalizePlainText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePublicTextDeep(item, key));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([itemKey, itemValue]) => [
        itemKey,
        normalizePublicTextDeep(itemValue, itemKey),
      ]),
    );
  }

  return value;
}

function normalizeTextList(value) {
  return safeArray(value)
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return normalizePlainText(item);
      }

      return normalizePlainText(
        firstValue(item?.texto, item?.mensagem, item?.titulo, item?.descricao),
      );
    })
    .filter(Boolean);
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

function normalizeUrl(value) {
  const url = decodeHtmlEntities(value).trim();
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (err) {
    return "";
  }
}

function normalizeSourceType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aliases = {
    jornalistica: "jornalistica",
    jornalistico: "jornalistica",
    oficial: "oficial",
    academica: "academica",
    academico: "academica",
    checagem: "checagem",
    institucional: "institucional",
    wikipedia: "wikipedia",
  };

  return aliases[normalized] || "outra";
}

function normalizeImportance(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["alta", "media", "baixa"].includes(normalized)) return normalized;
  return "";
}

function sourceKey(fonte) {
  const url = normalizeUrl(fonte?.url);
  if (url) return `url:${url}`;

  const sourceName = String(fonte?.fonte || fonte?.source || "").trim();
  const title = String(fonte?.titulo || fonte?.title || "").trim();
  return `text:${sourceName}::${title}`;
}

function normalizeFontePrincipal(fonte = {}) {
  const clean = normalizePublicTextDeep(fonte);
  const url = normalizeUrl(clean.url || clean.href || clean.link);
  const dominio = firstValue(clean.dominio, clean.domain, getDomain(url));
  const nomeFonte = firstValue(
    clean.fonte,
    clean.fonteOficial,
    clean.fonte_oficial,
    clean.instituicao,
    clean.veiculo,
    normalizePlainText(dominio),
  );

  return {
    titulo: normalizePlainText(
      firstValue(clean.titulo, clean.title, nomeFonte, dominio, url),
    ),
    url,
    fonte: normalizePlainText(nomeFonte),
    tipoFonte: normalizeSourceType(clean.tipoFonte || clean.tipo_fonte),
    relevancia: normalizePlainText(
      firstValue(
        clean.relevancia,
        clean.peso_aproximado,
        clean.pesoAproximado,
        "",
      ),
    ),
    papelNaVerificacao: normalizePlainText(
      firstValue(
        clean.papelNaVerificacao,
        clean.papel_na_verificacao,
        clean.como_foi_usada,
        clean.comoFoiUsada,
        "",
      ),
    ),
    resumo: normalizePlainText(
      firstValue(
        clean.resumo,
        clean.explicacao,
        clean.resumoEvidencia,
        clean.resumo_evidencia,
        "",
      ),
    ),
  };
}

function normalizeEvidence(evidencia = {}) {
  const clean = normalizePublicTextDeep(evidencia);

  if (typeof clean === "string") {
    return {
      titulo: clean,
      url: "",
      fonte: clean,
      relacaoComClaim: "",
      resumoEvidencia: "",
    };
  }

  const url = normalizeUrl(clean.url || clean.href || clean.link);
  const titulo = normalizePlainText(
    firstValue(clean.titulo, clean.title, clean.fonte, clean.source, url),
  );

  return {
    ...clean,
    titulo,
    url,
    fonte: normalizePlainText(
      firstValue(clean.fonte, clean.source, clean.dominio, titulo),
    ),
    relacaoComClaim: normalizePlainText(
      firstValue(clean.relacaoComClaim, clean.relacao_com_claim, ""),
    ),
    resumoEvidencia: normalizePlainText(
      firstValue(
        clean.resumoEvidencia,
        clean.resumo_evidencia,
        clean.resumo,
        clean.explicacao,
        "",
      ),
    ),
  };
}

function normalizeClaimAnalysis(claim = {}) {
  const clean = normalizePublicTextDeep(claim);

  if (typeof clean === "string") {
    return {
      id: "",
      textoOriginal: clean,
      textoFinal: clean,
      statusOriginal: "",
      statusNormalizado: "inconclusiva",
      explicacao: "",
      evidencias: [],
    };
  }

  return {
    ...clean,
    id: normalizePlainText(
      firstValue(clean.id, clean.claim_id, clean.claimId, clean.claimid, ""),
    ),
    textoOriginal: normalizePlainText(
      firstValue(clean.textoOriginal, clean.texto_original, ""),
    ),
    textoFinal: normalizePlainText(
      firstValue(
        clean.textoFinal,
        clean.texto_final,
        clean.textoOriginal,
        clean.texto_original,
        "",
      ),
    ),
    statusOriginal: normalizePlainText(
      firstValue(clean.statusOriginal, clean.status_original, clean.status, ""),
    ),
    statusNormalizado: normalizePlainText(
      firstValue(
        clean.statusNormalizado,
        clean.status_normalizado,
        clean.statusOriginal,
        clean.status_original,
        "",
      ),
    ),
    explicacao: normalizePlainText(
      firstValue(clean.explicacao, clean.explanation, clean.justificativa, ""),
    ),
    evidencias: safeArray(
      clean.evidencias || clean.fontes || clean.fontesUsadas,
    ).map(normalizeEvidence),
  };
}

function normalizeStructuredContent(conteudo = {}) {
  const clean = normalizePublicTextDeep(conteudo || {});

  return {
    titulo: normalizePlainText(clean.titulo || ""),
    subtitulo: normalizePlainText(clean.subtitulo || ""),
    blocos: safeArray(clean.blocos).map((bloco) =>
      normalizePublicTextDeep(bloco),
    ),
  };
}

function collectFontesPrincipais(simpleCheckClaims = {}) {
  const fontes = [];

  safeArray(simpleCheckClaims.resultados || simpleCheckClaims.claims).forEach(
    (claim) => {
      safeArray(claim.fontes_usadas || claim.fontesUsadas).forEach((fonte) => {
        fontes.push(
          normalizeFontePrincipal({
            ...fonte,
            tipoFonte: fonte.tipoFonte || fonte.tipo_fonte,
          }),
        );
      });

      safeArray(
        claim.fontes_oficiais_usadas || claim.fontesOficiaisUsadas,
      ).forEach((fonte) => {
        fontes.push(
          normalizeFontePrincipal({
            ...fonte,
            fonte: fonte.fonteOficial || fonte.fonte_oficial,
            tipoFonte: "oficial",
          }),
        );
      });
    },
  );

  const deduped = new Map();
  fontes.forEach((fonte) => {
    const key = sourceKey(fonte);
    if (!key || key === "text:::") return;

    const previous = deduped.get(key);
    if (!previous) {
      deduped.set(key, fonte);
      return;
    }

    const previousCompleteness = Object.values(previous).filter(Boolean).length;
    const currentCompleteness = Object.values(fonte).filter(Boolean).length;
    if (currentCompleteness > previousCompleteness) {
      deduped.set(key, fonte);
    }
  });

  return Array.from(deduped.values());
}

function normalizeEntityItem(item, tipo) {
  if (typeof item === "string") {
    return {
      nome: normalizePlainText(item),
      tipo: normalizePlainText(tipo),
      urlWikipedia: "",
      foiLinkadaNoHtml: false,
    };
  }

  const clean = normalizePublicTextDeep(item);

  return {
    nome: normalizePlainText(
      firstValue(clean?.nome, clean?.name, clean?.texto, ""),
    ),
    tipo: normalizePlainText(firstValue(clean?.tipo, clean?.type, tipo)),
    urlWikipedia: normalizeUrl(
      clean?.urlWikipedia || clean?.wikipedia || clean?.url,
    ),
    foiLinkadaNoHtml: Boolean(clean?.foiLinkadaNoHtml),
  };
}

function collectEntidadesDetectadas(simpleCheckClaims = {}) {
  const entidades = [];
  const entityKeys = [
    "pessoas",
    "locais",
    "cidades",
    "estados",
    "paises",
    "regioes",
    "instituicoes",
    "orgaos_publicos",
    "empresas",
    "projetos",
    "partidos",
    "cargos",
    "eventos",
    "conceitos",
    "outros",
  ];

  safeArray(simpleCheckClaims.resultados || simpleCheckClaims.claims).forEach(
    (claim) => {
      const citadas = claim.entidades_citadas || claim.entidadesCitadas || {};

      entityKeys.forEach((key) => {
        safeArray(citadas[key]).forEach((item) => {
          const entidade = normalizeEntityItem(item, key);
          if (entidade.nome) entidades.push(entidade);
        });
      });
    },
  );

  const deduped = new Map();
  entidades.forEach((entidade) => {
    const key = `${entidade.tipo}::${entidade.nome}`.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, entidade);
  });

  return Array.from(deduped.values());
}

function collectEntidadesFromClaims(claims = []) {
  const entidades = [];
  const entityKeys = [
    "pessoas",
    "locais",
    "instituicoes",
    "orgaos_publicos",
    "empresas",
    "eventos",
    "conceitos",
  ];

  safeArray(claims).forEach((claim) => {
    const elementos = claim.elementos || claim.elementosCriticos || {};
    entityKeys.forEach((key) => {
      safeArray(elementos[key]).forEach((item) => {
        const entidade = normalizeEntityItem(item, key);
        if (entidade.nome) entidades.push(entidade);
      });
    });
  });

  const deduped = new Map();
  entidades.forEach((entidade) => {
    const key = `${entidade.tipo}::${entidade.nome}`.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, entidade);
  });

  return Array.from(deduped.values());
}

function collectLinksEntidades(entidadesDetectadas = []) {
  return safeArray(entidadesDetectadas)
    .filter((entidade) => normalizeUrl(entidade.urlWikipedia))
    .map((entidade) => ({
      nome: entidade.nome || "",
      tipo: entidade.tipo || "",
      urlWikipedia: normalizeUrl(entidade.urlWikipedia),
    }));
}

function normalizeAlert(alerta, extra = {}) {
  if (typeof alerta === "string") {
    return {
      tipo: normalizePlainText(extra.tipo || ""),
      gravidade: normalizePlainText(extra.gravidade || ""),
      mensagem: normalizePlainText(alerta),
      impacto: normalizePlainText(extra.impacto || ""),
      claim_id: normalizePlainText(extra.claim_id || ""),
    };
  }

  const clean = normalizePublicTextDeep(alerta);

  return {
    tipo: normalizePlainText(
      firstValue(clean?.tipo, clean?.type, extra.tipo, ""),
    ),
    gravidade: normalizePlainText(
      firstValue(clean?.gravidade, clean?.severity, extra.gravidade, ""),
    ),
    mensagem: normalizePlainText(
      firstValue(clean?.mensagem, clean?.message, clean?.texto, ""),
    ),
    impacto: normalizePlainText(firstValue(clean?.impacto, clean?.impact, "")),
    claim_id: normalizePlainText(
      firstValue(clean?.claim_id, clean?.claimId, extra.claim_id, ""),
    ),
  };
}

function collectAlertas(
  simpleCheckClaims = {},
  analiseParaBuildFinal = {},
  claimAudit = {},
) {
  const alertas = [];

  safeArray(analiseParaBuildFinal.principais_alertas_globais).forEach(
    (alerta) => {
      alertas.push(normalizeAlert(alerta));
    },
  );

  if (analiseParaBuildFinal.precisa_nova_busca_global) {
    alertas.push(
      normalizeAlert(analiseParaBuildFinal.motivo_precisa_nova_busca_global, {
        tipo: "contexto_insuficiente",
        gravidade: "media",
      }),
    );
  }

  safeArray(simpleCheckClaims.resultados || simpleCheckClaims.claims).forEach(
    (claim) => {
      const claimId = firstValue(claim.claim_id, claim.claimId, claim.claimid);

      safeArray(claim.alertas).forEach((alerta) => {
        alertas.push(normalizeAlert(alerta, { claim_id: claimId }));
      });

      if (claim.necessita_mais_busca) {
        alertas.push(
          normalizeAlert(claim.motivo_necessita_mais_busca, {
            tipo: "contexto_insuficiente",
            gravidade: "media",
            claim_id: claimId,
          }),
        );
      }
    },
  );

  safeArray(
    claimAudit.audits || claimAudit.resultados || claimAudit.claims,
  ).forEach((audit) => {
    const claimId = firstValue(audit.claim_id, audit.claimId, audit.claimid);

    safeArray(audit.problemas_encontrados).forEach((problema) => {
      alertas.push(
        normalizeAlert(
          {
            tipo: problema?.tipo || "claim_audit",
            gravidade: problema?.gravidade || "media",
            mensagem:
              problema?.descricao ||
              problema?.mensagem ||
              audit.justificativa_auditoria ||
              "",
            impacto:
              problema?.impacto_na_checagem ||
              problema?.impactoNaChecagem ||
              problema?.impacto ||
              "",
          },
          { claim_id: claimId },
        ),
      );
    });

    if (audit.precisa_nova_busca) {
      alertas.push(
        normalizeAlert(
          audit.ajuste_recomendado || audit.justificativa_auditoria,
          {
            tipo: "claim_audit_nova_busca",
            gravidade: "media",
            claim_id: claimId,
          },
        ),
      );
    }

    if (audit.precisa_fonte_oficial || audit.fonte_oficial_ausente) {
      alertas.push(
        normalizeAlert(
          audit.ajuste_recomendado || audit.justificativa_auditoria,
          {
            tipo: "claim_audit_fonte_oficial",
            gravidade: "media",
            claim_id: claimId,
          },
        ),
      );
    }
  });

  return alertas.filter((alerta) => alerta.mensagem || alerta.tipo);
}

function buildAuditMap(claimAudit = {}) {
  const map = new Map();
  safeArray(
    claimAudit.audits || claimAudit.resultados || claimAudit.claims,
  ).forEach((audit) => {
    const id = String(firstValue(audit.claim_id, audit.claimId, audit.claimid));
    if (id) map.set(id, audit);
  });
  return map;
}

function mergeSimpleCheckWithClaimAudit(
  simpleCheckClaims = {},
  claimAudit = {},
) {
  const auditMap = buildAuditMap(claimAudit);
  const resultados = safeArray(
    simpleCheckClaims.resultados || simpleCheckClaims.claims,
  ).map((claim) => {
    const id = String(firstValue(claim.claim_id, claim.claimId, claim.claimid));
    const audit = auditMap.get(id);
    return audit
      ? {
          ...claim,
          claim_audit: audit,
        }
      : claim;
  });

  return {
    ...simpleCheckClaims,
    resultados,
    auditoria_claims: {
      ok: claimAudit?.ok ?? null,
      etapa: claimAudit?.etapa || "claimAudit",
      resumo: claimAudit?.resumo || {},
      audits: safeArray(
        claimAudit.audits || claimAudit.resultados || claimAudit.claims,
      ),
    },
  };
}

function buildObservacoes(
  resultadoPipeline,
  dadosAtualizados,
  claimAudit = {},
) {
  return {
    pipeline: {
      status: resultadoPipeline?.status || "",
      etapa: resultadoPipeline?.etapa || "",
      mensagem: resultadoPipeline?.mensagem || "",
    },
    resumo_pipeline: dadosAtualizados?.resumo_pipeline || {},
    claimAudit: {
      ok: claimAudit?.ok ?? null,
      resumo: claimAudit?.resumo || {},
      audits: safeArray(
        claimAudit.audits || claimAudit.resultados || claimAudit.claims,
      ),
    },
    debugValidacao: resultadoPipeline?.debugValidacao || {},
  };
}

function normalizeBuildFinalInput(resultadoPipeline, extras = {}) {
  const dadosAtualizados =
    extras.dadosatualizados || normalizeFinalPipelineForAI(resultadoPipeline);
  const simpleCheckClaims =
    extras.simpleCheckClaims ||
    resultadoPipeline?.etapa9_finalPipelineReview ||
    {};
  const claimAudit =
    extras.claimAudit ||
    resultadoPipeline?.etapa10_claimAudit ||
    resultadoPipeline?.claimAudit ||
    {};
  const analiseParaBuildFinal =
    extras.analise_para_build_final ||
    simpleCheckClaims?.analise_para_build_final ||
    {};

  const fontesPrincipais = safeArray(extras.fontesPrincipais).length
    ? safeArray(extras.fontesPrincipais).map(normalizeFontePrincipal)
    : collectFontesPrincipais(simpleCheckClaims);

  const entidadesDetectadas = safeArray(extras.entidadesDetectadas).length
    ? safeArray(extras.entidadesDetectadas).map((item) =>
        normalizeEntityItem(item, item?.tipo || ""),
      )
    : (() => {
        const entidadesFinalReview =
          collectEntidadesDetectadas(simpleCheckClaims);
        return entidadesFinalReview.length
          ? entidadesFinalReview
          : collectEntidadesFromClaims(dadosAtualizados?.claims);
      })();

  const linksEntidades = safeArray(extras.linksEntidades).length
    ? safeArray(extras.linksEntidades).map((item) => ({
        nome: item?.nome || "",
        tipo: item?.tipo || "",
        urlWikipedia: normalizeUrl(item?.urlWikipedia || item?.url),
      }))
    : collectLinksEntidades(entidadesDetectadas);

  const alertas = safeArray(extras.alertas).length
    ? safeArray(extras.alertas).map(normalizeAlert)
    : collectAlertas(simpleCheckClaims, analiseParaBuildFinal, claimAudit);
  const simpleCheckClaimsComAuditoria = mergeSimpleCheckWithClaimAudit(
    simpleCheckClaims,
    claimAudit,
  );

  return {
    dadosatualizados: dadosAtualizados,
    loteclaims: safeArray(dadosAtualizados?.claims),
    simpleCheckClaims: simpleCheckClaimsComAuditoria,
    claimAudit,
    analise_para_build_final: analiseParaBuildFinal,
    fontesPrincipais,
    entidadesDetectadas,
    linksEntidades,
    alertas,
    observacoes:
      extras.observacoes ||
      buildObservacoes(resultadoPipeline, dadosAtualizados, claimAudit),
  };
}

function emptyBuildFinalResponse(input, overrides = {}) {
  const contexto = input?.dadosatualizados?.contextonoticia || {};
  const message =
    overrides.mensagem ||
    "Nao foi possivel montar a resposta final automaticamente.";

  return {
    ok: overrides.ok ?? false,
    etapa: "buildFinal",
    urlOriginal: normalizeUrl(contexto.url),
    veiculo: contexto.veiculo || "",
    dataPublicacao: contexto.datapublicacao || "",
    tipoConteudo: contexto.tipo || "",
    tituloFinal: contexto.titulo || "",
    assuntoPrincipal: "",
    resumoCurto: message,
    resumoDetalhado: message,
    vereditoGeral: "inconclusivo",
    scoreConfiabilidade: overrides.scoreConfiabilidade ?? 30,
    nivelConfiabilidade: overrides.nivelConfiabilidade || "baixa",
    mensagemPrincipalUsuario: message,
    baseDoVeredito: {
      origemPrincipal: input?.analise_para_build_final
        ?.veredito_preliminar_sugerido
        ? "analise_para_build_final"
        : "simpleCheckClaims",
      usouSimpleCheckClaims: Boolean(input?.simpleCheckClaims),
      vereditoFoiAjustado: false,
      motivoAjuste: "",
    },
    claimsResumo: {
      totalClaims: safeArray(input?.simpleCheckClaims?.resultados).length,
      confirmadas: 0,
      parcialmenteConfirmadas: 0,
      inconclusivas: 0,
      naoConfirmadas: 0,
      contraditas: 0,
      comErro: 0,
    },
    claimsAnalisadas: [],
    fontesPrincipais: safeArray(input?.fontesPrincipais),
    entidadesMencionadas: safeArray(input?.entidadesDetectadas),
    alertasGerais: safeArray(input?.alertas),
    pontosImportantes: [],
    oQueFoiConfirmado: [],
    oQueFicouInconclusivo: [],
    oQueFoiContradito: [],
    conteudoWebEstruturado: {
      titulo: contexto.titulo || "",
      subtitulo: "",
      blocos: [],
    },
    htmlFinal: "",
    textoFinalSemHtml: message,
    observacoesTecnicas: safeArray(overrides.observacoesTecnicas || message),
  };
}

function normalizeBuildFinalResponse(resultado = {}, input) {
  const clean = normalizePublicTextDeep(resultado || {});
  const fallback = emptyBuildFinalResponse(input, {
    ok: clean?.ok !== false,
    mensagem: "",
    scoreConfiabilidade: 45,
    nivelConfiabilidade: "baixa",
    observacoesTecnicas: [],
  });
  const fontesPrincipais = safeArray(clean.fontesPrincipais).length
    ? safeArray(clean.fontesPrincipais).map(normalizeFontePrincipal)
    : safeArray(input.fontesPrincipais).map(normalizeFontePrincipal);
  const entidadesMencionadas = safeArray(clean.entidadesMencionadas).length
    ? safeArray(clean.entidadesMencionadas).map((item) =>
        normalizeEntityItem(item, item?.tipo || ""),
      )
    : safeArray(input.entidadesDetectadas).map((item) =>
        normalizeEntityItem(item, item?.tipo || ""),
      );
  const htmlFinalText = normalizePlainText(resultado?.htmlFinal || "");

  return {
    ...fallback,
    ...clean,
    ok: clean?.ok !== false,
    etapa: "buildFinal",
    urlOriginal: normalizeUrl(
      firstValue(clean.urlOriginal, fallback.urlOriginal),
    ),
    veiculo: normalizePlainText(firstValue(clean.veiculo, fallback.veiculo)),
    dataPublicacao: normalizePlainText(
      firstValue(clean.dataPublicacao, fallback.dataPublicacao),
    ),
    tipoConteudo: normalizePlainText(
      firstValue(clean.tipoConteudo, fallback.tipoConteudo),
    ),
    tituloFinal: normalizePlainText(
      firstValue(clean.tituloFinal, fallback.tituloFinal),
    ),
    assuntoPrincipal: normalizePlainText(
      firstValue(clean.assuntoPrincipal, fallback.assuntoPrincipal),
    ),
    resumoCurto: normalizePlainText(
      firstValue(clean.resumoCurto, fallback.resumoCurto),
    ),
    resumoDetalhado: normalizePlainText(
      firstValue(clean.resumoDetalhado, fallback.resumoDetalhado),
    ),
    mensagemPrincipalUsuario: normalizePlainText(
      firstValue(
        clean.mensagemPrincipalUsuario,
        clean.resumoCurto,
        fallback.mensagemPrincipalUsuario,
      ),
    ),
    textoFinalSemHtml: normalizePlainText(
      firstValue(
        clean.textoFinalSemHtml,
        htmlFinalText,
        fallback.textoFinalSemHtml,
      ),
    ),
    htmlFinal: "",
    baseDoVeredito: normalizePublicTextDeep(
      clean.baseDoVeredito || fallback.baseDoVeredito,
    ),
    claimsAnalisadas: safeArray(clean.claimsAnalisadas).map(
      normalizeClaimAnalysis,
    ),
    fontesPrincipais,
    entidadesMencionadas,
    alertasGerais: safeArray(clean.alertasGerais).map(normalizeAlert),
    pontosImportantes: normalizeTextList(clean.pontosImportantes),
    oQueFoiConfirmado: normalizeTextList(clean.oQueFoiConfirmado),
    oQueFicouInconclusivo: normalizeTextList(clean.oQueFicouInconclusivo),
    oQueFoiContradito: normalizeTextList(clean.oQueFoiContradito),
    observacoesTecnicas: normalizeTextList(clean.observacoesTecnicas),
    conteudoWebEstruturado: normalizeStructuredContent(
      clean.conteudoWebEstruturado,
    ),
  };
}

async function buildFinal(resultadoPipeline, extras = {}) {
  const input = normalizeBuildFinalInput(resultadoPipeline, extras);
  const promptId = process.env.OPENAI_BUILD_FINAL_PROMPT_ID;

  if (!promptId) {
    const resultadoErro = emptyBuildFinalResponse(input, {
      ok: false,
      mensagem:
        "Prompt buildFinal nao configurado. Defina OPENAI_BUILD_FINAL_PROMPT_ID.",
      observacoesTecnicas: [
        "Prompt buildFinal nao configurado. Defina OPENAI_BUILD_FINAL_PROMPT_ID.",
      ],
    });
    console.log(
      "[buildFinal] resposta final:",
      JSON.stringify(resultadoErro, null, 2),
    );
    return resultadoErro;
  }

  try {
    const variables = {
      dadosatualizados: JSON.stringify(input.dadosatualizados),
      loteclaims: JSON.stringify(input.loteclaims),
      simplecheckclaims: JSON.stringify(input.simpleCheckClaims),
      analise_para_build_final: JSON.stringify(input.analise_para_build_final),
      fontesprincipais: JSON.stringify(input.fontesPrincipais),
      entidadesdetectadas: JSON.stringify(input.entidadesDetectadas),
      linksentidades: JSON.stringify(input.linksEntidades),
      alertas: JSON.stringify(input.alertas),
      observacoes: JSON.stringify(input.observacoes),
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: {
          id: promptId,
          version: "9",
          variables,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const resultadoErro = emptyBuildFinalResponse(input, {
        ok: false,
        mensagem: `Erro na API buildFinal: ${response.status}`,
        observacoesTecnicas: [
          `Erro na API buildFinal: ${response.status}`,
          errorText,
        ],
      });
      console.log(
        "[buildFinal] resposta final:",
        JSON.stringify(resultadoErro, null, 2),
      );
      return resultadoErro;
    }

    const data = await response.json();
    const texto = getOutputText(data);

    if (!texto || texto.trim() === "") {
      const resultadoErro = emptyBuildFinalResponse(input, {
        ok: false,
        mensagem: "IA buildFinal nao retornou resposta.",
        observacoesTecnicas: ["IA buildFinal nao retornou resposta."],
      });
      console.log(
        "[buildFinal] resposta final:",
        JSON.stringify(resultadoErro, null, 2),
      );
      return resultadoErro;
    }

    const parsed = JSON.parse(extractJsonFromText(texto));
    const normalizado = normalizeBuildFinalResponse(parsed, input);

    console.log(
      "[buildFinal] resposta final:",
      JSON.stringify(normalizado, null, 2),
    );

    return normalizado;
  } catch (err) {
    const resultadoErro = emptyBuildFinalResponse(input, {
      ok: false,
      mensagem: `Erro ao executar buildFinal: ${err.message}`,
      observacoesTecnicas: [`Erro ao executar buildFinal: ${err.message}`],
    });
    console.log(
      "[buildFinal] resposta final:",
      JSON.stringify(resultadoErro, null, 2),
    );
    return resultadoErro;
  }
}

module.exports = {
  buildFinal,
  normalizeBuildFinalInput,
  normalizeBuildFinalResponse,
};
