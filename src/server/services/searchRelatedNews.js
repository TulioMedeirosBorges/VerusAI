const { callOpenAIJSON } = require("./openai");

async function searchRelatedNews(afirmacoes) {
  if (!afirmacoes || afirmacoes.length === 0) return {};

  const lista = afirmacoes.map((a, i) => `${i + 1}. ${a}`).join("\n");

  const prompt = `
Você é um verificador de fatos rigoroso. Para cada afirmação abaixo, busque matérias jornalísticas que confirmem OU desmentem ESPECIFICAMENTE o que foi afirmado.

REGRAS CRÍTICAS:
- A matéria encontrada deve tratar EXATAMENTE da mesma afirmação: mesmo país, mesma pesquisa, mesma instituição, mesmos dados
- Se a afirmação fala de um estudo coreano sobre bióimpressao 3D de córnea, a matéria deve falar desse estudo específico — não de outro estudo sobre córnea artificial ou células-tronco
- NÃO inclua matérias sobre temas parecidos, tecnologias similares ou assuntos relacionados
- NÃO inclua matérias de outro país se a afirmação especifica um país
- Se não encontrar uma matéria que trate EXATAMENTE da afirmação, retorne links vazio []
- A URL deve ser REAL e verificável — NUNCA invente URLs
- O título deve ser o título real da matéria encontrada
- Prefira fontes: G1, Folha, Estadão, UOL, CNN Brasil, Reuters, BBC, Nature, Science, PubMed

AFIRMAÇÕES:
${lista}

Retorne APENAS um JSON válido:
{
  "materias": [
    {
      "afirmacao_index": 1,
      "links": [
        {
          "title": "Título real da matéria",
          "url": "https://...",
          "veiculo": "Nome do veículo",
          "data": "DD/MM/AAAA ou null"
        }
      ]
    }
  ]
}
  `;

  try {
    const resultado = await callOpenAIJSON(prompt, { useSearch: true, caller: "searchRelatedNews" });

    const map = {};
    if (Array.isArray(resultado.materias)) {
      for (const item of resultado.materias) {
        const idx = item.afirmacao_index - 1;
        const afirmacao = afirmacoes[idx];
        if (!afirmacao) continue;

        const links = Array.isArray(item.links)
          ? item.links
              .filter(l => l && typeof l.url === "string" && l.url.startsWith("http") && typeof l.title === "string")
              .map(l => ({ title: l.title.trim(), url: l.url.trim(), veiculo: l.veiculo?.trim() || null, data: l.data?.trim() || null }))
              .slice(0, 2)
          : [];

        if (links.length > 0) map[afirmacao] = links;
      }
    }

    console.log(`[searchRelatedNews] ${Object.keys(map).length} afirmações com matérias encontradas`);
    return map;
  } catch (e) {
    console.warn("[searchRelatedNews] Falhou:", e.message);
    return {};
  }
}

module.exports = { searchRelatedNews };
