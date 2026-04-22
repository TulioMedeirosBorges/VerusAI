const { callOpenAIJSON } = require("./openai");

async function extractMainContent(text) {
  if (!text || text.trim().length < 50) {
    console.warn("[extractMainContent] Texto insuficiente");
    return { titulo: null, corpo: text || "", autor: null };
  }

  const prompt = `
Você recebeu o conteúdo bruto de uma página web.
Extraia apenas o conteúdo principal (título, corpo do texto, autor se houver).
Ignore menus, anúncios, rodapés, comentários e elementos de navegação.

Regras obrigatórias:
- Traduza TODO o conteúdo para português brasileiro, mesmo que o original esteja em outro idioma
- O corpo deve ser um texto corrido, limpo e legível
- Remova repetições, fragmentos de menu e elementos de interface

Retorne APENAS um JSON:
{
  "titulo": "título traduzido ou null",
  "corpo": "texto principal limpo, contínuo e em português",
  "autor": "nome do autor ou null"
}

CONTEÚDO BRUTO:
${text.slice(0, 4000)}
  `;

  const resultado = await callOpenAIJSON(prompt, { caller: "extractMainContent" });

  const titulo = typeof resultado.titulo === "string" ? resultado.titulo.trim() || null : null;
  const corpo = typeof resultado.corpo === "string" && resultado.corpo.trim().length > 0
    ? resultado.corpo.trim()
    : text.slice(0, 3000);
  const autor = typeof resultado.autor === "string" ? resultado.autor.trim() || null : null;

  console.log(`[extractMainContent] titulo=${!!titulo} corpo=${corpo.length}chars autor=${!!autor}`);
  return { titulo, corpo, autor };
}

module.exports = { extractMainContent };
