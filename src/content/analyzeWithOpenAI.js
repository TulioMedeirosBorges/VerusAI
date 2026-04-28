// analyzeWithOpenAI.js
// Envia payload ao backend via background service worker (contorna CORS)

async function analyzeWithOpenAI(payload, frames) {
  try {
    const bodyObj = { ...payload, frames };
    const sizeKB = Math.round(new Blob([JSON.stringify(bodyObj)]).size / 1024);
    console.log(`[VerusAI] Payload: ${sizeKB}KB | frames: ${frames.length} | imageUrl: ${payload.imageUrl ? "sim" : "não"}`);

    if (sizeKB > 9000) {
      console.warn("[VerusAI] Payload muito grande, removendo frames e imageUrl");
      bodyObj.imageUrl = null;
      bodyObj.frames = [];
    }

    const resposta = await chrome.runtime.sendMessage({
      type: "FETCH",
      url: "http://localhost:3000/analisar",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyObj,
    });

    if (!resposta.ok) throw new Error(`Servidor retornou ${resposta.status}`);
    return resposta.data;
  } catch {
    return {
      pageType: "error",
      summary: "Erro ao conectar com o servidor de análise.",
      overallVerdict: "unverifiable",
      confidenceLabel: "baixa",
      confidenceScore: 0,
      claims: [],
      links: [],
      warnings: ["Falha de conexão"],
    };
  }
}
