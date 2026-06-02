// services/ai-services/chatAnalise.js
// IA dedicada ao chat de uma analise especifica.
// Recebe as informacoes da noticia geradas pelo buildFinal + a pergunta do usuario.

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

function getOutputText(data) {
  if (data?.output_text) return data.output_text;

  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text")
      .map((content) => content.text)
      .join("")
      .trim();
  }

  return "";
}

function normalizeAIAnswer(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      return (
        parsed.resposta ||
        parsed.answer ||
        parsed.mensagem ||
        parsed.message ||
        raw
      );
    }
  } catch (err) {}

  return raw;
}

// Variaveis do prompt precisam ser strings. Se vier um objeto (o buildFinal),
// serializamos para JSON; se ja vier uma string, usamos como esta.
function serializarAnalise(analise) {
  if (analise == null) return "";
  if (typeof analise === "string") return analise;
  try {
    return JSON.stringify(analise);
  } catch (err) {
    return String(analise);
  }
}

async function responderChatAnalise({ pergunta, analise }) {
  const promptId = process.env.OPENAI_CHAT_ANALISE_PROMPT_ID;

  if (!promptId) {
    throw new Error(
      "Prompt do chat de analise nao configurado. Defina OPENAI_CHAT_ANALISE_PROMPT_ID.",
    );
  }

  const prompt = {
    id: promptId,
    version: "1",
    variables: {
      pergunta: pergunta || "",
      analise: serializarAnalise(analise),
    },
  };

  const version = process.env.OPENAI_CHAT_ANALISE_PROMPT_VERSION;
  if (version) prompt.version = version;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Erro na API chatAnalise: ${response.status} - ${detail}`);
  }

  const data = await response.json();
  const resposta = normalizeAIAnswer(getOutputText(data));

  if (!resposta) {
    throw new Error("IA chatAnalise nao retornou resposta.");
  }

  return resposta;
}

module.exports = { responderChatAnalise };
