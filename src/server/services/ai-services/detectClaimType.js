// services/detectClaimType.js
// Detecta o tipo de cada claim usando o Prompt salvo na OpenAI

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

async function detectClaimType(claimsnormalizadas) {
  const resultados = [];

  for (const claim of claimsnormalizadas.claims) {
    console.log(`[detectClaimType] Processando claim ${claim.id}...`);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: {
          id: process.env.OPENAI_DETECT_CLAIM_TYPE_PROMPT_ID,
          version: "4",
          variables: {
            // Contexto geral da notícia
            url: claimsnormalizadas.contexto.url,
            veiculo: claimsnormalizadas.contexto.veiculo,
            datapublicacao: claimsnormalizadas.contexto.datapublicacao,
            tipo: claimsnormalizadas.contexto.tipo,
            totalclaims: String(claimsnormalizadas.resumo.total),
            noticiacomplexa: String(claimsnormalizadas.resumo.complexa),
            observacoes: claimsnormalizadas.resumo.observacoes,
            // Dados específicos da claim individual
            id: String(claim.id),
            texto: claim.texto,
            tipoclaim: claim.tipo || "",
            importancia: claim.importancia || "",
            motivo: claim.motivo || "",
            verificacoes: JSON.stringify(claim.verificacoes || {}),
            elementos: JSON.stringify(claim.elementos || {}),
            contextochecagem: claim.contextochecagem || "",
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[detectClaimType] ❌ Erro na API para claim ${claim.id}: ${response.status} - ${errorText}`,
      );
      resultados.push({
        claimid: claim.id,
        erro: true,
        mensagem: `Erro na API: ${response.status}`,
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
        `[detectClaimType] ⚠️ IA não retornou nada para claim ${claim.id}`,
      );
      resultados.push({
        claimid: claim.id,
        erro: true,
        mensagem: "IA não retornou resposta",
      });
      continue;
    }

    let resultado;
    try {
      resultado = JSON.parse(texto);
      console.log(
        `[detectClaimType] ✅ Resposta da IA para claim ${claim.id}:`,
        JSON.stringify(resultado, null, 2),
      );
    } catch (e) {
      console.error(
        `[detectClaimType] ❌ JSON inválido para claim ${claim.id}:`,
        texto.slice(0, 200),
      );
      resultados.push({
        claimid: claim.id,
        erro: true,
        mensagem: "Resposta não é JSON válido",
      });
      continue;
    }

    resultados.push({
      claimid: claim.id,
      ...resultado,
    });
  }

  return resultados;
}

module.exports = { detectClaimType };
