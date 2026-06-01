// services/extractClaims.js
// Extrai claims verificáveis usando o Prompt salvo na OpenAI

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

function normalizeClaims(claimsData) {
  const dados = claimsData.claims || claimsData;

  const contexto = dados.contexto || {
    url: dados.origem?.url,
    veiculo: dados.origem?.sitename || dados.origem?.siteName,
    datapublicacao: dados.origem?.publishdate || dados.origem?.publishDate,
    tipo: dados.origem?.tipo,
  };

  const claimsArray =
    dados.claims || dados.claimsselecionadas || dados.claimsSelecionadas || [];

  const resumoOriginal =
    dados.resumo || dados.resumoextracao || dados.resumoExtracao || {};

  return {
    contexto: {
      url: contexto.url,
      veiculo: contexto.veiculo,
      datapublicacao: contexto.datapublicacao,
      tipo: contexto.tipo,
    },
    claims: claimsArray.map((claim) => ({
      id: claim.id,
      texto: claim.texto,
      tipo: claim.tipo || claim.tipoclaim || claim.tipoClaim,
      importancia: claim.importancia,
      motivo:
        claim.motivo || claim.motivoimportancia || claim.motivoImportancia,
      verificacoes: claim.verificacoes || {
        ano: claim.exigeanocorreto || claim.exigeAnoCorreto,
        data: claim.exigedatacorreta || claim.exigeDataCorreta,
        local: claim.exigelocalcorreto || claim.exigeLocalCorreto,
        pessoa: claim.exigepessoacorreta || claim.exigePessoaCorreta,
        instituicao:
          claim.exigeinstituicaocorreta || claim.exigeInstituicaoCorreta,
      },
      elementos: claim.elementos || {
        datas:
          claim.elementoscriticos?.anosoudatas ||
          claim.elementosCriticos?.anosOuDatas ||
          [],
        locais:
          claim.elementoscriticos?.locais ||
          claim.elementosCriticos?.locais ||
          [],
        pessoas:
          claim.elementoscriticos?.pessoas ||
          claim.elementosCriticos?.pessoas ||
          [],
        instituicoes:
          claim.elementoscriticos?.instituicoes ||
          claim.elementosCriticos?.instituicoes ||
          [],
        numeros:
          claim.elementoscriticos?.numerosouvalores ||
          claim.elementosCriticos?.numerosOuValores ||
          [],
      },
      contextochecagem:
        claim.contextochecagem ||
        claim.contextoChecagem ||
        claim.contextonecessarioparachecagem ||
        claim.contextoNecessarioParaChecagem,
    })),
    resumo: {
      total:
        resumoOriginal.total ||
        resumoOriginal.totalclaimsselecionadas ||
        resumoOriginal.totalClaimsSelecionadas ||
        claimsArray.length,
      complexa:
        resumoOriginal.complexa ??
        resumoOriginal.noticiacomplexa ??
        resumoOriginal.noticiaComplexa ??
        false,
      observacoes: resumoOriginal.observacoes || "",
    },
  };
}

async function extractClaims(classificacao, pageData = {}) {
  console.log("[extractClaims] Iniciando extração de claims...");
  console.log(
    "[extractClaims] prompt id:",
    process.env.OPENAI_EXTRACT_CLAIMS_PROMPT_ID,
  );
  console.log(
    "[extractClaims] textolimpo length:",
    classificacao.textolimpo?.length,
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: process.env.OPENAI_EXTRACT_CLAIMS_PROMPT_ID,
        version: "13",
        variables: {
          url: pageData.url || classificacao.url || "",
          categoriapagina: classificacao.categoriapagina || "",
          categoriatextoprincipal: classificacao.categoriatextoprincipal || "",
          tipo: classificacao.tipo || "",
          tituloprovavel: classificacao.tituloprovavel || "",
          textolimpo: classificacao.textolimpo || "",
          motivoclassificacao: classificacao.motivoclassificacao || "",
          motivonaosernoticia: classificacao.motivonaosernoticia || "",
          devecontinuaranalise: String(classificacao.devecontinuaranalise),
          publishdate: pageData.publishDate || classificacao.publishdate || "",
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
    console.log("[extractClaims] resultado bruto da IA:", resultado);
    console.log(
      "[extractClaims] total de claims:",
      resultado.claims?.length || 0,
    );
  } catch (e) {
    console.error("[extractClaims] ❌ Erro ao parsear JSON:", texto);
    throw new Error("A resposta do extractClaims não veio em JSON válido.");
  }

  const normalizado = normalizeClaims(resultado);

  // Adiciona dados do pageData ao contexto normalizado
  normalizado.contexto = {
    ...normalizado.contexto,
    url: pageData.url || normalizado.contexto.url || "",
    veiculo: pageData.siteName || normalizado.contexto.veiculo || "",
    datapublicacao:
      pageData.publishDate || normalizado.contexto.datapublicacao || "",
    tipo: classificacao.tipo || normalizado.contexto.tipo || "",
  };

  console.log(
    "[extractClaims] resultado normalizado:",
    JSON.stringify(normalizado, null, 2),
  );
  console.log("[extractClaims] ✅ Extração concluída!\n");

  return normalizado;
}

module.exports = { extractClaims, normalizeClaims };
