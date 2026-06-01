// services/classifyPage.js
// Classifica a página usando o Prompt salvo na OpenAI

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
function normalizarClassificacao(resultado) {
  const TIPOS_VALIDOS = [
    "noticia",
    "opiniao",
    "busca",
    "social",
    "produto",
    "generico",
    "erro",
  ];

  const categoriatextoprincipal = TIPOS_VALIDOS.includes(
    resultado.categoriatextoprincipal?.toLowerCase(),
  )
    ? resultado.categoriatextoprincipal.toLowerCase()
    : TIPOS_VALIDOS.includes(resultado.categoriaTextoPrincipal?.toLowerCase())
      ? resultado.categoriaTextoPrincipal.toLowerCase()
      : TIPOS_VALIDOS.includes(resultado.tipo?.toLowerCase())
        ? resultado.tipo.toLowerCase()
        : "generico";

  const categoriapagina = TIPOS_VALIDOS.includes(
    resultado.categoriapagina?.toLowerCase(),
  )
    ? resultado.categoriapagina.toLowerCase()
    : TIPOS_VALIDOS.includes(resultado.categoriaPagina?.toLowerCase())
      ? resultado.categoriaPagina.toLowerCase()
      : categoriatextoprincipal;

  const tipo = categoriatextoprincipal;

  const textolimpo =
    typeof resultado.textolimpo === "string" && resultado.textolimpo.trim()
      ? resultado.textolimpo
      : typeof resultado.textoLimpo === "string" && resultado.textoLimpo.trim()
        ? resultado.textoLimpo
        : typeof resultado.textoutilcompleto === "string" &&
            resultado.textoutilcompleto.trim()
          ? resultado.textoutilcompleto
          : typeof resultado.textoUtilCompleto === "string" &&
              resultado.textoUtilCompleto.trim()
            ? resultado.textoUtilCompleto
            : "";

  return {
    categoriapagina: categoriapagina,
    categoriatextoprincipal: categoriatextoprincipal,
    tipo,

    tituloprovavel:
      typeof resultado.tituloprovavel === "string"
        ? resultado.tituloprovavel
        : typeof resultado.tituloProvavel === "string"
          ? resultado.tituloProvavel
          : "",

    textolimpo: textolimpo,
    textoutilcompleto: textolimpo,

    motivoclassificacao:
      typeof resultado.motivoclassificacao === "string"
        ? resultado.motivoclassificacao
        : typeof resultado.motivoClassificacao === "string"
          ? resultado.motivoClassificacao
          : "",

    motivonaosernoticia:
      typeof resultado.motivonaosernoticia === "string"
        ? resultado.motivonaosernoticia
        : typeof resultado.motivoNaoSerNoticia === "string"
          ? resultado.motivoNaoSerNoticia
          : "",

    devecontinuaranalise:
      resultado.devecontinuaranalise !== undefined
        ? resultado.devecontinuaranalise
        : resultado.deveContinuarAnalise !== undefined
          ? resultado.deveContinuarAnalise
          : categoriatextoprincipal === "noticia",

    publishdate:
      typeof resultado.publishdate === "string"
        ? resultado.publishdate
        : typeof resultado.publishDate === "string"
          ? resultado.publishDate
          : "",

    local: typeof resultado.local === "string" ? resultado.local : "",
    url:
      typeof resultado.url === "string"
        ? resultado.url
        : typeof resultado.local === "string"
          ? resultado.local
          : "",
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
    youtubeTranscript: pageData.youtubeTranscript?.slice(0, 100),
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
        version: "26",
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
          youtubetranscript: pageData.youtubeTranscript || "",
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
    console.log("[classifyPage] resultado bruto da IA:", resultado);
    console.log(
      "[classifyPage] textoLimpo preview:",
      resultado.textoLimpo?.slice(0, 500),
    );
    console.log(
      "[classifyPage] textoLimpo length:",
      resultado.textoLimpo?.length,
    );
  } catch (e) {
    throw new Error("A resposta do classifyPage não veio em JSON válido.");
  }

  return normalizarClassificacao(resultado);
}
module.exports = { classifyPage };
