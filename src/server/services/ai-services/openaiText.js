// services/ai-services/openaiText.js
// Helpers compartilhados para ler o texto das respostas da OpenAI Responses API.

function getOutputText(data) {
  if (data?.output_text) return data.output_text;

  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text")
      .map((content) => content.text)
      .join("");
  }

  return "";
}

// A IA às vezes devolve a resposta embrulhada em JSON ({"resposta": "..."});
// extrai o texto puro nesses casos.
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

module.exports = { getOutputText, normalizeAIAnswer };
