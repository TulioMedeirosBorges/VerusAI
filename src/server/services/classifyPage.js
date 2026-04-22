const { callOpenAIJSON } = require("./openai");

const TIPOS_VALIDOS = ["noticia", "opiniao", "busca", "generico"];

async function classifyPage(text) {
  if (!text || text.trim().length < 100) {
    console.warn("[classifyPage] Texto muito curto, classificando como generico");
    return { tipo: "generico", confianca: 0 };
  }

  const prompt = `
Analise o texto abaixo e classifique o tipo de conteúdo da página.

Tipos possíveis:
- "noticia": reportagem, artigo jornalístico com fatos e fontes
- "opiniao": editorial, coluna, artigo de opinião sem fatos verificáveis
- "busca": página de resultados de busca (Google, Bing, etc.)
- "generico": homepage, feed de redes sociais, e-commerce, ou qualquer outra coisa

Retorne APENAS um JSON:
{
  "tipo": "noticia" | "opiniao" | "busca" | "generico",
  "confianca": 0.0 a 1.0
}

Se o texto parecer um feed com múltiplos assuntos misturados, classifique como "generico".
Se a confiança for menor que 0.5, prefira "generico".

TEXTO:
${text.slice(0, 2000)}
  `;

  const resultado = await callOpenAIJSON(prompt, { caller: "classifyPage" });

  const tipo_raw = TIPOS_VALIDOS.includes(resultado.tipo) ? resultado.tipo : "generico";
  const confianca = typeof resultado.confianca === "number"
    ? Math.min(1, Math.max(0, resultado.confianca))
    : 0.5;

  // Força generico se confiança baixa — não depende só da IA obedecer o prompt
  const tipo = confianca < 0.5 ? "generico" : tipo_raw;

  console.log(`[classifyPage] tipo=${tipo} confianca=${confianca}`);
  return { tipo, confianca };
}

module.exports = { classifyPage };
