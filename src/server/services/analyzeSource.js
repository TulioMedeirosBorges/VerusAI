const { callOpenAIJSON } = require("./openai");

async function analyzeSource({ sourceHandle, sourceUrl, platform, title, text }) {
  if (!sourceHandle) return null;

  const platformLabel = {
    youtube: "canal do YouTube",
    instagram: "perfil do Instagram",
    twitter: "perfil do X (Twitter)",
    tiktok: "perfil do TikTok",
    facebook: "página do Facebook",
  }[platform] || "perfil";

  const prompt = `
Você está analisando um conteúdo publicado no ${platformLabel} chamado "${sourceHandle}".
${sourceUrl ? `URL do canal/perfil: ${sourceUrl}` : ""}

Conteúdo analisado:
Título: ${title || "(sem título)"}
Texto: ${text?.slice(0, 1000) || "(sem texto)"}

Responda as seguintes perguntas sobre esse canal e esse conteúdo:

1. Quem é "${sourceHandle}"? É um veículo jornalístico reconhecido, influenciador, canal oficial de empresa/governo, ou perfil desconhecido?
2. Esse conteúdo parece ser uma notícia exclusiva desse canal, ou foi amplamente coberto por outros veículos?
3. Se for exclusivo, qual é o link direto mais provável para essa matéria no site oficial do canal (se existir site)?
4. Qual é o nível de credibilidade desse canal? (alta / média / baixa / desconhecida)

Regras:
- NUNCA invente URLs. Se não tiver certeza do link exato, coloque null.
- Se o canal for um veículo jornalístico conhecido (G1, BBC, CNN, Folha, etc.), tente encontrar a matéria no site oficial.

Retorne APENAS um JSON válido:
{
  "channelName": "nome do canal/perfil",
  "channelType": "news_outlet" | "influencer" | "official" | "unknown",
  "credibility": "alta" | "média" | "baixa" | "desconhecida",
  "isExclusive": true | false,
  "exclusivityNote": "Explicação sobre cobertura exclusiva ou ampla, em 1 frase",
  "officialArticleUrl": "URL da matéria no site oficial ou null",
  "channelSummary": "Quem é esse canal em 1-2 frases"
}
  `;

  const resultado = await callOpenAIJSON(prompt, { useSearch: true, caller: "analyzeSource" });

  return {
    channelName: resultado.channelName || sourceHandle,
    channelType: ["news_outlet", "influencer", "official", "unknown"].includes(resultado.channelType)
      ? resultado.channelType : "unknown",
    credibility: ["alta", "média", "baixa", "desconhecida"].includes(resultado.credibility)
      ? resultado.credibility : "desconhecida",
    isExclusive: !!resultado.isExclusive,
    exclusivityNote: typeof resultado.exclusivityNote === "string" ? resultado.exclusivityNote.trim() : null,
    officialArticleUrl: typeof resultado.officialArticleUrl === "string" && resultado.officialArticleUrl.startsWith("http")
      ? resultado.officialArticleUrl : null,
    channelSummary: typeof resultado.channelSummary === "string" ? resultado.channelSummary.trim() : null,
    sourceUrl: sourceUrl || null,
  };
}

module.exports = { analyzeSource };
