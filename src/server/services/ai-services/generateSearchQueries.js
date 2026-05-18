// services/ai-services/generateSearchQueries.js
// Gera queries de busca para verificação de claims

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

async function generateSearchQueries(
  contextoNoticia,
  claimsNormalizadas,
  tiposNormalizados, // agora é array de objetos completos do detectClaimType
) {
  console.log(
    `[generateSearchQueries] Processando ${claimsNormalizadas.length} claims em lote...`,
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: process.env.OPENAI_GENERATE_SEARCH_QUERIES_PROMPT_ID,
        version: "6",
        variables: {
          url: contextoNoticia.url || "",
          veiculo: contextoNoticia.veiculo || "",
          datapublicacao: contextoNoticia.datapublicacao || "",
          tipo: contextoNoticia.tipo || "",
          totalclaims: String(claimsNormalizadas.length),
          noticiacomplexa: contextoNoticia.noticiacomplexa || "false",
          observacoes: contextoNoticia.observacoes || "",
          // loteclaims agora inclui todos os dados do detectClaimType
          loteclaims: JSON.stringify(
            claimsNormalizadas.map((claim, index) => {
              const tipo = tiposNormalizados[index] || {};
              return {
                id: claim.id,
                texto: claim.texto,
                tipoverificacao: tipo.tipoverificacao || "",
                categoriaprincipal: tipo.categoriaprincipal || "",
                nivelprioridade: tipo.nivelprioridade || "media",
              };
            }),
          ),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[generateSearchQueries] ❌ Erro na API: ${response.status}`,
      errorText,
    );
    return {
      ok: false,
      etapa: "generateSearchQueries",
      erro: true,
      status: response.status,
      mensagem: `Erro na API: ${response.status}`,
      detalheOpenAI: errorText,
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.id,
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
    console.warn(`[generateSearchQueries] ⚠️ IA não retornou nada para o lote`);
    return {
      ok: false,
      etapa: "generateSearchQueries",
      erro: true,
      mensagem: "IA não retornou resposta",
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.id,
        erro: true,
        mensagem: "IA não retornou resposta",
      })),
    };
  }

  let resultado;
  try {
    resultado = JSON.parse(texto);
    console.log(
      `[generateSearchQueries] ✅ Resposta da IA para ${claimsNormalizadas.length} claims:`,
      JSON.stringify(resultado, null, 2),
    );
  } catch (e) {
    console.error(
      `[generateSearchQueries] ❌ JSON inválido:`,
      texto.slice(0, 200),
    );
    return {
      ok: false,
      etapa: "generateSearchQueries",
      erro: true,
      mensagem: "Resposta não é JSON válido",
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.id,
        erro: true,
        mensagem: "Resposta não é JSON válido",
      })),
    };
  }

  // Valida estrutura do retorno
  if (
    !resultado.ok ||
    resultado.etapa !== "generateSearchQueries" ||
    !Array.isArray(resultado.claims)
  ) {
    console.error(
      `[generateSearchQueries] ❌ Estrutura de retorno inválida:`,
      JSON.stringify(resultado, null, 2),
    );
    return {
      ok: false,
      etapa: "generateSearchQueries",
      erro: true,
      mensagem: "Estrutura de retorno inválida",
      claims: claimsNormalizadas.map((claim) => ({
        claimid: claim.id,
        erro: true,
        mensagem: "Estrutura de retorno inválida",
      })),
    };
  }

  return resultado;
}

module.exports = { generateSearchQueries };
