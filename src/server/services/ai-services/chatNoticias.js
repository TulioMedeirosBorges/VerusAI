// services/ai-services/chatNoticias.js
// IA dedicada ao chat de noticias. Recebe apenas a pergunta do usuario.

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const { getOutputText, normalizeAIAnswer } = require("./openaiText.js");

async function responderChatNoticias({ pergunta }) {
  const promptId = process.env.OPENAI_CHAT_NOTICIAS_PROMPT_ID;

  if (!promptId) {
    throw new Error(
      "Prompt do chat de noticias nao configurado. Defina OPENAI_CHAT_NOTICIAS_PROMPT_ID.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: promptId,
        version: "12",
        variables: {
          pergunta: pergunta || "",
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Erro na API chatNoticias: ${response.status} - ${detail}`);
  }

  const data = await response.json();
  const resposta = normalizeAIAnswer(getOutputText(data));

  if (!resposta) {
    throw new Error("IA chatNoticias nao retornou resposta.");
  }

  return resposta;
}

module.exports = { responderChatNoticias };
