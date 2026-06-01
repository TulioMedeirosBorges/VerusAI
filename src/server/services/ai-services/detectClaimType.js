// services/detectClaimType.js
// Detecta o tipo de todas as claims em uma unica chamada para a OpenAI.

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

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

function buildErrorResults(claims, mensagem, extra = {}) {
  return claims.map((claim) => ({
    claimid: claim.id,
    erro: true,
    mensagem,
    ...extra,
  }));
}

function extractResultsArray(resultado) {
  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.claims)) return resultado.claims;
  if (Array.isArray(resultado?.resultados)) return resultado.resultados;
  if (Array.isArray(resultado?.tipos)) return resultado.tipos;
  if (resultado && typeof resultado === "object") return [resultado];
  return [];
}

function normalizeClaimTypeResult(item, fallbackClaim) {
  const claimid =
    item?.claimid ??
    item?.claimId ??
    item?.claim_id ??
    item?.id ??
    fallbackClaim?.id;

  return {
    ...item,
    claimid,
    tipoverificacao:
      item?.tipoverificacao || item?.tipoVerificacao || item?.tipo || "",
    categoriaprincipal:
      item?.categoriaprincipal ||
      item?.categoriaPrincipal ||
      item?.categoria ||
      "",
    precisawebsearch: item?.precisawebsearch ?? item?.precisaWebSearch ?? false,
    precisaapioficial:
      item?.precisaapioficial ?? item?.precisaAPIOficial ?? false,
    precisafonteestatistica:
      item?.precisafonteestatistica ?? item?.precisaFonteEstatistica ?? false,
    dependedeanocorreto:
      item?.dependedeanocorreto ?? item?.dependeDeAnoCorreto ?? false,
    dependededatacorreta:
      item?.dependededatacorreta ?? item?.dependeDeDataCorreta ?? false,
    dependedelocalcorreto:
      item?.dependedelocalcorreto ?? item?.dependeDeLocalCorreto ?? false,
    fontesrecomendadas:
      item?.fontesrecomendadas || item?.fontesRecomendadas || [],
    apisrecomendadas: item?.apisrecomendadas || item?.apisRecomendadas || [],
    nivelprioridade:
      item?.nivelprioridade ||
      item?.nivelPrioridade ||
      item?.prioridade ||
      "media",
    estrategiachecagem:
      item?.estrategiachecagem ||
      item?.estrategiaChecagem ||
      item?.estrategia ||
      "",
    motivoclassificacao:
      item?.motivoclassificacao ||
      item?.motivoClassificacao ||
      item?.motivo ||
      "",
  };
}

async function detectClaimType(claimsnormalizadas) {
  const claims = Array.isArray(claimsnormalizadas?.claims)
    ? claimsnormalizadas.claims
    : [];

  if (claims.length === 0) return [];

  console.log(
    `[detectClaimType] Processando ${claims.length} claims em lote...`,
  );

  const firstClaim = claims[0] || {};
  const claimsPayload = JSON.stringify(
    claims.map((claim) => ({
      id: claim.id,
      texto: claim.texto,
      tipoclaim: claim.tipo || "",
      importancia: claim.importancia || "",
      motivo: claim.motivo || "",
      verificacoes: claim.verificacoes || {},
      elementos: claim.elementos || {},
      contextochecagem: claim.contextochecagem || "",
    })),
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: process.env.OPENAI_DETECT_CLAIM_TYPE_PROMPT_ID,
        version: "9",
        variables: {
          url: claimsnormalizadas.contexto?.url || "",
          veiculo: claimsnormalizadas.contexto?.veiculo || "",
          datapublicacao: claimsnormalizadas.contexto?.datapublicacao || "",
          tipo: claimsnormalizadas.contexto?.tipo || "",
          totalclaims: String(claims.length),
          noticiacomplexa: String(claimsnormalizadas.resumo?.complexa || false),
          observacoes: claimsnormalizadas.resumo?.observacoes || "",
          // Usa apenas variaveis ja cadastradas no prompt salvo.
          id: "lote",
          texto: claimsPayload,
          tipoclaim: "lote",
          importancia: firstClaim.importancia || "",
          motivo: `Classificar em lote ${claims.length} claims`,
          verificacoes: JSON.stringify(firstClaim.verificacoes || {}),
          elementos: JSON.stringify(firstClaim.elementos || {}),
          contextochecagem: firstClaim.contextochecagem || "",
        },
      },
      input:
        "Classifique todas as claims enviadas em prompt.variables.texto, que contem um array JSON. " +
        "Retorne um objeto com ok=true, etapa='detectClaimType' e claims=[...]. " +
        "Cada item precisa trazer claimid e os campos de classificacao da claim correspondente.\n\n" +
        claimsPayload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[detectClaimType] Erro na API para o lote: ${response.status} - ${errorText}`,
    );
    return buildErrorResults(claims, `Erro na API: ${response.status}`, {
      detalheOpenAI: errorText,
    });
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
    console.warn("[detectClaimType] IA nao retornou nada para o lote");
    return buildErrorResults(claims, "IA nao retornou resposta", {
      detalheOpenAI: JSON.stringify(data, null, 2),
    });
  }

  let resultado;
  try {
    resultado = JSON.parse(extractJsonFromText(texto));
  } catch (e) {
    console.error(
      "[detectClaimType] JSON invalido para o lote:",
      texto.slice(0, 200),
    );
    return buildErrorResults(claims, "Resposta nao e JSON valido", {
      detalheOpenAI: texto,
    });
  }

  const parsedItems = extractResultsArray(resultado);
  const normalizados = parsedItems.map((item, index) =>
    normalizeClaimTypeResult(item, claims[index]),
  );

  const porClaimId = new Map(
    normalizados
      .filter((item) => item.claimid !== undefined && item.claimid !== null)
      .map((item) => [String(item.claimid), item]),
  );

  const resultados = claims.map((claim, index) => {
    return (
      porClaimId.get(String(claim.id)) ||
      normalizados[index] || {
        claimid: claim.id,
        erro: true,
        mensagem: "IA nao retornou classificacao para esta claim",
      }
    );
  });

  console.log(
    `[detectClaimType] Resposta da IA para ${resultados.length} claims:`,
    JSON.stringify(resultados, null, 2),
  );

  return resultados;
}

module.exports = { detectClaimType };
