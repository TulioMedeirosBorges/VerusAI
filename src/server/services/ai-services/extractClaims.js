// services/extractClaims.js
// Extrai claims verificáveis usando o Prompt salvo na OpenAI

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
const { normalizeClaims } = require("../normalizers/normalizeClaims");

async function extractClaims(classificacao, url = "") {
  // console.log("[extractClaims] prompt id:", process.env.OPENAI_EXTRACT_CLAIMS_PROMPT_ID);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: process.env.OPENAI_EXTRACT_CLAIMS_PROMPT_ID,
        version: "4",
        variables: {
          url: classificacao.url || "",
          categoriapagina: classificacao.categoriapagina || "",
          categoriatextoprincipal: classificacao.categoriatextoprincipal || "",
          tipo: classificacao.tipo || "",
          tituloprovavel: classificacao.tituloprovavel || "",
          textolimpo: classificacao.textolimpo || "",
          motivoclassificacao: classificacao.motivoclassificacao || "",
          motivonaosernoticia: classificacao.motivonaosernoticia || "",
          devecontinuaranalise: String(classificacao.devecontinuaranalise),
          publishdate: classificacao.publishdate || "",
          local: classificacao.local || "",
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI extractClaims error: ${response.status} - ${errorText}`,
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

  let resultado;
  try {
    resultado = JSON.parse(texto);
    // console.log("[extractClaims] resultado bruto da IA:", resultado);
    console.log(
      "[extractClaims] resultado completo:",
      JSON.stringify(resultado, null, 2),
    );
  } catch (e) {
    throw new Error("A resposta do extractClaims não veio em JSON válido.");
  }

  return normalizeClaims(resultado);
}

module.exports = { extractClaims };
