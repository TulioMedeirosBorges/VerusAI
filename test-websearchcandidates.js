const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

// Defina sua chave e prompt ID aqui para rodar sem precisar colocar no terminal.
const OPENAI_API_KEY =
  "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"; // ex: "sk-..."
const OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID =
  "pmpt_6a065807861c81948313002e69d4bd4a0e12d5eb98c955f9"; // ex: "seu_prompt_id"
const OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_VERSION = "4";

function normalizeWebSearchCandidates(
  claimData,
  searchQueriesResult,
  contextoNoticia,
) {
  const claim = claimData.claim || claimData;
  const tipoVerif =
    claimData.classificacaoverificacao || claimData.tipoVerificacao || {};
  const queriesData = searchQueriesResult || {};

  return {
    claim: {
      id: claim.id || 0,
      texto: claim.texto || "",
      tipo: claim.tipoclaim || claim.tipo || "",
    },
    verificacao: {
      tipo: tipoVerif.tipoverificacao || tipoVerif.tipo || "",
      categoria: tipoVerif.categoriaprincipal || tipoVerif.categoria || "",
      prioridade: tipoVerif.nivelprioridade || tipoVerif.prioridade || "media",
      estrategia: tipoVerif.estrategiachecagem || tipoVerif.estrategia || "",
    },
    contextoOriginal: {
      url: contextoNoticia?.url || "",
      veiculo: contextoNoticia?.veiculo || "",
      dataPublicacao: contextoNoticia?.datapublicacao || "",
      observacoes: contextoNoticia?.observacoes || "",
    },
    buscas: {
      queries: queriesData.queries || [],
      consultasAPIs:
        queriesData.consultasapis || queriesData.consultasAPIs || [],
      alertas: queriesData.alertasbusca || queriesData.alertasBusca || [],
      observacoes: queriesData.observacoes || "",
    },
  };
}

function normalizeWebSearchCandidatesBatch(
  claimsArray,
  searchQueriesResults,
  contextoNoticia,
) {
  if (!Array.isArray(claimsArray)) return [];

  const resultsMap = new Map();
  if (searchQueriesResults?.claims) {
    searchQueriesResults.claims.forEach((result) => {
      if (result.claimid !== undefined) resultsMap.set(result.claimid, result);
      if (result.claimId !== undefined) resultsMap.set(result.claimId, result);
    });
  }

  return claimsArray.map((claimData) => {
    const claimId = claimData.claim?.id || claimData.id || 0;
    const searchResult = resultsMap.get(claimId) || {};
    return normalizeWebSearchCandidates(
      claimData,
      searchResult,
      contextoNoticia,
    );
  });
}

const fakeClaims = [
  {
    claim: {
      id: 1,
      texto: "O preço do pão subiu 10% em maio.",
      tipo: "economia",
    },
    classificacaoverificacao: {
      tipoverificacao: "fato",
      categoriaprincipal: "economia",
      nivelprioridade: "alta",
      estrategiachecagem: "verificar fonte oficial",
    },
  },
  {
    claim: {
      id: 2,
      texto: "A empresa X lançou um novo produto sustentável.",
      tipo: "meio-ambiente",
    },
    classificacaoverificacao: {
      tipoverificacao: "fato",
      categoriaprincipal: "meio-ambiente",
      nivelprioridade: "media",
      estrategiachecagem: "buscar comunicado oficial",
    },
  },
];

const fakeSearchQueries = {
  ok: true,
  claims: [
    { claimid: 1, queries: ["preço do pão maio 2026", "inflação alimentos"] },
    {
      claimid: 2,
      queries: [
        "empresa X produto sustentável",
        "lançamento produto sustentável",
      ],
    },
  ],
};

const contextoNoticia = {
  url: "https://example.com/noticia-falsa",
  veiculo: "Exemplo News",
  datapublicacao: "2026-05-16",
  tipo: "noticia",
  observacoes: "Teste local com dados falsos",
};

async function run() {
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  const promptId =
    process.env.OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID ||
    OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID;
  const promptVersion =
    process.env.OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_VERSION ||
    OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_VERSION;

  if (!apiKey) {
    console.error(
      "Erro: defina OPENAI_API_KEY no ambiente ou preencha OPENAI_API_KEY no arquivo.",
    );
    process.exit(1);
  }

  if (!promptId) {
    console.error(
      "Erro: defina OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID no ambiente ou preencha OPENAI_WEB_SEARCH_CANDIDATES_PROMPT_ID no arquivo.",
    );
    process.exit(1);
  }

  const claimsNormalizadas = normalizeWebSearchCandidatesBatch(
    fakeClaims,
    fakeSearchQueries,
    contextoNoticia,
  );

  const payload = {
    prompt: {
      id: promptId,
      version: promptVersion,
      variables: {
        url: contextoNoticia.url || "",
        veiculo: contextoNoticia.veiculo || "",
        datapublicacao: contextoNoticia.datapublicacao || "",
        tipo: contextoNoticia.tipo || "",
        totalclaims: String(claimsNormalizadas.length),
        noticiacomplexa: contextoNoticia.noticiacomplexa || "false",
        observacoes: contextoNoticia.observacoes || "",
        loteclaims: JSON.stringify(
          claimsNormalizadas.map((claim) => ({
            id: claim.claim.id || 0,
            texto: claim.claim.texto || "",
            tipo: claim.claim.tipo || "",
            tipoverificacao: claim.verificacao.tipo || "",
            categoriaprincipal: claim.verificacao.categoria || "",
            nivelprioridade: claim.verificacao.prioridade || "media",
            estrategia: claim.verificacao.estrategia || "",
            contextoOriginal: {
              url: claim.contextoOriginal?.url || "",
              veiculo: claim.contextoOriginal?.veiculo || "",
              dataPublicacao: claim.contextoOriginal?.dataPublicacao || "",
              observacoes: claim.contextoOriginal?.observacoes || "",
            },
            buscas: {
              queries: claim.buscas.queries || [],
              consultasAPIs: claim.buscas.consultasAPIs || [],
              alertas: claim.buscas.alertas || [],
              observacoes: claim.buscas.observacoes || "",
            },
          })),
        ),
      },
    },
  };

  console.log("=== payload de teste ===");
  console.log(JSON.stringify(payload, null, 2));

  // do a simple fetch (no AbortController) and log full errors if they occur
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Erro na requisição para OpenAI:", err.name, err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }

  console.log(`\nstatus: ${response.status}`);
  const responseBody = await response.text();

  try {
    const json = JSON.parse(responseBody);
    console.log("=== resposta recebida ===");
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log("=== resposta não JSON ===");
    console.log(responseBody);
  }
}

run().catch((error) => {
  console.error("Erro no teste real:", error);
  process.exit(1);
});
