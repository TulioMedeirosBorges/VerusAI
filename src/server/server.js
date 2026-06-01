const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const db = new Database("usuarios.db");
const PASSWORD_RESET_TOKEN_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_TOKEN_CLEANUP_MS = 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tokens_recuperacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expira_em DATETIME NOT NULL,
  usado INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS usuario_sessoes (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  nome TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS cache_analises (
  url TEXT PRIMARY KEY,
  titulo TEXT,
  veredicto TEXT,
  score INTEGER,
  fontes_consultadas TEXT DEFAULT '[]',
  entidades TEXT DEFAULT '[]',
  resultado TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS chat_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  url TEXT,
  titulo TEXT,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS noticia_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  titulo TEXT DEFAULT '',
  cliente_id TEXT NOT NULL,
  usuario_email TEXT DEFAULT '',
  usuario_nome TEXT DEFAULT '',
  reacao TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  editado INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(url, cliente_id)
)`);

try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN titulo TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN veredicto TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN score INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN fontes_consultadas TEXT DEFAULT '[]'");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN entidades TEXT DEFAULT '[]'");
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN configs TEXT DEFAULT '{}'");
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN nome TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE noticia_feedback ADD COLUMN usuario_email TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE noticia_feedback ADD COLUMN usuario_nome TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE noticia_feedback ADD COLUMN editado INTEGER DEFAULT 0");
} catch (e) {}

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

function extractLinkPreviewMeta(html, url) {
  const head = String(html || "").slice(0, 500000);
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  function metaValue(names) {
    for (const name of names) {
      const re = new RegExp(
        `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      );
      const reverse = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`,
        "i",
      );
      const match = head.match(re) || head.match(reverse);
      if (match?.[1]) return decodeHtmlEntities(match[1].trim());
    }
    return "";
  }

  const finalUrl = url || "";
  let domain = "";
  try {
    domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch (e) {}

  let image = metaValue(["og:image", "twitter:image"]);
  if (image) {
    try {
      image = new URL(image, finalUrl).href;
    } catch (e) {
      image = "";
    }
  }

  return {
    url: finalUrl,
    domain,
    title:
      metaValue(["og:title", "twitter:title"]) ||
      decodeHtmlEntities(titleMatch?.[1]?.replace(/\s+/g, " ").trim() || ""),
    description: metaValue([
      "description",
      "og:description",
      "twitter:description",
    ]),
    image,
  };
}

function normalizarUrlPreview(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.href;
  } catch (e) {
    return "";
  }
}

async function buildPublicLinkPreview(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    const finalUrl = res.url || url;

    if (!contentType.includes("text/html")) {
      return extractLinkPreviewMeta("", finalUrl);
    }

    const html = await res.text();
    return extractLinkPreviewMeta(html, finalUrl);
  } finally {
    clearTimeout(timeout);
  }
}

function getBuildFinal(resultado) {
  if (!resultado || typeof resultado !== "object") return null;
  if (resultado.etapa === "buildFinal") return resultado;
  return (
    resultado.etapa11_buildFinal ||
    resultado.etapa10_buildFinal ||
    resultado.buildFinal ||
    resultado.resultado?.etapa11_buildFinal ||
    resultado.resultado?.etapa10_buildFinal ||
    resultado.data?.etapa11_buildFinal ||
    resultado.data?.etapa10_buildFinal ||
    null
  );
}

function mapVereditoPublico(veredito) {
  const value = String(veredito || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  if (["confirmado", "confirmada", "provavelmente_confirmado"].includes(value)) {
    return "true";
  }

  if (["falso", "falsa", "provavelmente_falso", "contradita"].includes(value)) {
    return "false";
  }

  return "mixed";
}

function fonteLabel(fonte) {
  if (!fonte) return "";
  if (typeof fonte === "string") return fonte;
  return (
    fonte.fonte ||
    fonte.titulo ||
    fonte.dominio ||
    fonte.url ||
    fonte.tipoFonte ||
    ""
  );
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
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (nome) return nome;
  return String(email || "").split("@")[0] || "Usuário";
}

function criarSessaoUsuario(email, nome = "") {
  const emailNormalizado = normalizarEmailUsuario(email);
  const nomePublico = normalizarNomeUsuario(nome, emailNormalizado);
  const token = crypto.randomBytes(32).toString("hex");

  db.prepare(
    `INSERT INTO usuario_sessoes (token, email, nome)
     VALUES (?, ?, ?)`,
  ).run(token, emailNormalizado, nomePublico);

  return {
    token,
    email: emailNormalizado,
    nome: nomePublico,
  };
}

function obterSessaoUsuario(token) {
  const tokenLimpo = String(token || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(tokenLimpo)) return null;

  const row = db
    .prepare(
      `SELECT s.email,
              COALESCE(NULLIF(u.nome, ''), NULLIF(s.nome, ''), '') AS nome
       FROM usuario_sessoes s
       LEFT JOIN usuarios u ON lower(u.email) = lower(s.email)
       WHERE s.token = ?`,
    )
    .get(tokenLimpo);

  if (!row?.email) return null;
  const email = normalizarEmailUsuario(row.email);
  return {
    email,
    nome: normalizarNomeUsuario(row.nome, email),
  };
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
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 1000);
}

function normalizarNovaInformacao(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
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

function emailEmpresaDestino() {
  return (
    process.env.EMPRESA_EMAIL ||
    process.env.COMPANY_EMAIL ||
    process.env.CONTATO_EMAIL ||
    process.env.EMAIL_USER ||
    ""
  );
}

function criarExpiracaoTokenRecuperacao() {
  return new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();
}

function limparTokensRecuperacaoExpirados() {
  try {
    db.prepare(
      `DELETE FROM tokens_recuperacao
       WHERE usado = 1
          OR julianday(expira_em) <= julianday('now')
          OR julianday(criado_em, '+5 minutes') <= julianday('now')`,
    ).run();
  } catch (err) {
    console.warn("[tokens_recuperacao] limpeza ignorada:", err.message);
  }
}

limparTokensRecuperacaoExpirados();
const resetTokenCleanupTimer = setInterval(
  limparTokensRecuperacaoExpirados,
  PASSWORD_RESET_TOKEN_CLEANUP_MS,
);
if (typeof resetTokenCleanupTimer.unref === "function") {
  resetTokenCleanupTimer.unref();
}

function obterResumoFeedback(url) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes,
         SUM(CASE WHEN NULLIF(TRIM(comentario), '') IS NOT NULL THEN 1 ELSE 0 END) AS comentarios
       FROM noticia_feedback
       WHERE url = ?`,
    )
    .get(url);

  return {
    likes: Number(row?.likes || 0),
    dislikes: Number(row?.dislikes || 0),
    comentarios: Number(row?.comentarios || 0),
  };
}

function datasDiferentesFeedback(criadoEm, atualizadoEm) {
  if (!criadoEm || !atualizadoEm) return false;
  return String(criadoEm).slice(0, 19) !== String(atualizadoEm).slice(0, 19);
}

function montarFeedbackPublico(row, usuarioEmail = "") {
  if (!row) return null;
  const email = row.usuario_email || row.cliente_id || "";
  const proprioUsuario =
    Boolean(usuarioEmail) &&
    normalizarEmailUsuario(email) === normalizarEmailUsuario(usuarioEmail);

  return {
    reacao: row.reacao || "",
    comentario: row.comentario || "",
    usuarioNome: normalizarNomeUsuario(row.usuario_nome, email),
    proprioUsuario,
    editado: Boolean(row.editado) || datasDiferentesFeedback(row.criado_em, row.atualizado_em),
    atualizadoEm: row.atualizado_em || row.criado_em || "",
  };
}

function obterFeedbackUsuario(url, usuarioEmail) {
  if (!url || !usuarioEmail) return null;
  const row = db
    .prepare(
      `SELECT cliente_id, usuario_email, usuario_nome, reacao, comentario, editado, criado_em, atualizado_em
       FROM noticia_feedback
       WHERE url = ? AND cliente_id = ?`,
    )
    .get(url, usuarioEmail);

  return montarFeedbackPublico(row, usuarioEmail);
}

function obterComentariosFeedback(url, usuarioEmail) {
  if (!url) return [];
  const rows = db
    .prepare(
      `SELECT cliente_id, usuario_email, usuario_nome, reacao, comentario, editado, criado_em, atualizado_em
       FROM noticia_feedback
       WHERE url = ?
         AND NULLIF(TRIM(comentario), '') IS NOT NULL
       ORDER BY julianday(atualizado_em) DESC, id DESC
       LIMIT 50`,
    )
    .all(url);

  return rows
    .map((row) => montarFeedbackPublico(row, usuarioEmail))
    .filter((item) => item?.comentario);
}

function dominioDaUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

function normalizarFonteConsultada(fonte) {
  if (!fonte) return null;

  if (typeof fonte === "string") {
    const url = normalizarUrlPublica(fonte);
    return {
      titulo: url ? dominioDaUrl(url) || url : fonte,
      fonte: url ? dominioDaUrl(url) : fonte,
      url,
      dominio: url ? dominioDaUrl(url) : "",
      tipoFonte: "",
      relevancia: "",
      papelNaVerificacao: "",
      resumo: "",
    };
  }

  const url = normalizarUrlPublica(fonte.url || fonte.href || fonte.link);
  const dominio = fonte.dominio || fonte.domain || (url ? dominioDaUrl(url) : "");
  const nome =
    fonte.fonte ||
    fonte.titulo ||
    fonte.title ||
    fonte.nome ||
    fonte.instituicao ||
    fonte.veiculo ||
    dominio ||
    url ||
    "";

  if (!nome && !url) return null;

  return {
    titulo: fonte.titulo || fonte.title || nome,
    fonte: fonte.fonte || fonte.nome || fonte.instituicao || fonte.veiculo || nome,
    url,
    dominio,
    tipoFonte: fonte.tipoFonte || fonte.tipo_fonte || fonte.tipo || "",
    relevancia: fonte.relevancia || "",
    papelNaVerificacao:
      fonte.papelNaVerificacao || fonte.papel_na_verificacao || "",
    resumo:
      fonte.resumo ||
      fonte.explicacao ||
      fonte.resumoEvidencia ||
      fonte.resumo_evidencia ||
      "",
  };
}

function coletarFontesConsultadas(buildFinal) {
  const fontes = [];

  (Array.isArray(buildFinal?.fontesPrincipais)
    ? buildFinal.fontesPrincipais
    : []
  ).forEach((fonte) => {
    const normalizada = normalizarFonteConsultada(fonte);
    if (normalizada) fontes.push(normalizada);
  });

  (Array.isArray(buildFinal?.claimsAnalisadas)
    ? buildFinal.claimsAnalisadas
    : []
  ).forEach((claim) => {
    (Array.isArray(claim.evidencias) ? claim.evidencias : []).forEach((ev) => {
      const normalizada = normalizarFonteConsultada(ev);
      if (normalizada) fontes.push(normalizada);
    });
  });

  const deduped = new Map();
  fontes.forEach((fonte) => {
    const key = fonte.url || `${fonte.fonte}::${fonte.titulo}`.toLowerCase();
    if (!key || deduped.has(key)) return;
    deduped.set(key, fonte);
  });

  return Array.from(deduped.values()).slice(0, 12);
}

function coletarFontesPublicas(buildFinal) {
  return coletarFontesConsultadas(buildFinal)
    .map((fonte) => fonteLabel(fonte))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizarEntidadePublica(entidade) {
  if (!entidade) return null;

  if (typeof entidade === "string") {
    return { nome: entidade, tipo: "outros", url: "" };
  }

  const nome = entidade.nome || entidade.name || entidade.texto || "";
  if (!nome) return null;

  return {
    nome,
    tipo: entidade.tipo || entidade.type || "outros",
    url: normalizarUrlPublica(
      entidade.urlWikipedia || entidade.wikipedia || entidade.url,
    ),
  };
}

function coletarEntidadesPublicas(buildFinal) {
  const entidades = Array.isArray(buildFinal?.entidadesMencionadas)
    ? buildFinal.entidadesMencionadas
    : Array.isArray(buildFinal?.entidadesDetectadas)
      ? buildFinal.entidadesDetectadas
      : [];

  const deduped = new Map();
  entidades.forEach((entidade) => {
    const normalizada = normalizarEntidadePublica(entidade);
    if (!normalizada) return;
    const key = `${normalizada.tipo}::${normalizada.nome}`.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, normalizada);
  });

  return Array.from(deduped.values()).slice(0, 24);
}

const UPDATE_STOPWORDS = new Set([
  "a",
  "agora",
  "ainda",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "ela",
  "ele",
  "em",
  "entre",
  "era",
  "essa",
  "esse",
  "esta",
  "este",
  "foi",
  "ha",
  "isso",
  "ja",
  "mais",
  "mas",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "pela",
  "pelo",
  "por",
  "que",
  "se",
  "sem",
  "ser",
  "sobre",
  "sua",
  "tem",
  "um",
  "uma",
]);

function normalizarTextoComparacao(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9,%.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensComparacao(value) {
  const tokens = normalizarTextoComparacao(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter(
      (token) =>
        token.length > 2 &&
        !UPDATE_STOPWORDS.has(token) &&
        !/^\d+$/.test(token),
    );

  return Array.from(new Set(tokens));
}

function similaridadeTexto(a, b) {
  const tokensA = tokensComparacao(a);
  const tokensB = tokensComparacao(b);
  if (!tokensA.length || !tokensB.length) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersecao = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersecao += 1;
  });

  return intersecao / new Set([...tokensA, ...tokensB]).size;
}

function numerosDoTexto(value) {
  const matches = normalizarTextoComparacao(value).match(/\d+(?:[,.]\d+)?%?/g);
  return Array.from(new Set(matches || []));
}

function numerosCompativeis(a, b) {
  const numsA = numerosDoTexto(a);
  const numsB = numerosDoTexto(b);
  if (!numsA.length || !numsB.length) return true;
  if (numsA.length !== numsB.length) return false;
  return numsA.every((num) => numsB.includes(num));
}

function textoClaim(claim) {
  if (!claim) return "";
  if (typeof claim === "string") return claim;
  return [
    claim.textoFinal,
    claim.textoOriginal,
    claim.explicacao,
    claim.statusNormalizado,
  ]
    .filter(Boolean)
    .join(" ");
}

function resumoBuildFinal(buildFinal) {
  return (
    buildFinal?.resumoCurto ||
    buildFinal?.mensagemPrincipalUsuario ||
    buildFinal?.resumoDetalhado ||
    buildFinal?.textoFinalSemHtml ||
    ""
  );
}

function textoComparavelBuildFinal(buildFinal) {
  return [
    buildFinal?.tituloFinal,
    buildFinal?.assuntoPrincipal,
    resumoBuildFinal(buildFinal),
    ...(Array.isArray(buildFinal?.claimsAnalisadas)
      ? buildFinal.claimsAnalisadas.map(textoClaim)
      : []),
  ]
    .filter(Boolean)
    .join(" ");
}

function chavesEntidades(buildFinal) {
  return coletarEntidadesPublicas(buildFinal).map((entidade) =>
    normalizarTextoComparacao(`${entidade.tipo}:${entidade.nome}`),
  );
}

function similaridadeEntidades(a, b) {
  const entidadesA = chavesEntidades(a);
  const entidadesB = chavesEntidades(b);
  if (!entidadesA.length || !entidadesB.length) return 0;

  const setA = new Set(entidadesA);
  const setB = new Set(entidadesB);
  let intersecao = 0;
  setA.forEach((entidade) => {
    if (setB.has(entidade)) intersecao += 1;
  });

  return intersecao / Math.min(setA.size, setB.size);
}

function calcularSimilaridadeAnalise(atual, anterior) {
  const tituloScore = similaridadeTexto(
    atual?.tituloFinal || atual?.urlOriginal,
    anterior?.tituloFinal || anterior?.urlOriginal,
  );
  const assuntoScore = similaridadeTexto(
    atual?.assuntoPrincipal || resumoBuildFinal(atual),
    anterior?.assuntoPrincipal || resumoBuildFinal(anterior),
  );
  const claimsScore = similaridadeTexto(
    textoComparavelBuildFinal(atual),
    textoComparavelBuildFinal(anterior),
  );
  const entidadesScore = similaridadeEntidades(atual, anterior);
  const score =
    tituloScore * 0.42 +
    assuntoScore * 0.22 +
    claimsScore * 0.24 +
    entidadesScore * 0.12;

  return {
    score,
    tituloScore,
    assuntoScore,
    claimsScore,
    entidadesScore,
  };
}

function analisesParecidas(metricas) {
  return (
    metricas.tituloScore >= 0.72 ||
    metricas.score >= 0.56 ||
    (metricas.entidadesScore >= 0.5 &&
      (metricas.tituloScore >= 0.34 ||
        metricas.assuntoScore >= 0.38 ||
        metricas.claimsScore >= 0.38))
  );
}

function encontrarAnaliseRelacionada(buildFinal, url) {
  const rowExata = db
    .prepare(
      "SELECT url, titulo, resultado, criado_em FROM cache_analises WHERE url = ?",
    )
    .get(url);

  if (rowExata) {
    return {
      row: rowExata,
      metricas: {
        score: 1,
        tituloScore: 1,
        assuntoScore: 1,
        claimsScore: 1,
        entidadesScore: 1,
      },
      criterio: "url_exata",
    };
  }

  const rows = db
    .prepare(
      "SELECT url, titulo, resultado, criado_em FROM cache_analises ORDER BY criado_em DESC LIMIT 500",
    )
    .all();

  let melhor = null;
  rows.forEach((row) => {
    const resultadoAnterior = safeParseJson(row.resultado, {});
    const buildAnterior = getBuildFinal(resultadoAnterior) || resultadoAnterior || {};
    const metricas = calcularSimilaridadeAnalise(buildFinal, buildAnterior);
    if (!analisesParecidas(metricas)) return;
    if (!melhor || metricas.score > melhor.metricas.score) {
      melhor = {
        row,
        metricas,
        criterio: "similaridade_conteudo",
      };
    }
  });

  return melhor;
}

function claimJaExiste(claimNova, claimsAnteriores) {
  const textoNovo = textoClaim(claimNova);
  const normalizadoNovo = normalizarTextoComparacao(textoNovo);
  if (!normalizadoNovo) return true;

  return (Array.isArray(claimsAnteriores) ? claimsAnteriores : []).some(
    (claimAnterior) => {
      const textoAnterior = textoClaim(claimAnterior);
      const normalizadoAnterior = normalizarTextoComparacao(textoAnterior);
      if (!normalizadoAnterior) return false;
      if (normalizadoAnterior === normalizadoNovo) return true;

      const score = similaridadeTexto(textoAnterior, textoNovo);
      return score >= 0.82 && numerosCompativeis(textoAnterior, textoNovo);
    },
  );
}

function mesclarClaims(claimsAnteriores, claimsNovas) {
  const anteriores = Array.isArray(claimsAnteriores) ? claimsAnteriores : [];
  const novas = [];
  const mescladas = anteriores.map((claim) => ({ ...claim }));

  (Array.isArray(claimsNovas) ? claimsNovas : []).forEach((claim) => {
    if (claimJaExiste(claim, mescladas)) return;
    const marcada = {
      ...claim,
      adicionadaEmAtualizacao: true,
      adicionadaEm: new Date().toISOString(),
    };
    novas.push(marcada);
    mescladas.push(marcada);
  });

  return { mescladas, novas };
}

function itemTextoJaExiste(item, itens) {
  const textoNovo = normalizarTextoComparacao(item);
  if (!textoNovo) return true;
  return (Array.isArray(itens) ? itens : []).some((existente) => {
    const textoExistente = normalizarTextoComparacao(existente);
    if (!textoExistente) return false;
    if (textoExistente === textoNovo) return true;
    return (
      similaridadeTexto(textoExistente, textoNovo) >= 0.78 &&
      numerosCompativeis(textoExistente, textoNovo)
    );
  });
}

function mesclarListaTexto(anteriores, novos, limite = 20) {
  const mescladas = (Array.isArray(anteriores) ? anteriores : [])
    .filter(Boolean)
    .slice();
  const adicionadas = [];

  (Array.isArray(novos) ? novos : []).filter(Boolean).forEach((item) => {
    if (itemTextoJaExiste(item, mescladas)) return;
    mescladas.push(item);
    adicionadas.push(item);
  });

  return { mescladas: mescladas.slice(0, limite), adicionadas };
}

function mesclarFontes(anteriores, novas) {
  const dedup = new Map();
  const adicionadas = [];

  function keyFonte(fonte) {
    const normalizada = normalizarFonteConsultada(fonte);
    if (!normalizada) return "";
    return (
      normalizada.url ||
      `${normalizada.fonte || ""}::${normalizada.titulo || ""}`.toLowerCase()
    );
  }

  (Array.isArray(anteriores) ? anteriores : []).forEach((fonte) => {
    const normalizada = normalizarFonteConsultada(fonte);
    const key = keyFonte(normalizada);
    if (normalizada && key && !dedup.has(key)) dedup.set(key, normalizada);
  });

  (Array.isArray(novas) ? novas : []).forEach((fonte) => {
    const normalizada = normalizarFonteConsultada(fonte);
    const key = keyFonte(normalizada);
    if (!normalizada || !key || dedup.has(key)) return;
    dedup.set(key, normalizada);
    adicionadas.push(normalizada);
  });

  return {
    mescladas: Array.from(dedup.values()).slice(0, 16),
    adicionadas,
  };
}

function mesclarEntidades(anteriores, novas) {
  const dedup = new Map();
  [...(Array.isArray(anteriores) ? anteriores : []), ...(Array.isArray(novas) ? novas : [])]
    .map(normalizarEntidadePublica)
    .filter(Boolean)
    .forEach((entidade) => {
      const key = `${entidade.tipo}::${entidade.nome}`.toLowerCase();
      if (!dedup.has(key)) dedup.set(key, entidade);
    });
  return Array.from(dedup.values()).slice(0, 30);
}

function mesclarAlertas(anteriores, novos) {
  const dedup = new Map();
  [...(Array.isArray(anteriores) ? anteriores : []), ...(Array.isArray(novos) ? novos : [])]
    .filter(Boolean)
    .forEach((alerta) => {
      const key = normalizarTextoComparacao(
        alerta.mensagem || alerta.tipo || alerta.impacto || JSON.stringify(alerta),
      );
      if (key && !dedup.has(key)) dedup.set(key, alerta);
    });
  return Array.from(dedup.values()).slice(0, 12);
}

function contarClaimsResumo(claims) {
  const resumo = {
    totalClaims: 0,
    confirmadas: 0,
    parcialmenteConfirmadas: 0,
    inconclusivas: 0,
    naoConfirmadas: 0,
    contraditas: 0,
    comErro: 0,
  };

  (Array.isArray(claims) ? claims : []).forEach((claim) => {
    resumo.totalClaims += 1;
    const status = normalizarTextoComparacao(
      claim.statusNormalizado || claim.statusOriginal || "",
    ).replace(/\s+/g, "_");
    if (status.includes("parcialmente")) resumo.parcialmenteConfirmadas += 1;
    else if (status.includes("nao_confirmad")) resumo.naoConfirmadas += 1;
    else if (status.includes("confirmad")) resumo.confirmadas += 1;
    else if (status.includes("contrad")) resumo.contraditas += 1;
    else if (status.includes("erro")) resumo.comErro += 1;
    else resumo.inconclusivas += 1;
  });

  return resumo;
}

function montarAvisoAtualizacao({ anterior, atual, match, novasClaims, novosPontos }) {
  const resumoAntigo = resumoBuildFinal(anterior);
  const resumoNovo = resumoBuildFinal(atual);
  const novasInformacoes = [
    ...novasClaims.map((claim) => claim.textoFinal || claim.textoOriginal || ""),
    ...novosPontos,
  ].filter(Boolean);

  return {
    ativo: true,
    tipo: "atualizacao_noticia_existente",
    mensagem:
      "Esta analise parece atualizar uma noticia que ja estava no site. O sistema preservou o que ja existia e adicionou apenas informacoes novas.",
    criterio: match.criterio,
    confiancaSimilaridade: Math.round((match.metricas?.score || 0) * 100),
    urlAnterior: match.row.url,
    tituloAnterior: anterior.tituloFinal || match.row.titulo || match.row.url,
    tituloNovo: atual.tituloFinal || atual.urlOriginal || "",
    resumoAntigo,
    resumoNovo,
    novasInformacoes,
    analisadoAnteriormenteEm: match.row.criado_em || "",
    atualizadoEm: new Date().toISOString(),
  };
}

function prepararResultadoComVerificador(buildFinal, url) {
  const match = encontrarAnaliseRelacionada(buildFinal, url);
  if (!match) {
    return {
      buildFinal,
      destinoUrl: url,
      updateInfo: null,
      semNovasInformacoes: false,
    };
  }

  const resultadoAnterior = safeParseJson(match.row.resultado, {});
  const anterior = getBuildFinal(resultadoAnterior) || resultadoAnterior || {};
  const claims = mesclarClaims(
    anterior.claimsAnalisadas,
    buildFinal.claimsAnalisadas,
  );
  const pontos = mesclarListaTexto(
    anterior.pontosImportantes,
    buildFinal.pontosImportantes,
    24,
  );
  const confirmados = mesclarListaTexto(
    anterior.oQueFoiConfirmado,
    buildFinal.oQueFoiConfirmado,
    20,
  );
  const inconclusivos = mesclarListaTexto(
    anterior.oQueFicouInconclusivo,
    buildFinal.oQueFicouInconclusivo,
    20,
  );
  const contraditos = mesclarListaTexto(
    anterior.oQueFoiContradito,
    buildFinal.oQueFoiContradito,
    20,
  );
  const fontes = mesclarFontes(
    coletarFontesConsultadas(anterior),
    coletarFontesConsultadas(buildFinal),
  );
  const entidades = mesclarEntidades(
    coletarEntidadesPublicas(anterior),
    coletarEntidadesPublicas(buildFinal),
  );
  const alertas = mesclarAlertas(anterior.alertasGerais, buildFinal.alertasGerais);
  const resumoAnteriorTexto = resumoBuildFinal(anterior);
  const resumoNovoTexto = resumoBuildFinal(buildFinal);
  const resumoTemNovaInformacao =
    Boolean(resumoNovoTexto) &&
    (!resumoAnteriorTexto ||
      similaridadeTexto(resumoAnteriorTexto, resumoNovoTexto) < 0.72 ||
      !numerosCompativeis(resumoAnteriorTexto, resumoNovoTexto));
  const novasInformacoesCount =
    claims.novas.length +
    pontos.adicionadas.length +
    confirmados.adicionadas.length +
    inconclusivos.adicionadas.length +
    contraditos.adicionadas.length +
    (resumoTemNovaInformacao ? 1 : 0);

  if (!novasInformacoesCount) {
    return {
      buildFinal: anterior,
      destinoUrl: match.row.url,
      updateInfo: {
        tipo: "noticia_repetida_sem_novas_informacoes",
        urlExistente: match.row.url,
        tituloExistente: anterior.tituloFinal || match.row.titulo || match.row.url,
      },
      semNovasInformacoes: true,
    };
  }

  const avisoAtualizacao = montarAvisoAtualizacao({
    anterior,
    atual: buildFinal,
    match,
    novasClaims: claims.novas,
    novosPontos: [
      ...(resumoTemNovaInformacao
        ? ["O resumo novo traz informacoes diferentes da versao anterior."]
        : []),
      ...pontos.adicionadas,
      ...confirmados.adicionadas,
      ...inconclusivos.adicionadas,
      ...contraditos.adicionadas,
    ],
  });
  const urlsRelacionadas = Array.from(
    new Set(
      [
        ...(Array.isArray(anterior.urlsRelacionadas)
          ? anterior.urlsRelacionadas
          : []),
        anterior.urlOriginal,
        match.row.url,
        buildFinal.urlOriginal,
        url,
      ].filter(Boolean),
    ),
  );

  return {
    buildFinal: {
      ...anterior,
      ...buildFinal,
      claimsAnalisadas: claims.mescladas,
      claimsResumo: contarClaimsResumo(claims.mescladas),
      fontesPrincipais: fontes.mescladas,
      entidadesMencionadas: entidades,
      alertasGerais: alertas,
      pontosImportantes: pontos.mescladas,
      oQueFoiConfirmado: confirmados.mescladas,
      oQueFicouInconclusivo: inconclusivos.mescladas,
      oQueFoiContradito: contraditos.mescladas,
      urlsRelacionadas,
      avisoAtualizacao,
      urlOriginal: url,
    },
    destinoUrl: url,
    updateInfo: avisoAtualizacao,
    semNovasInformacoes: false,
    removerUrlAnterior:
      match.row.url && match.row.url !== url ? match.row.url : "",
  };
}

function montarAnalisePublica(row, incluirResultado = false) {
  const resultado = safeParseJson(row.resultado, {});
  const buildFinal = getBuildFinal(resultado) || resultado || {};
  const fontesConsultadas = safeParseJson(row.fontes_consultadas || "[]", []);
  const entidades = safeParseJson(row.entidades || "[]", []);
  const url = buildFinal.urlOriginal || row.url || "";
  const titulo = row.titulo || buildFinal.tituloFinal || url;
  const resumo =
    buildFinal.resumoCurto ||
    buildFinal.mensagemPrincipalUsuario ||
    buildFinal.resumoDetalhado ||
    buildFinal.textoFinalSemHtml ||
    "";

  const analise = {
    id: url,
    url,
    title: titulo,
    titulo,
    summary: resumo,
    resumo,
    veracity: row.veredicto || mapVereditoPublico(buildFinal.vereditoGeral),
    veredito: row.veredicto || mapVereditoPublico(buildFinal.vereditoGeral),
    vereditoGeral: buildFinal.vereditoGeral || "",
    score: row.score ?? toScore(buildFinal.scoreConfiabilidade),
    nivelConfiabilidade: buildFinal.nivelConfiabilidade || "",
    fontesConsultadas:
      Array.isArray(fontesConsultadas) && fontesConsultadas.length
        ? fontesConsultadas
        : coletarFontesConsultadas(buildFinal),
    entidadesMencionadas:
      Array.isArray(entidades) && entidades.length
        ? entidades
        : coletarEntidadesPublicas(buildFinal),
    sources:
      Array.isArray(fontesConsultadas) && fontesConsultadas.length
        ? Array.from(
            new Set(fontesConsultadas.map((fonte) => fonteLabel(fonte)).filter(Boolean)),
          ).slice(0, 8)
        : coletarFontesPublicas(buildFinal),
    date: toPublicDate(row.criado_em),
    checkedAt: row.criado_em,
    publishedDate: buildFinal.dataPublicacao || "",
    createdAt: row.criado_em,
    total_likes: Number(row.total_likes || 0),
    total_dislikes: Number(row.total_dislikes || 0),
    avisoAtualizacao: buildFinal.avisoAtualizacao || null,
  };

  if (incluirResultado) analise.resultado = buildFinal;
  return analise;
}

function salvarAnaliseNoCache(resultado, pageData = {}) {
  const buildFinal = getBuildFinal(resultado);
  if (!buildFinal) return null;

  const url = buildFinal.urlOriginal || resultado?.url || pageData.url || "";
  if (!url) return null;

  const preparado = prepararResultadoComVerificador(buildFinal, url);

  if (preparado.semNovasInformacoes) {
    return {
      url: preparado.destinoUrl,
      titulo:
        preparado.buildFinal.tituloFinal ||
        pageData.title ||
        preparado.destinoUrl,
      veredicto: mapVereditoPublico(preparado.buildFinal.vereditoGeral),
      score: toScore(preparado.buildFinal.scoreConfiabilidade),
      status: "sem_novas_informacoes",
      avisoAtualizacao: preparado.updateInfo,
    };
  }

  const buildFinalParaSalvar = preparado.buildFinal;
  const destinoUrl = preparado.destinoUrl || url;

  const titulo =
    buildFinalParaSalvar.tituloFinal ||
    resultado?.titulo ||
    pageData.title ||
    pageData.url ||
    destinoUrl;
  const veredicto = mapVereditoPublico(buildFinalParaSalvar.vereditoGeral);
  const score = toScore(buildFinalParaSalvar.scoreConfiabilidade);
  const fontesConsultadas = coletarFontesConsultadas(buildFinalParaSalvar);
  const entidades = coletarEntidadesPublicas(buildFinalParaSalvar);
  const resultadoFinal = {
    ...buildFinalParaSalvar,
    fontesPrincipais: fontesConsultadas,
    entidadesMencionadas: entidades,
    urlOriginal: destinoUrl,
    salvoEm: new Date().toISOString(),
  };

  if (preparado.removerUrlAnterior) {
    db.prepare("DELETE FROM cache_analises WHERE url = ?").run(
      preparado.removerUrlAnterior,
    );
  }

  db.prepare(
    `INSERT INTO cache_analises (url, titulo, veredicto, score, fontes_consultadas, entidades, resultado, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(url) DO UPDATE SET
       titulo = excluded.titulo,
       veredicto = excluded.veredicto,
       score = excluded.score,
       fontes_consultadas = excluded.fontes_consultadas,
       entidades = excluded.entidades,
       resultado = excluded.resultado,
       criado_em = CURRENT_TIMESTAMP`,
  ).run(
    destinoUrl,
    titulo,
    veredicto,
    score,
    JSON.stringify(fontesConsultadas),
    JSON.stringify(entidades),
    JSON.stringify(resultadoFinal),
  );

  return {
    url: destinoUrl,
    titulo,
    veredicto,
    score,
    status: preparado.updateInfo ? "atualizada_com_novas_informacoes" : "salva",
    avisoAtualizacao: preparado.updateInfo || null,
  };
}

function backfillCacheAnalisesMetadata() {
  try {
    const rows = db
      .prepare(
        "SELECT url, resultado, fontes_consultadas, entidades FROM cache_analises",
      )
      .all();
    const update = db.prepare(
      "UPDATE cache_analises SET fontes_consultadas = ?, entidades = ? WHERE url = ?",
    );

    rows.forEach((row) => {
      const fontesAtuais = safeParseJson(row.fontes_consultadas || "[]", []);
      const entidadesAtuais = safeParseJson(row.entidades || "[]", []);
      if (fontesAtuais.length && entidadesAtuais.length) return;

      const resultado = safeParseJson(row.resultado, {});
      const buildFinal = getBuildFinal(resultado) || resultado || {};
      const fontes = fontesAtuais.length
        ? fontesAtuais
        : coletarFontesConsultadas(buildFinal);
      const entidades = entidadesAtuais.length
        ? entidadesAtuais
        : coletarEntidadesPublicas(buildFinal);

      if (!fontes.length && !entidades.length) return;
      update.run(JSON.stringify(fontes), JSON.stringify(entidades), row.url);
    });
  } catch (err) {
    console.warn("[cache_analises] backfill metadata ignorado:", err.message);
  }
}

backfillCacheAnalisesMetadata();

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────

app.post("/register", async (req, res) => {
  const { email, senha, nome } = req.body;
  const emailNormalizado = normalizarEmailUsuario(email);
  const nomePublico = normalizarNomeUsuario(nome, emailNormalizado);
  if (!emailNormalizado || !senha)
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  try {
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    db.prepare(
      "INSERT INTO usuarios (email, senha, nome) VALUES (?, ?, ?)",
    ).run(emailNormalizado, senhaCriptografada, nomePublico);
    const sessao = criarSessaoUsuario(emailNormalizado, nomePublico);
    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso!",
      email: sessao.email,
      nome: sessao.nome,
      authToken: sessao.token,
    });
  } catch (err) {
    if (err.message.includes("UNIQUE"))
      return res
        .status(409)
        .json({ erro: "E-mail já cadastrado.", campo: "email" });
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const emailNormalizado = normalizarEmailUsuario(email);
  if (!emailNormalizado || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });
  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(emailNormalizado);
  if (!usuario)
    return res
      .status(401)
      .json({ erro: "E-mail não encontrado.", campo: "email" });
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  if (!senhaCorreta)
    return res.status(401).json({ erro: "Senha incorreta.", campo: "senha" });
  const sessao = criarSessaoUsuario(
    usuario.email,
    usuario.nome || usuario.email.split("@")[0],
  );
  res.status(200).json({
    mensagem: "Login realizado com sucesso!",
    email: sessao.email,
    nome: sessao.nome,
    authToken: sessao.token,
  });
});

app.post("/login-google", async (req, res) => {
  const { email, nome } = req.body;
  const emailNormalizado = normalizarEmailUsuario(email);
  const nomePublico = normalizarNomeUsuario(nome, emailNormalizado);
  if (!emailNormalizado) {
    return res.status(400).json({ erro: "E-mail não recebido." });
  }

  const usuarioExistente = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(emailNormalizado);

  if (!usuarioExistente) {
    db.prepare("INSERT INTO usuarios (email, senha, nome) VALUES (?, ?, ?)").run(
      emailNormalizado,
      "google-oauth",
      nomePublico,
    );
  } else if (nomePublico && !usuarioExistente.nome) {
    db.prepare("UPDATE usuarios SET nome = ? WHERE email = ?").run(
      nomePublico,
      emailNormalizado,
    );
  }

  const sessao = criarSessaoUsuario(emailNormalizado, nomePublico);
  res.status(200).json({
    mensagem: "Login com Google realizado!",
    email: sessao.email,
    nome: sessao.nome,
    authToken: sessao.token,
  });
});

app.post("/salvar-configs", (req, res) => {
  const { email, configs } = req.body;
  db.prepare("UPDATE usuarios SET configs = ? WHERE email = ?").run(
    JSON.stringify(configs),
    email,
  );
  res.status(200).json({ mensagem: "Configs salvas!" });
});

app.post("/carregar-configs", (req, res) => {
  const { email } = req.body;
  const usuario = db
    .prepare("SELECT configs FROM usuarios WHERE email = ?")
    .get(email);
  if (!usuario)
    return res.status(404).json({ erro: "Usuário não encontrado." });
  res.status(200).json({ configs: JSON.parse(usuario.configs || "{}") });
});

app.post("/recuperar-senha", async (req, res) => {
  const { email } = req.body;
  const emailNormalizado = normalizarEmailUsuario(email);
  if (!emailNormalizado) {
    return res.status(400).json({ erro: "E-mail é obrigatório." });
  }

  limparTokensRecuperacaoExpirados();

  if (!db.prepare("SELECT * FROM usuarios WHERE email = ?").get(emailNormalizado))
    return res.status(404).json({ erro: "E-mail não encontrado." });

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiraEm = criarExpiracaoTokenRecuperacao();
  db.prepare("DELETE FROM tokens_recuperacao WHERE email = ?").run(
    emailNormalizado,
  );
  db.prepare(
    "INSERT INTO tokens_recuperacao (email, token, expira_em) VALUES (?, ?, ?)",
  ).run(emailNormalizado, token, expiraEm);

  try {
    await transporter.sendMail({
      from: '"VerusAI" <seuemail@gmail.com>',
      to: emailNormalizado,
      subject: "🔐 Código de Recuperação de Senha",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Recuperação de Senha</h2>
        <div style="background:#f1ae2b;color:#000;padding:20px;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:4px;margin:20px 0">${token}</div>
        <p><strong>Este código expira em 5 minutos.</strong></p>
      </div>`,
    });
    res.status(200).json({ mensagem: "Código enviado com sucesso!" });
  } catch (error) {
    db.prepare("DELETE FROM tokens_recuperacao WHERE token = ?").run(token);
    res.status(500).json({ erro: "Erro ao enviar email. Tente novamente." });
  }
});

app.post("/redefinir-senha", async (req, res) => {
  const { token, novaSenha } = req.body;
  const tokenLimpo = String(token || "").trim();
  if (!tokenLimpo || !novaSenha)
    return res
      .status(400)
      .json({ erro: "Token e nova senha são obrigatórios." });

  limparTokensRecuperacaoExpirados();

  const tokenData = db
    .prepare(
      `SELECT * FROM tokens_recuperacao
       WHERE token = ?
         AND usado = 0
         AND julianday(expira_em) > julianday('now')
         AND julianday(criado_em, '+5 minutes') > julianday('now')`,
    )
    .get(tokenLimpo);
  if (!tokenData)
    return res.status(400).json({ erro: "Código inválido ou expirado." });
  try {
    db.prepare("UPDATE usuarios SET senha = ? WHERE email = ?").run(
      await bcrypt.hash(novaSenha, 10),
      tokenData.email,
    );
    db.prepare("DELETE FROM tokens_recuperacao WHERE email = ?").run(
      tokenData.email,
    );
    res.status(200).json({ mensagem: "Senha redefinida com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao redefinir senha." });
  }
});

// ── PIPELINE DE ANÁLISE ──────────────────────────────────────────────────────

const { runPipeline } = require("./services/runPipeline.js");
const {
  responderChatNoticias: responderChatNoticiasAI,
} = require("./services/ai-services/chatNoticias.js");

const analysisJobs = new Map();
const ANALYSIS_JOB_TTL_MS = 30 * 60 * 1000;

function validarPageData(pageData) {
  if (!pageData || typeof pageData !== "object") {
    return "Dados da pagina ausentes.";
  }

  if (!pageData.url) {
    return "URL da pagina e obrigatoria.";
  }

  return "";
}

function prepararAnaliseAutenticada(body) {
  const sessao = obterSessaoUsuario(body?.authToken);
  if (!sessao) {
    return {
      erro: {
        status: 401,
        payload: {
          ok: false,
          erro: "Entre na extensão para iniciar uma análise.",
        },
      },
    };
  }

  const pageData = { ...(body || {}) };
  delete pageData.authToken;
  return { sessao, pageData };
}

function limparJobsAntigos() {
  const agora = Date.now();

  for (const [jobId, job] of analysisJobs.entries()) {
    const finalizadoEm = job.finishedAtMs || job.updatedAtMs || job.startedAtMs;
    if (finalizadoEm && agora - finalizadoEm > ANALYSIS_JOB_TTL_MS) {
      analysisJobs.delete(jobId);
    }
  }
}

function criarJobId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function iniciarAnalysisJob(pageData) {
  limparJobsAntigos();

  const agora = Date.now();
  const job = {
    id: criarJobId(),
    status: "processing",
    startedAt: new Date(agora).toISOString(),
    startedAtMs: agora,
    updatedAt: new Date(agora).toISOString(),
    updatedAtMs: agora,
    finishedAt: null,
    finishedAtMs: null,
    progress: null,
    resultado: null,
    erro: null,
  };

  analysisJobs.set(job.id, job);

  runPipeline(pageData, {
    onProgress: (progress) => {
      const agoraProgresso = Date.now();
      job.progress = {
        ...progress,
        updatedAt: progress.updatedAt || new Date(agoraProgresso).toISOString(),
      };
      job.updatedAt = job.progress.updatedAt;
      job.updatedAtMs = agoraProgresso;
    },
  })
    .then((resultado) => {
      const fim = Date.now();
      try {
        job.publicacao = salvarAnaliseNoCache(resultado, pageData);
      } catch (saveErr) {
        console.error("[cache_analises] erro ao salvar job:", saveErr);
        job.publicacaoErro =
          saveErr.message || "Erro ao salvar analise no banco.";
      }
      job.status = "done";
      job.resultado = resultado;
      job.updatedAt = new Date(fim).toISOString();
      job.updatedAtMs = fim;
      job.finishedAt = job.updatedAt;
      job.finishedAtMs = fim;
    })
    .catch((err) => {
      const fim = Date.now();
      console.error("[/analisar job] erro:", err);
      job.status = "error";
      job.erro = err.message || "Erro interno ao analisar a pagina.";
      job.updatedAt = new Date(fim).toISOString();
      job.updatedAtMs = fim;
      job.finishedAt = job.updatedAt;
      job.finishedAtMs = fim;
    });

  return job;
}

function montarResultadoSidebar(resultado) {
  if (!resultado || typeof resultado !== "object") {
    return resultado;
  }

  const buildFinal = resultado.etapa11_buildFinal || resultado.etapa10_buildFinal;

  if (buildFinal) {
    return {
      ok: resultado.ok,
      etapa: resultado.etapa,
      status: resultado.status,
      etapa10_claimAudit: resultado.etapa10_claimAudit,
      etapa11_buildFinal: buildFinal,
    };
  }

  if (resultado.etapa === "classifyPage") {
    return {
      ok: resultado.ok,
      etapa: resultado.etapa,
      status: resultado.status,
      mensagem: resultado.mensagem,
      tipo: resultado.tipo,
      categoriatextoprincipal: resultado.categoriatextoprincipal,
      motivonaosernoticia: resultado.motivonaosernoticia,
      classificacao: resultado.classificacao,
    };
  }

  return {
    ok: resultado.ok,
    etapa: resultado.etapa,
    status: resultado.status,
    mensagem: resultado.mensagem,
    etapa2_claims: resultado.etapa2_claims
      ? { total: resultado.etapa2_claims.total }
      : undefined,
  };
}

app.post("/analisar/start", (req, res) => {
  const autenticada = prepararAnaliseAutenticada(req.body);
  if (autenticada.erro) {
    return res.status(autenticada.erro.status).json(autenticada.erro.payload);
  }

  const pageData = autenticada.pageData;
  const erroValidacao = validarPageData(pageData);

  if (erroValidacao) {
    return res.status(400).json({
      ok: false,
      erro: erroValidacao,
    });
  }

  const job = iniciarAnalysisJob(pageData);

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    status: job.status,
    startedAt: job.startedAt,
    progress: job.progress,
  });
});

app.get("/analisar/status/:jobId", (req, res) => {
  limparJobsAntigos();

  const job = analysisJobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      ok: false,
      status: "not_found",
      erro: "Analise nao encontrada ou expirada.",
    });
  }

  const payload = {
    ok: job.status !== "error",
    jobId: job.id,
    status: job.status,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
    progress: job.progress,
  };

  if (job.status === "done") payload.resultado = montarResultadoSidebar(job.resultado);
  if (job.status === "done") payload.publicacao = job.publicacao || null;
  if (job.status === "error") payload.erro = job.erro;

  return res.status(200).json(payload);
});

app.post("/analisar", async (req, res) => {
  // Remove o timeout padrão do Express (permite tempo ilimitado)
  req.setTimeout(0);
  res.setTimeout(0);

  try {
    const autenticada = prepararAnaliseAutenticada(req.body);
    if (autenticada.erro) {
      return res.status(autenticada.erro.status).json(autenticada.erro.payload);
    }

    const pageData = autenticada.pageData;
    const erroValidacao = validarPageData(pageData);

    if (erroValidacao) {
      return res.status(400).json({
        ok: false,
        erro: erroValidacao,
      });
    }

    if (!pageData || typeof pageData !== "object") {
      return res.status(400).json({
        ok: false,
        erro: "Dados da página ausentes.",
      });
    }

    if (!pageData.url) {
      return res.status(400).json({
        ok: false,
        erro: "URL da página é obrigatória.",
      });
    }

    const resultado = await runPipeline(pageData);
    try {
      salvarAnaliseNoCache(resultado, pageData);
    } catch (saveErr) {
      console.error("[cache_analises] erro ao salvar /analisar:", saveErr);
    }

    return res.status(200).json(resultado);
  } catch (err) {
    console.error("[/analisar] erro:", err);

    return res.status(500).json({
      ok: false,
      erro: err.message || "Erro interno ao analisar a página.",
    });
  }
});

// ── SITE E API PÚBLICA ────────────────────────────────────────────────────────

app.post("/chat/noticias", async (req, res) => {
  try {
    const pergunta = String(req.body?.pergunta || "").trim();
    const page =
      req.body?.page && typeof req.body.page === "object" ? req.body.page : {};
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!pergunta) {
      return res.status(400).json({
        ok: false,
        erro: "Pergunta obrigatoria.",
      });
    }

    const resposta = await responderChatNoticiasAI({ pergunta });
    let id = null;

    if (email) {
      const insert = db
        .prepare(
          `INSERT INTO chat_historico (email, url, titulo, pergunta, resposta)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(email, page.url || "", page.title || "", pergunta, resposta);
      id = insert.lastInsertRowid;
    }

    return res.json({
      ok: true,
      id,
      resposta,
      escopo: "noticias",
      criado_em: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/chat/noticias] erro:", err);
    return res.status(500).json({
      ok: false,
      erro: err.message || "Erro interno no chat de noticias.",
    });
  }
});

app.get("/chat/historico", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  const limite = Math.max(
    1,
    Math.min(100, parseInt(req.query.limite, 10) || 50),
  );

  if (!email) {
    return res.status(400).json({ ok: false, erro: "E-mail obrigatorio." });
  }

  const historico = db
    .prepare(
      `SELECT id, email, url, titulo, pergunta, resposta, criado_em
       FROM chat_historico
       WHERE email = ?
       ORDER BY criado_em DESC
       LIMIT ?`,
    )
    .all(email, limite);

  res.json({ ok: true, historico });
});

app.delete("/chat/historico", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ ok: false, erro: "E-mail obrigatorio." });
  }

  db.prepare("DELETE FROM chat_historico WHERE email = ?").run(email);
  res.json({ ok: true, mensagem: "Historico removido." });
});

app.use("/assets", express.static(path.join(__dirname, "../../assets")));
app.use("/site", express.static(path.join(__dirname, "../../public")));

app.get("/api/link-preview", async (req, res) => {
  const url = normalizarUrlPreview(req.query.url);

  if (!url) {
    return res.status(400).json({
      ok: false,
      erro: "URL invalida para preview.",
    });
  }

  try {
    const data = await buildPublicLinkPreview(url);
    return res.json({ ok: true, data });
  } catch (err) {
    console.warn("[/api/link-preview] erro:", err.message);
    return res.json({
      ok: false,
      erro: err.message || "Nao foi possivel carregar o preview.",
      data: extractLinkPreviewMeta("", url),
    });
  }
});

app.post("/api/analises/nova-informacao", async (req, res) => {
  const sessao = obterSessaoUsuario(req.body?.authToken);
  const url = String(req.body?.url || "").trim();
  const titulo = String(req.body?.titulo || "").trim().slice(0, 300);
  const mensagem = normalizarNovaInformacao(req.body?.mensagem);
  const destino = emailEmpresaDestino();

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      erro: "Entre na extensão para enviar uma nova informação.",
    });
  }

  if (!url || !normalizarUrlPublica(url)) {
    return res.status(400).json({
      ok: false,
      erro: "URL obrigatória para enviar a informação.",
    });
  }

  if (mensagem.length < 10) {
    return res.status(400).json({
      ok: false,
      erro: "Descreva a nova informação com pelo menos 10 caracteres.",
    });
  }

  if (!destino || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({
      ok: false,
      erro: "E-mail da empresa não configurado no servidor.",
    });
  }

  try {
    const tituloEmail = titulo || url;
    await transporter.sendMail({
      from: `"VerusAI" <${process.env.EMAIL_USER}>`,
      to: destino,
      replyTo: sessao.email,
      subject: `Nova informação sobre notícia - ${tituloEmail.slice(0, 90)}`,
      text:
        `Usuário: ${sessao.nome} <${sessao.email}>\n` +
        `Notícia: ${tituloEmail}\n` +
        `URL: ${url}\n\n` +
        `Nova informação:\n${mensagem}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
          <h2>Nova informação sobre notícia</h2>
          <p><strong>Usuário:</strong> ${escapeHtmlEmail(sessao.nome)} &lt;${escapeHtmlEmail(sessao.email)}&gt;</p>
          <p><strong>Notícia:</strong> ${escapeHtmlEmail(tituloEmail)}</p>
          <p><strong>URL:</strong> <a href="${escapeHtmlEmail(url)}">${escapeHtmlEmail(url)}</a></p>
          <hr/>
          <p style="white-space:pre-wrap">${escapeHtmlEmail(mensagem)}</p>
        </div>
      `,
    });

    res.json({ ok: true, mensagem: "Informação enviada para a empresa." });
  } catch (err) {
    console.error("[/api/analises/nova-informacao] erro:", err);
    res.status(500).json({
      ok: false,
      erro: "Não foi possível enviar a informação agora.",
    });
  }
});

app.get("/api/analises/feedback", (req, res) => {
  const url = String(req.query.url || "").trim();
  const sessao = obterSessaoUsuario(req.query.authToken);
  const usuarioEmail = sessao?.email || "";

  if (!url || !normalizarUrlPublica(url)) {
    return res.status(400).json({
      ok: false,
      erro: "URL obrigatoria para carregar feedback.",
    });
  }

  res.json({
    ok: true,
    resumo: obterResumoFeedback(url),
    usuario: sessao ? { email: sessao.email, nome: sessao.nome } : null,
    feedback: obterFeedbackUsuario(url, usuarioEmail),
    comentarios: obterComentariosFeedback(url, usuarioEmail),
  });
});

app.post("/api/analises/feedback", (req, res) => {
  const url = String(req.body?.url || "").trim();
  const titulo = String(req.body?.titulo || "").trim().slice(0, 300);
  const sessao = obterSessaoUsuario(req.body?.authToken);
  const reacao = normalizarReacaoFeedback(req.body?.reacao);
  const comentario = normalizarComentarioFeedback(req.body?.comentario);

  if (!url || !normalizarUrlPublica(url)) {
    return res.status(400).json({
      ok: false,
      erro: "URL obrigatoria para salvar feedback.",
    });
  }

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      erro: "Entre na extensão para salvar sua opinião.",
    });
  }

  if (!reacao && !comentario) {
    return res.status(400).json({
      ok: false,
      erro: "Escolha like ou dislike, ou escreva uma opiniao.",
    });
  }

  try {
    db.prepare(
      `INSERT INTO noticia_feedback (
         url, titulo, cliente_id, usuario_email, usuario_nome, reacao, comentario, editado
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(url, cliente_id) DO UPDATE SET
         titulo = excluded.titulo,
         usuario_email = excluded.usuario_email,
         usuario_nome = excluded.usuario_nome,
         editado = CASE
           WHEN COALESCE(noticia_feedback.reacao, '') <> COALESCE(excluded.reacao, '')
             OR COALESCE(noticia_feedback.comentario, '') <> COALESCE(excluded.comentario, '')
           THEN 1
           ELSE COALESCE(noticia_feedback.editado, 0)
         END,
         reacao = excluded.reacao,
         comentario = excluded.comentario,
         atualizado_em = strftime('%Y-%m-%d %H:%M:%f', 'now')`,
    ).run(
      url,
      titulo,
      sessao.email,
      sessao.email,
      sessao.nome,
      reacao,
      comentario,
    );

    res.json({
      ok: true,
      resumo: obterResumoFeedback(url),
      usuario: { email: sessao.email, nome: sessao.nome },
      feedback: obterFeedbackUsuario(url, sessao.email),
      comentarios: obterComentariosFeedback(url, sessao.email),
    });
  } catch (err) {
    console.error("[/api/analises/feedback] erro:", err);
    res.status(500).json({
      ok: false,
      erro: "Nao foi possivel salvar a opiniao.",
    });
  }
});

app.get("/api/analises", (req, res) => {
  const { pagina = 1, busca = "", veredicto = "" } = req.query;
  const limite = Math.max(
    1,
    Math.min(500, parseInt(req.query.limite, 10) || 12),
  );
  const offset = (Math.max(1, parseInt(pagina, 10) || 1) - 1) * limite;
  let where = "WHERE 1=1";
  const params = [];
  if (busca) {
    where += " AND (ca.url LIKE ? OR ca.titulo LIKE ?)";
    params.push(`%${busca}%`, `%${busca}%`);
  }
  if (veredicto) {
    where += " AND ca.veredicto = ?";
    params.push(veredicto);
  }
  const total = db
    .prepare(`SELECT COUNT(*) as n FROM cache_analises ca ${where}`)
    .get(...params).n;
  const rows = db
    .prepare(
      `SELECT ca.url, ca.titulo, ca.veredicto, ca.score, ca.fontes_consultadas,
              ca.entidades, ca.resultado, ca.criado_em,
              COALESCE(SUM(CASE WHEN nf.reacao = 'like' THEN 1 ELSE 0 END), 0) AS total_likes,
              COALESCE(SUM(CASE WHEN nf.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS total_dislikes
       FROM cache_analises ca
       LEFT JOIN noticia_feedback nf ON ca.url = nf.url
       ${where}
       GROUP BY ca.url
       ORDER BY ca.criado_em DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limite, offset);
  res.json({
    total,
    paginas: Math.ceil(total / limite),
    analises: rows.map((row) => montarAnalisePublica(row, false)),
  });
});

// ── NOTÍCIAS AO VIVO (RSS Google Notícias) ────────────────────────────────────

const NOTICIAS_AO_VIVO_CACHE_TTL_MS = 3 * 60 * 1000;
const noticiasAoVivoCache = new Map();

// Cada tópico aponta para um ID de seção do Google Notícias (quando estável)
// ou para um termo de busca (mais resiliente — os IDs de seção mudam).
const NOTICIAS_AO_VIVO_TOPICOS = {
  geral: {},
  brasil: { id: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVjBHZ0pGUlNnQVAB" },
  mundo: { id: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVjBHZ0pGUlNnQVAB" },
  saude: { id: "CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVjBLQUFQAQ" },
  economia: { q: "economia" },
  tecnologia: { q: "tecnologia" },
  ciencia: { q: "ciência" },
  esportes: { q: "esportes" },
};

function montarUrlRssNoticias({ topico, busca }) {
  const sufixo = "hl=pt-BR&gl=BR&ceid=BR:pt-419";
  const termo = busca || NOTICIAS_AO_VIVO_TOPICOS[topico]?.q;
  if (termo) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(termo)}&${sufixo}`;
  }
  const id = NOTICIAS_AO_VIVO_TOPICOS[topico]?.id;
  if (id) {
    return `https://news.google.com/rss/topics/${id}?${sufixo}`;
  }
  return `https://news.google.com/rss?${sufixo}`;
}

function extrairTagRss(bloco, tag) {
  const match = bloco.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  if (!match) return "";
  return decodeHtmlEntities(
    match[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parsearRssNoticias(xml) {
  const itens = [];
  const blocos = String(xml || "").match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const bloco of blocos) {
    const tituloBruto = extrairTagRss(bloco, "title");
    const link = extrairTagRss(bloco, "link");
    if (!tituloBruto || !link) continue;

    const sourceMatch = bloco.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const fonte = sourceMatch
      ? decodeHtmlEntities(sourceMatch[1].replace(/<[^>]+>/g, "").trim())
      : "";

    // O Google costuma anexar " - Fonte" ao título; removemos para ficar limpo.
    let titulo = tituloBruto;
    if (fonte && titulo.endsWith(` - ${fonte}`)) {
      titulo = titulo.slice(0, -(fonte.length + 3)).trim();
    }

    const pubDate = extrairTagRss(bloco, "pubDate");
    const data = pubDate ? new Date(pubDate) : null;

    itens.push({
      titulo,
      url: link,
      fonte: fonte || dominioDaUrl(link),
      publicadoEm:
        data && !Number.isNaN(data.getTime()) ? data.toISOString() : "",
    });

    if (itens.length >= 30) break;
  }

  return itens;
}

app.get("/api/noticias-ao-vivo", async (req, res) => {
  const busca = String(req.query.busca || "").trim().slice(0, 120);
  const topico = String(req.query.topico || "geral").trim().toLowerCase();
  const feedUrl = montarUrlRssNoticias({ topico, busca });

  const cacheKey = feedUrl;
  const agora = Date.now();
  const emCache = noticiasAoVivoCache.get(cacheKey);
  if (emCache && agora - emCache.salvoEm < NOTICIAS_AO_VIVO_CACHE_TTL_MS) {
    return res.json({
      noticias: emCache.noticias,
      atualizadoEm: new Date(emCache.salvoEm).toISOString(),
      cache: true,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resposta = await fetch(feedUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)",
      },
    });

    if (!resposta.ok) {
      throw new Error(`RSS respondeu ${resposta.status}`);
    }

    const xml = await resposta.text();
    const noticias = parsearRssNoticias(xml);
    noticiasAoVivoCache.set(cacheKey, { noticias, salvoEm: agora });

    res.json({
      noticias,
      atualizadoEm: new Date(agora).toISOString(),
      cache: false,
    });
  } catch (err) {
    console.warn("[noticias-ao-vivo] falha ao buscar RSS:", err.message);
    if (emCache) {
      return res.json({
        noticias: emCache.noticias,
        atualizadoEm: new Date(emCache.salvoEm).toISOString(),
        cache: true,
        aviso: "Exibindo última versão em cache.",
      });
    }
    res
      .status(502)
      .json({ erro: "Não foi possível carregar as notícias ao vivo." });
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/analises/mais-curtidas", (req, res) => {
  const limite = Math.max(1, Math.min(10, parseInt(req.query.limite, 10) || 1));
  const rows = db
    .prepare(
      `SELECT ca.url, ca.titulo, ca.veredicto, ca.score,
              ca.fontes_consultadas, ca.entidades, ca.resultado, ca.criado_em,
              COALESCE(SUM(CASE WHEN nf.reacao = 'like' THEN 1 ELSE 0 END), 0) AS total_likes
       FROM cache_analises ca
       LEFT JOIN noticia_feedback nf ON ca.url = nf.url
       GROUP BY ca.url
       HAVING total_likes > 0
       ORDER BY total_likes DESC, ca.criado_em DESC
       LIMIT ?`,
    )
    .all(limite);
  res.json({
    analises: rows.map((row) => ({
      ...montarAnalisePublica(row, false),
      total_likes: Number(row.total_likes),
    })),
  });
});

app.get("/api/analises/detalhe", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ erro: "URL obrigatória" });
  const row = db
    .prepare(
      "SELECT url, titulo, veredicto, score, fontes_consultadas, entidades, resultado, criado_em FROM cache_analises WHERE url = ?",
    )
    .get(url);
  if (!row) return res.status(404).json({ erro: "Não encontrada" });
  const analise = montarAnalisePublica(row, true);
  res.json({
    analise,
    resultado: analise.resultado,
    criado_em: row.criado_em,
  });
});

app.delete("/api/analises", (req, res) => {
  const { url, adminKey } = req.body;
  if (adminKey !== process.env.ADMIN_KEY)
    return res.status(403).json({ erro: "Não autorizado" });
  db.prepare("DELETE FROM cache_analises WHERE url = ?").run(url);
  res.json({ mensagem: "Removida" });
});

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () =>
  console.log(
    `Servidor rodando em http://localhost:${PORT} | Site: http://localhost:${PORT}/site`,
  ),
);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Porta ${PORT} ja esta em uso. Feche o outro servidor ou use PORT=${PORT + 1}.`,
    );
  } else {
    console.error("Erro ao iniciar o servidor:", err);
  }
  process.exit(1);
});
