// services/routeVerifiedCandidates.js
// Separa resultados verificados POR CLAIM, e dentro de cada claim, por API e Fonte Oficial

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

function normalizeItemNeedsApi(item) {
  return (
    item?.necessita_api ??
    item?.necessitaApi ??
    item?.needs_api ??
    item?.needsApi ??
    false
  );
}

function normalizeItemNeedsOfficialSource(item) {
  return (
    item?.necessita_fonte_oficial ??
    item?.necessitaFonteOficial ??
    item?.needs_official_source ??
    false
  );
}

function normalizeItemClaimText(item) {
  return (
    item?.claimtexto ??
    item?.claimTexto ??
    item?.claim_text ??
    item?.claim?.texto ??
    item?.claim?.text ??
    item?.raw?.claimtexto ??
    item?.raw?.claimTexto ??
    ""
  );
}

function normalizeItemClaimType(item) {
  return (
    item?.claimtipo ??
    item?.claimTipo ??
    item?.claim_type ??
    item?.claim?.tipo ??
    item?.claim?.type ??
    item?.raw?.claimtipo ??
    item?.raw?.claimTipo ??
    ""
  );
}

function extractCandidateArray(input) {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input.resultados)) return input.resultados;
  if (Array.isArray(input.claims)) return input.claims;
  return [];
}

function routeVerifiedCandidates(resultsOrResponse) {
  const candidates = extractCandidateArray(resultsOrResponse);

  // Agrupa candidatos por claimid
  const claimMap = new Map();

  candidates.forEach((item) => {
    const claimId = item.claimid ?? item.claim_id ?? item.claimId ?? "unknown";
    if (!claimMap.has(claimId)) {
      claimMap.set(claimId, {
        claimId,
        claimTexto: normalizeItemClaimText(item),
        claimTipo: normalizeItemClaimType(item),
        necessitaApi: [],
        necessitaFonteOficial: [],
        nenhum: [],
      });
    }

    const claimData = claimMap.get(claimId);
    if (!claimData.claimTexto) {
      claimData.claimTexto = normalizeItemClaimText(item);
    }
    if (!claimData.claimTipo) {
      claimData.claimTipo = normalizeItemClaimType(item);
    }
    const needsApiValue = toBoolean(normalizeItemNeedsApi(item));
    const needsOfficialSource = toBoolean(
      normalizeItemNeedsOfficialSource(item),
    );

    if (needsApiValue) {
      claimData.necessitaApi.push(item);
    }

    if (needsOfficialSource) {
      claimData.necessitaFonteOficial.push(item);
    }

    if (!needsApiValue && !needsOfficialSource) {
      claimData.nenhum.push(item);
    }
  });

  // Converte Map para array
  const claimsRoteadas = Array.from(claimMap.values());

  // Calcula totais
  let totalCandidatos = 0;
  let totalNecessitaApi = 0;
  let totalNecessitaFonteOficial = 0;
  let totalNenhum = 0;

  claimsRoteadas.forEach((claim) => {
    totalNecessitaApi += claim.necessitaApi.length;
    totalNecessitaFonteOficial += claim.necessitaFonteOficial.length;
    totalNenhum += claim.nenhum.length;
    totalCandidatos +=
      claim.necessitaApi.length +
      claim.necessitaFonteOficial.length +
      claim.nenhum.length;
  });

  return {
    claims: claimsRoteadas,
    summary: {
      totalClaims: claimsRoteadas.length,
      totalCandidatos,
      totalNecessitaApi,
      totalNecessitaFonteOficial,
      totalNenhum,
    },
  };
}

module.exports = { routeVerifiedCandidates };
