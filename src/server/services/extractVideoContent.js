const { callOpenAIVision, callOpenAI } = require("./openai");

const FRAMES_PER_BATCH = 5;

async function extractVideoContent(frames) {
  if (!frames || frames.length === 0) return null;

  console.log(`[extractVideoContent] Analisando ${frames.length} frames em lotes de ${FRAMES_PER_BATCH}`);

  const prompt = `
Você está analisando frames de um vídeo.
Sua única função aqui é COMPLEMENTAR o texto da notícia com informações visuais adicionais.

Extraia APENAS o que o texto da notícia pode não conter:
- Legendas ou subtítulos visíveis na tela
- Textos, banners ou rodapés com informações extras
- Nome de pessoas identificadas na tela
- Local ou data exibidos graficamente

NÃO descreva cenas genéricas, emoções ou interpretações.
Se não houver nada relevante além do que já estaria no texto, responda apenas: "sem complemento visual"

Responda em português, de forma objetiva e curta.
  `;

  // Divide em lotes
  const batches = [];
  for (let i = 0; i < frames.length; i += FRAMES_PER_BATCH) {
    batches.push(frames.slice(i, i + FRAMES_PER_BATCH));
  }

  const descricoes = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchPrompt = `${prompt}\n\nEsses são os frames ${i * FRAMES_PER_BATCH + 1} a ${i * FRAMES_PER_BATCH + batch.length} do vídeo:`;
    const descricao = await callOpenAIVision(batchPrompt, batch, { caller: `extractVideoContent-lote${i + 1}` });
    if (descricao) descricoes.push(descricao.trim());
  }

  if (descricoes.length === 0) return null;

  // Se só um lote, retorna direto
  if (descricoes.length === 1) return descricoes[0];

  // Consolida múltiplos lotes em uma descrição única
  const consolidatePrompt = `
As descrições abaixo foram geradas a partir de diferentes partes de um vídeo de notícia.
Consolide-as em uma única descrição coerente e cronológica em português, removendo repetições.
Mantenha todos os fatos concretos, textos visíveis e eventos mencionados.

${descricoes.map((d, i) => `Parte ${i + 1}:\n${d}`).join("\n\n")}

Responda apenas com a descrição consolidada, sem introdução.
  `;

  const consolidado = await callOpenAI(consolidatePrompt, { caller: "extractVideoContent-consolidar" });
  const resultado = consolidado?.trim() || descricoes.join(" ");

  console.log(`[extractVideoContent] Descrição final: ${resultado.slice(0, 150)}...`);
  return resultado;
}

module.exports = { extractVideoContent };
