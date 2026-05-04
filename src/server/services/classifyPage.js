// services/classifyPage.js
// Classifica a página usando o Prompt salvo na OpenAI

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const TIPOS_VALIDOS = [
  "noticia",
  "opiniao",
  "busca",
  "social",
  "produto",
  "generico",
  "erro",
];
const TIPOS_CONTINUAR = ["noticia", "opiniao", "social"];

function normalizarClassificacao(resultado) {
  const tipo = TIPOS_VALIDOS.includes(resultado.tipo)
    ? resultado.tipo
    : "generico";
  return {
    tipo,
    confianca:
      typeof resultado.confianca === "number"
        ? Math.min(1, Math.max(0, resultado.confianca))
        : 0,
    conteudoInutilDetectado: Array.isArray(resultado.conteudoInutilDetectado)
      ? resultado.conteudoInutilDetectado
      : [],
    trechosUteis: Array.isArray(resultado.trechosUteis)
      ? resultado.trechosUteis
      : [],
    tituloProvavel:
      typeof resultado.tituloProvavel === "string"
        ? resultado.tituloProvavel
        : "",
    resumoConteudoUtil:
      typeof resultado.resumoConteudoUtil === "string"
        ? resultado.resumoConteudoUtil
        : "",
    motivoClassificacao:
      typeof resultado.motivoClassificacao === "string"
        ? resultado.motivoClassificacao
        : "",
    deveContinuarAnalise: TIPOS_CONTINUAR.includes(tipo),
  };
}

async function classifyPage(pageData) {
  console.log(
    "[classifyPage] prompt id:",
    process.env.OPENAI_CLASSIFY_PAGE_PROMPT_ID,
  );

  console.log("[classifyPage] dados enviados:", {
    url: pageData.url,
    title: pageData.title,
    textPreview: pageData.text?.slice(0, 200),
    textLength: pageData.text?.length,
  });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: process.env.OPENAI_CLASSIFY_PAGE_PROMPT_ID,
        version: "9",
        variables: {
          url: pageData.url || "",
          domain: pageData.domain || "",
          title: pageData.title || "",
          description: pageData.description || "",
          sitename: pageData.siteName || "",
          author: pageData.author || "",
          publishdate: pageData.publishDate || "",
          imageurl: pageData.imageUrl || "",
          language: pageData.language || "",
          pagetype: pageData.pageType || "",
          headings: JSON.stringify(pageData.headings || []),
          links: JSON.stringify(pageData.links || []),
          textlength: String(pageData.textLength || 0),
          text: pageData.text || "",
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI classifyPage error: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();

  // Extrai o texto da resposta
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
  } catch (e) {
    throw new Error("A resposta do classifyPage não veio em JSON válido.");
  }

  return normalizarClassificacao(resultado);
}
module.exports = { classifyPage };
