// Helpers genéricos usados por vários módulos do servidor (normalização de
// texto, URLs, e-mails e campos de feedback).

const CONTROL_CHARS_NOME = new RegExp("[\\u0000-\\u001F\\u007F]", "g");
const CONTROL_CHARS_COMENTARIO = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
  "g",
);

function safeParseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function toPublicDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }
  return date.toISOString().slice(0, 10);
}

function toScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function dominioDaUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

function normalizarUrlPublica(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.href;
  } catch (e) {
    return "";
  }
}

function normalizarEmailUsuario(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function normalizarNomeUsuario(value, email = "") {
  const nome = String(value || "")
    .replace(CONTROL_CHARS_NOME, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (nome) return nome;
  return String(email || "").split("@")[0] || "Usuário";
}

function normalizarClienteFeedback(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 80);
}

function normalizarReacaoFeedback(value) {
  const reacao = String(value || "").trim().toLowerCase();
  return reacao === "like" || reacao === "dislike" ? reacao : "";
}

function normalizarComentarioFeedback(value) {
  return String(value || "")
    .replace(CONTROL_CHARS_COMENTARIO, "")
    .trim()
    .slice(0, 1000);
}

function normalizarNovaInformacao(value) {
  return String(value || "")
    .replace(CONTROL_CHARS_COMENTARIO, "")
    .trim()
    .slice(0, 3000);
}

function escapeHtmlEmail(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  safeParseJson,
  toPublicDate,
  toScore,
  decodeHtmlEntities,
  dominioDaUrl,
  normalizarUrlPublica,
  normalizarEmailUsuario,
  normalizarNomeUsuario,
  normalizarClienteFeedback,
  normalizarReacaoFeedback,
  normalizarComentarioFeedback,
  normalizarNovaInformacao,
  escapeHtmlEmail,
};
