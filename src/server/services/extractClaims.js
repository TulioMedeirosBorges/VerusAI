const { callOpenAIJSON } = require("./openai");

async function extractClaims(conteudo) {
  if (!conteudo || conteudo.trim().length < 50) {
    console.warn("[extractClaims] Conteúdo insuficiente para extrair afirmações");
    return { afirmacoes: [] };
  }

  const prompt = `
Analise o texto abaixo e extraia até 5 afirmações objetivas e verificáveis.

Uma afirmação verificável é:
- Um fato concreto com dado específico ("A taxa de desemprego caiu para 6,2%")
- Uma declaração factual de pessoa pública sobre um evento real ("O presidente assinou o decreto X")
- Um dado estatístico ou científico com número ou fonte
- Um evento datado e específico que aconteceu ou foi anunciado oficialmente

NAO inclua — descarte completamente:
- Declarações retóricas, hiperboles ou simbolismos ("os militares estão ansiosos", "vamos destruir o inimigo")
- Opiniões, julgamentos de valor ou previsões ("será o melhor acordo", "isso vai mudar tudo")
- Afirmações vagas sem dado concreto ("a situação é grave", "o país está mal")
- Perguntas, hipóteses ou condições ("se isso acontecer...")
- Declarações de intenção sem ação concreta ("vamos fazer X", "pretendemos Y")
- Emoções ou estados de ânimo atribuídos a grupos ("o povo está com raiva", "os militares estão ansiosos")

Retorne APENAS um JSON:
{
  "afirmacoes": [
    "afirmação objetiva e verificável 1",
    "afirmação objetiva e verificável 2"
  ]
}

Se não houver afirmações verificáveis, retorne lista vazia.

TEXTO:
${conteudo.slice(0, 3000)}
  `;

  const resultado = await callOpenAIJSON(prompt, { useSearch: true, caller: "extractClaims" });

  const afirmacoes = Array.isArray(resultado.afirmacoes)
    ? resultado.afirmacoes
        .filter((a) => typeof a === "string" && a.trim().length > 15)
        .map((a) => a.trim())
        .filter((a, i, arr) => {
          // Remove duplicatas exatas
          if (arr.indexOf(a) !== i) return false;
          // Remove quasi-duplicatas: descarta se já existe uma afirmação com 80%+ de palavras em comum
          const palavras = new Set(a.toLowerCase().split(/\s+/));
          return !arr.slice(0, i).some((prev) => {
            const prevPalavras = prev.toLowerCase().split(/\s+/);
            const comuns = prevPalavras.filter((p) => palavras.has(p)).length;
            return comuns / Math.max(palavras.size, prevPalavras.length) >= 0.8;
          });
        })
        .slice(0, 5)
    : [];

  console.log(`[extractClaims] ${afirmacoes.length} afirmações extraídas`);
  return { afirmacoes };
}

module.exports = { extractClaims };
