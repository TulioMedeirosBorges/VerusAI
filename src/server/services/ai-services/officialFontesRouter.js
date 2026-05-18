// services/officialFontesRouter.js
// Roteador de fontes oficiais que envia para IA verificar em sites oficiais

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
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function normalizeOfficialSourceResponse(resultado, fonte, totalCandidatos = 0) {
  const resumo = resultado.resumo || {};
  const conclusao = resultado.conclusao_preliminar || {};
  const resultados = Array.isArray(resultado.resultados)
    ? resultado.resultados
    : Array.isArray(resultado.claims)
      ? resultado.claims
      : [];
  const melhoresEvidencias = Array.isArray(resultado.melhores_evidencias)
    ? resultado.melhores_evidencias
    : Array.isArray(resultado.melhoresEvidencias)
      ? resultado.melhoresEvidencias
      : [];

  return {
    ok: resultado.ok !== false,
    etapa: "officialFontesRouter",
    fonte: resultado.fonte || fonte || "",
    claim: {
      texto: resultado.claim?.texto || resultado.claim?.claimtexto || "",
      tipo: resultado.claim?.tipo || resultado.claim?.claimtipo || "",
      fonte_sugerida:
        resultado.claim?.fonte_sugerida ||
        resultado.claim?.fonte ||
        fonte ||
        "",
      motivos: resultado.claim?.motivos || "",
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

async function officialFontesRouter(
  contextoNoticia,
  claimData,
  candidatosParaVerificar,
) {
  console.log(
    `[officialFontesRouter] Processando verificação em fontes oficiais...`,
  );

  const promptId = process.env.OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID;
  if (!promptId) {
    console.warn(
      "[officialFontesRouter] Aviso: OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID não configurado.",
    );
    return {
      ok: false,
      etapa: "officialFontesRouter",
      mensagem:
        "Prompt de verificação de fontes oficiais não configurado. Defina OPENAI_OFFICIAL_FONTES_ROUTER_PROMPT_ID.",
      resultados: [],
    };
  }

  // Normaliza candidatos para verificação
  const candidatosNormalizados = Array.isArray(candidatosParaVerificar)
    ? candidatosParaVerificar
    : candidatosParaVerificar
      ? [candidatosParaVerificar]
      : [];

  // Filtra apenas candidatos que necessitam de fonte oficial
  const candidatosComFonte = candidatosNormalizados.filter(
    (c) =>
      c.necessita_fonte_oficial ||
      c.necessitaFonteOficial ||
      c.needs_official_source,
  );

  if (candidatosComFonte.length === 0) {
    console.log(
      "[officialFontesRouter] Nenhum candidato necessita de verificação em fontes oficiais.",
    );
    return {
      ok: true,
      etapa: "officialFontesRouter",
      mensagem: "Nenhum candidato necessita de verificação",
      resultados: [],
    };
  }

  // Agrupa por fonte oficial para processar juntos
  const porFonte = new Map();
  candidatosComFonte.forEach((candidato) => {
    const fonte =
      candidato.fonte_oficial ||
      candidato.fonteOficial ||
      candidato.official_source ||
      "IBGE";

    if (!porFonte.has(fonte)) {
      porFonte.set(fonte, []);
    }
    porFonte.get(fonte).push(candidato);
  });

  const resultados = [];

  // Para cada fonte, faz uma chamada à IA
  for (const [fonte, candidatos] of porFonte.entries()) {
    console.log(
      `[officialFontesRouter] Verificando ${candidatos.length} candidato(s) na fonte: ${fonte}`,
    );

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
            version: "1",
            variables: {
              url: contextoNoticia?.url || "",
              veiculo: contextoNoticia?.veiculo || "",
              datapublicacao: contextoNoticia?.datapublicacao || "",
              tipo: contextoNoticia?.tipo || "",
              claimtexto: claimData?.texto || claimData?.claimTexto || "",
              claimtipo: claimData?.tipo || claimData?.claimTipo || "",
              fonte: fonte,
              motivos: candidatos
                .map(
                  (c) =>
                    c.motivo_fonte_oficial ||
                    c.motivoFonteOficial ||
                    c.official_source_reason,
                )
                .filter(Boolean)
                .join(" | "),
              totalcandidatos: String(candidatos.length),
              candidatos: JSON.stringify(
                candidatos.map((c) => ({
                  claimid: c.claimid || c.claim_id || c.claimId || "",
                  url: c.url || c.candidate_url || "",
                  titulo: c.titulo || c.title || "",
                  motivo: c.motivo || "",
                  motivo_fonte_oficial:
                    c.motivo_fonte_oficial ||
                    c.motivoFonteOficial ||
                    c.official_source_reason ||
                    "",
                  confianca: c.confianca_relacao || c.confidence || null,
                })),
              ),
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[officialFontesRouter] ❌ Erro na API para fonte ${fonte}: ${response.status}`,
          errorText,
        );
        resultados.push({
          fonte,
          ok: false,
          erro: true,
          status: response.status,
          mensagem: `Erro na API: ${response.status}`,
          detalheOpenAI: errorText,
          candidatos: candidatos.map((c) => ({
            url: c.url,
            erro: true,
            mensagem: `Erro na API: ${response.status}`,
          })),
        });
        continue;
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
          `[officialFontesRouter] ⚠️ IA não retornou texto para fonte ${fonte}. Resposta completa:`,
          JSON.stringify(data, null, 2),
        );
        resultados.push({
          fonte,
          ok: false,
          erro: true,
          mensagem: "IA não retornou resposta",
          detalheOpenAI: JSON.stringify(data, null, 2),
          candidatos: candidatos.map((c) => ({
            url: c.url,
            erro: true,
            mensagem: "IA não retornou resposta",
          })),
        });
        continue;
      }

      let resultado;
      try {
        const textoJson = extractJsonFromText(texto);
        resultado = normalizeOfficialSourceResponse(
          JSON.parse(textoJson),
          fonte,
          candidatos.length,
        );

        console.log(
          `[officialFontesRouter] ✅ Resposta da IA para ${fonte}:`,
          JSON.stringify(resultado, null, 2),
        );

        resultados.push(resultado);
      } catch (e) {
        console.error(
          `[officialFontesRouter] ❌ JSON inválido da IA para ${fonte}:`,
          texto,
        );
        resultados.push({
          fonte,
          ok: false,
          erro: true,
          mensagem: "Resposta não é JSON válido",
          detalheOpenAI: texto,
          candidatos: candidatos.map((c) => ({
            url: c.url,
            erro: true,
            mensagem: "Resposta não é JSON válido",
          })),
        });
      }
    } catch (err) {
      console.error(
        `[officialFontesRouter] ❌ Erro ao processar fonte ${fonte}:`,
        err.message,
      );
      resultados.push({
        fonte,
        ok: false,
        erro: true,
        mensagem: `Erro ao processar: ${err.message}`,
        candidatos: candidatos.map((c) => ({
          url: c.url,
          erro: true,
          mensagem: `Erro ao processar: ${err.message}`,
        })),
      });
    }
  }

  return {
    ok: resultados.length > 0 && resultados.every((r) => r.ok !== false),
    etapa: "officialFontesRouter",
    mensagem: "Verificação em fontes oficiais completa",
    resultados,
  };
}

module.exports = { officialFontesRouter };
