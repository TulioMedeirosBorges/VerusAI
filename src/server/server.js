const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  anexarAvaliacoesDeFontes,
} = require("./services/avaliarFontesNoResultado.js");
const { PRESIDENTES } = require("./data/presidentes.js");
require("dotenv").config();

const app = express();
const db = new Database("verusai.db");
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

db.exec(`CREATE TABLE IF NOT EXISTS fonte_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dominio TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  reacao TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dominio, usuario_email)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS fonte_denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dominio TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  usuario_nome TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dominio, usuario_email)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS comentario_votos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comentario_id INTEGER NOT NULL,
  usuario_email TEXT NOT NULL,
  reacao TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comentario_id, usuario_email)
)`);

// Denúncias de usuários (a partir de um comentário). Uma denúncia por
// (comentário, denunciante); reenviar atualiza o motivo.
db.exec(`CREATE TABLE IF NOT EXISTS usuario_denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comentario_id INTEGER,
  denunciado_email TEXT NOT NULL,
  denunciado_nome TEXT DEFAULT '',
  usuario_email TEXT NOT NULL,
  usuario_nome TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comentario_id, usuario_email)
)`);

// Registro de quem realizou cada análise (uma linha por análise feita),
// para o dashboard mostrar quantos usuários já analisaram e quem são.
db.exec(`CREATE TABLE IF NOT EXISTS analise_autores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  nome TEXT DEFAULT '',
  url TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
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
  db.exec("ALTER TABLE cache_analises ADD COLUMN verificacoes INTEGER DEFAULT 1");
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
    id: row.id ?? null,
    reacao: row.reacao || "",
    comentario: row.comentario || "",
    usuarioNome: normalizarNomeUsuario(row.usuario_nome, email),
    proprioUsuario,
    editado: Boolean(row.editado) || datasDiferentesFeedback(row.criado_em, row.atualizado_em),
    atualizadoEm: row.atualizado_em || row.criado_em || "",
    likes: Number(row.likes || 0),
    dislikes: Number(row.dislikes || 0),
    votoUsuario:
      row.voto_usuario === "like" || row.voto_usuario === "dislike"
        ? row.voto_usuario
        : "",
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
      `SELECT nf.id, nf.cliente_id, nf.usuario_email, nf.usuario_nome, nf.reacao,
              nf.comentario, nf.editado, nf.criado_em, nf.atualizado_em,
              COALESCE(SUM(CASE WHEN cv.reacao = 'like' THEN 1 ELSE 0 END), 0) AS likes,
              COALESCE(SUM(CASE WHEN cv.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes,
              MAX(CASE WHEN cv.usuario_email = ? THEN cv.reacao ELSE NULL END) AS voto_usuario
       FROM noticia_feedback nf
       LEFT JOIN comentario_votos cv ON cv.comentario_id = nf.id
       WHERE nf.url = ?
         AND NULLIF(TRIM(nf.comentario), '') IS NOT NULL
       GROUP BY nf.id
       ORDER BY julianday(nf.atualizado_em) DESC, nf.id DESC
       LIMIT 50`,
    )
    .all(usuarioEmail || "", url);

  // Selos do autor de cada comentário (cacheados por usuário dentro da lista
  // para não recalcular quando alguém comentou em mais de uma análise).
  const selosCache = new Map();
  const selosDoAutor = (emailAutor) => {
    const chave = normalizarEmailUsuario(emailAutor);
    if (!selosCache.has(chave)) selosCache.set(chave, obterSelosUsuario(emailAutor));
    return selosCache.get(chave);
  };

  return rows
    .map((row) => {
      const publico = montarFeedbackPublico(row, usuarioEmail);
      if (publico) {
        publico.selos = selosDoAutor(row.usuario_email || row.cliente_id || "");
      }
      return publico;
    })
    .filter((item) => item?.comentario);
}

function obterVotosComentario(comentarioId) {
  const votos = db
    .prepare(
      `SELECT
         SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes
       FROM comentario_votos WHERE comentario_id = ?`,
    )
    .get(comentarioId);
  return {
    likes: Number(votos?.likes || 0),
    dislikes: Number(votos?.dislikes || 0),
  };
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
    veiculo: buildFinal.veiculo || buildFinal.paginaOrigem || "",
    paginaOrigem: buildFinal.paginaOrigem || buildFinal.veiculo || "",
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
    verificacoes: Number(row.verificacoes || 1),
    total_likes: Number(row.total_likes || 0),
    total_dislikes: Number(row.total_dislikes || 0),
    avisoAtualizacao: buildFinal.avisoAtualizacao || null,
  };

  if (incluirResultado) {
    // Recalcula as avaliações da comunidade ao exibir o detalhe, para o
    // alerta refletir os votos/denúncias mais recentes.
    anexarAvaliacoesDeFontes(buildFinal, obterAvaliacaoFonteDominio);
    analise.resultado = buildFinal;
  }
  return analise;
}

// Plataformas sociais onde o "veiculo" da IA costuma ser genérico
// (ex.: "Instagram"). Nelas, a página de origem real é o perfil/canal que
// publicou a notícia — capturado na extração (pageData.author/channel).
const DOMINIOS_SOCIAIS = new Set([
  "instagram.com",
  "facebook.com",
  "fb.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "threads.net",
  "youtube.com",
  "youtu.be",
]);

function limparNomePagina(valor) {
  // O nome capturado pode vir com quebras de linha, "Verificado", etc.
  return String(valor || "")
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .replace(/^@+/, "")
    .trim()
    .slice(0, 60);
}

// Descobre o nome da página de origem. Em redes sociais usa o perfil/canal
// (ex.: "epocanegocios") em vez do genérico; fora delas confia no veiculo da IA.
function derivarVeiculoOrigem(buildFinal, pageData = {}, url = "") {
  const dominio = dominioDaUrl(url);

  if (DOMINIOS_SOCIAIS.has(dominio)) {
    const perfil = limparNomePagina(
      pageData.author || pageData.channel || pageData.siteName,
    );
    if (perfil) return perfil;
  }

  return (
    limparNomePagina(buildFinal?.veiculo) ||
    limparNomePagina(pageData.siteName) ||
    dominio ||
    ""
  );
}

function salvarAnaliseNoCache(resultado, pageData = {}) {
  const buildFinal = getBuildFinal(resultado);
  if (!buildFinal) return null;

  const url = buildFinal.urlOriginal || resultado?.url || pageData.url || "";
  if (!url) return null;

  const preparado = prepararResultadoComVerificador(buildFinal, url);

  if (preparado.semNovasInformacoes) {
    // Mesma notícia checada de novo (sem fatos novos): ainda conta como uma
    // verificação adicional dessa notícia.
    db.prepare(
      "UPDATE cache_analises SET verificacoes = COALESCE(verificacoes, 1) + 1 WHERE url = ?",
    ).run(preparado.destinoUrl);
    const verificacoes = Number(
      db
        .prepare("SELECT verificacoes FROM cache_analises WHERE url = ?")
        .get(preparado.destinoUrl)?.verificacoes || 1,
    );

    return {
      url: preparado.destinoUrl,
      titulo:
        preparado.buildFinal.tituloFinal ||
        pageData.title ||
        preparado.destinoUrl,
      veredicto: mapVereditoPublico(preparado.buildFinal.vereditoGeral),
      score: toScore(preparado.buildFinal.scoreConfiabilidade),
      verificacoes,
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
  // Nome da página de origem (perfil em redes sociais). Substitui o "veiculo"
  // genérico e é persistido junto do resultado para uso na exibição.
  const paginaOrigem = derivarVeiculoOrigem(
    buildFinalParaSalvar,
    pageData,
    destinoUrl,
  );
  const resultadoFinal = {
    ...buildFinalParaSalvar,
    veiculo: paginaOrigem || buildFinalParaSalvar.veiculo || "",
    paginaOrigem,
    fontesPrincipais: fontesConsultadas,
    entidadesMencionadas: entidades,
    urlOriginal: destinoUrl,
    salvoEm: new Date().toISOString(),
  };

  // Após o buildFinal: verifica se as fontes (sites de notícia) do resultado
  // têm avaliações da comunidade e anexa o alerta a cada uma.
  anexarAvaliacoesDeFontes(resultadoFinal, obterAvaliacaoFonteDominio);

  // Contador de checagens: soma o histórico da URL atual e da URL anterior
  // (quando a análise é mesclada/migrada) e adiciona +1 por esta verificação.
  const lerVerificacoes = (alvo) =>
    Number(
      db
        .prepare("SELECT verificacoes FROM cache_analises WHERE url = ?")
        .get(alvo)?.verificacoes || 0,
    );
  const verificacoes =
    lerVerificacoes(destinoUrl) +
    (preparado.removerUrlAnterior
      ? lerVerificacoes(preparado.removerUrlAnterior)
      : 0) +
    1;

  if (preparado.removerUrlAnterior) {
    db.prepare("DELETE FROM cache_analises WHERE url = ?").run(
      preparado.removerUrlAnterior,
    );
  }

  db.prepare(
    `INSERT INTO cache_analises (url, titulo, veredicto, score, fontes_consultadas, entidades, resultado, verificacoes, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(url) DO UPDATE SET
       titulo = excluded.titulo,
       veredicto = excluded.veredicto,
       score = excluded.score,
       fontes_consultadas = excluded.fontes_consultadas,
       entidades = excluded.entidades,
       resultado = excluded.resultado,
       verificacoes = excluded.verificacoes,
       criado_em = CURRENT_TIMESTAMP`,
  ).run(
    destinoUrl,
    titulo,
    veredicto,
    score,
    JSON.stringify(fontesConsultadas),
    JSON.stringify(entidades),
    JSON.stringify(resultadoFinal),
    verificacoes,
  );

  // Nova análise altera as menções; invalida o índice cacheado da Transparência.
  transpCache.delete("transpMencoes");

  return {
    url: destinoUrl,
    titulo,
    veredicto,
    score,
    verificacoes,
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

// Registra que um usuário realizou uma análise (alimenta o dashboard).
function registrarAutorAnalise(sessao, url) {
  if (!sessao?.email) return;
  try {
    db.prepare(
      "INSERT INTO analise_autores (email, nome, url) VALUES (?, ?, ?)",
    ).run(sessao.email, sessao.nome || "", String(url || "").slice(0, 1000));
  } catch (err) {
    console.warn("[analise_autores] falha ao registrar autor:", err.message);
  }
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

function iniciarAnalysisJob(pageData, sessao = null) {
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
        registrarAutorAnalise(sessao, job.publicacao?.url || pageData.url);
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

  const job = iniciarAnalysisJob(pageData, autenticada.sessao);

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
      const pub = salvarAnaliseNoCache(resultado, pageData);
      registrarAutorAnalise(autenticada.sessao, pub?.url || pageData.url);
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

// ── Open Graph por análise ───────────────────────────────────────────────────
// Quando um link é compartilhado (ex.: /site/?analisar=<url>&run=1), crawlers do
// WhatsApp/X não executam JS — leem só o HTML inicial. Aqui, se a URL já tem uma
// análise no cache, injetamos meta tags OG com título, veredito e score para o
// link virar um card rico. Caso contrário, segue para o index.html estático.
const INDEX_HTML_PATH = path.join(__dirname, "../../public/index.html");
let indexHtmlCache = null;

function lerIndexHtml() {
  if (indexHtmlCache == null) {
    indexHtmlCache = fs.readFileSync(INDEX_HTML_PATH, "utf8");
  }
  return indexHtmlCache;
}

function rotuloVereditoPublico(veredito) {
  if (veredito === "true") return "Verdadeiro";
  if (veredito === "false") return "Falso";
  return "Parcial";
}

function montarMetaTagsOg(analise, urlCompartilhada, base) {
  const titulo = (analise.titulo || "Análise de notícia").trim();
  const rotulo = rotuloVereditoPublico(analise.veredito);
  const score = Number.isFinite(Number(analise.score))
    ? `${Number(analise.score)}/100`
    : "";
  const cabecalho = [
    `Veredito: ${rotulo}`,
    score ? `Confiabilidade ${score}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const resumo = String(analise.resumo || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const descricao = [cabecalho, resumo].filter(Boolean).join(". ");
  const ogTitulo = `${titulo} — VerusAI`;
  const imagem = `${base}/assets/icons/IconVerusAi.png`;

  const e = escapeHtmlEmail;
  return [
    `<title>${e(ogTitulo)}</title>`,
    `<meta name="description" content="${e(descricao)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="VerusAI" />`,
    `<meta property="og:title" content="${e(ogTitulo)}" />`,
    `<meta property="og:description" content="${e(descricao)}" />`,
    `<meta property="og:url" content="${e(urlCompartilhada)}" />`,
    `<meta property="og:image" content="${e(imagem)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(ogTitulo)}" />`,
    `<meta name="twitter:description" content="${e(descricao)}" />`,
    `<meta name="twitter:image" content="${e(imagem)}" />`,
  ].join("\n    ");
}

app.get(["/site", "/site/", "/site/index.html"], async (req, res, next) => {
  let alvo = normalizarUrlPublica(req.query.analisar);
  if (!alvo) return next();

  try {
    let row = db
      .prepare("SELECT * FROM cache_analises WHERE url = ?")
      .get(alvo);

    // Links do "Ao Vivo" chegam como redirecionador do Google Notícias; o cache
    // guarda a URL real do portal, então resolvemos antes de procurar.
    if (!row && ehUrlGoogleNews(alvo)) {
      const resolvido = await resolverUrlGoogleNews(alvo);
      if (resolvido !== alvo) {
        row = db
          .prepare("SELECT * FROM cache_analises WHERE url = ?")
          .get(resolvido);
      }
    }

    if (!row) return next();

    const analise = montarAnalisePublica(row);
    const base = `${req.protocol}://${req.get("host")}`;
    const urlCompartilhada = `${base}${req.originalUrl}`;
    const metas = montarMetaTagsOg(analise, urlCompartilhada, base);

    const html = lerIndexHtml().replace(
      /<title>[\s\S]*?<\/title>/i,
      metas,
    );

    res.set("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    console.warn("[og] falha ao montar preview:", err.message);
    return next();
  }
});

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

// Proxy de HTML para a análise por link no site (evita CORS no navegador).
// O site baixa o HTML por aqui, parseia com DOMParser e monta o pageData.
app.get("/api/fetch-html", async (req, res) => {
  const url = normalizarUrlPreview(req.query.url);

  if (!url) {
    return res.status(400).json({ ok: false, erro: "URL invalida." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const resposta = await fetch(url, {
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

    const contentType = resposta.headers.get("content-type") || "";
    const finalUrl = resposta.url || url;

    if (!contentType.includes("text/html")) {
      return res.status(415).json({
        ok: false,
        erro: "O link nao retornou uma pagina HTML para analise.",
        finalUrl,
      });
    }

    const html = await resposta.text();
    return res.json({ ok: true, url: finalUrl, html: html.slice(0, 3000000) });
  } catch (err) {
    console.warn("[/api/fetch-html] erro:", err.message);
    return res.status(502).json({
      ok: false,
      erro: "Nao foi possivel baixar a pagina deste link.",
    });
  } finally {
    clearTimeout(timeout);
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

app.post("/api/analises/comentario/voto", (req, res) => {
  const sessao = obterSessaoUsuario(req.body?.authToken);
  const comentarioId = Number(req.body?.comentarioId);
  const reacao = normalizarReacaoFeedback(req.body?.reacao);

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      erro: "Entre na extensão para avaliar um comentário.",
    });
  }
  if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
    return res.status(400).json({ ok: false, erro: "Comentário inválido." });
  }
  if (!reacao) {
    return res
      .status(400)
      .json({ ok: false, erro: "Escolha like ou dislike." });
  }

  const comentario = db
    .prepare("SELECT id FROM noticia_feedback WHERE id = ?")
    .get(comentarioId);
  if (!comentario) {
    return res
      .status(404)
      .json({ ok: false, erro: "Comentário não encontrado." });
  }

  try {
    const existente = db
      .prepare(
        "SELECT reacao FROM comentario_votos WHERE comentario_id = ? AND usuario_email = ?",
      )
      .get(comentarioId, sessao.email);

    let votoUsuario = reacao;
    if (existente && existente.reacao === reacao) {
      // Clicar de novo na mesma reação remove o voto (toggle).
      db.prepare(
        "DELETE FROM comentario_votos WHERE comentario_id = ? AND usuario_email = ?",
      ).run(comentarioId, sessao.email);
      votoUsuario = "";
    } else {
      db.prepare(
        `INSERT INTO comentario_votos (comentario_id, usuario_email, reacao)
         VALUES (?, ?, ?)
         ON CONFLICT(comentario_id, usuario_email) DO UPDATE SET
           reacao = excluded.reacao,
           atualizado_em = CURRENT_TIMESTAMP`,
      ).run(comentarioId, sessao.email, reacao);
    }

    res.json({
      ok: true,
      comentarioId,
      votoUsuario,
      ...obterVotosComentario(comentarioId),
    });
  } catch (err) {
    console.error("[/api/analises/comentario/voto] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível avaliar o comentário." });
  }
});

// ── PERFIL: "Minha atividade" (contribuições do usuário) ─────────────────────

// Contas que recebem todos os selos automaticamente (admin/demo), independente
// das contribuições. Para liberar para outra conta, basta adicionar o e-mail.
const EMAILS_TODOS_SELOS = new Set(["tuliobmedeiros@gmail.com"]);

function emailComTodosSelos(email) {
  return EMAILS_TODOS_SELOS.has(normalizarEmailUsuario(email));
}

// Selos/badges com base nos números de contribuição. Cada selo tem uma meta;
// abaixo dela mostramos o progresso, ao atingir fica "conquistado". Com
// `todosConquistados`, todos saem como conquistados (contas de EMAILS_TODOS_SELOS).
function definirBadgesAtividade(resumo, { todosConquistados = false } = {}) {
  const defs = [
    { id: "primeiros_passos", nome: "Primeiros passos", descricao: "Fez sua primeira contribuição.", meta: 1, valor: resumo.totalContribuicoes },
    { id: "primeira_opiniao", nome: "Primeira opinião", descricao: "Escreveu seu primeiro comentário.", meta: 1, valor: resumo.comentarios },
    { id: "comentarista", nome: "Comentarista", descricao: "Escreveu 10 comentários.", meta: 10, valor: resumo.comentarios },
    { id: "voz_ativa", nome: "Voz ativa", descricao: "Escreveu 40 comentários.", meta: 40, valor: resumo.comentarios },
    { id: "comentarista_elite", nome: "Comentarista de elite", descricao: "Escreveu 100 comentários.", meta: 100, valor: resumo.comentarios },
    { id: "curador", nome: "Curador", descricao: "Avaliou 25 notícias.", meta: 25, valor: resumo.reacoesNoticias },
    { id: "curador_dedicado", nome: "Curador dedicado", descricao: "Avaliou 100 notícias.", meta: 100, valor: resumo.reacoesNoticias },
    { id: "avaliador_fontes", nome: "Olho clínico", descricao: "Avaliou 10 fontes.", meta: 10, valor: resumo.reacoesFontes },
    { id: "critico_fontes", nome: "Crítico de fontes", descricao: "Avaliou 40 fontes.", meta: 40, valor: resumo.reacoesFontes },
    { id: "guardiao", nome: "Guardião", descricao: "Denunciou 3 fontes suspeitas.", meta: 3, valor: resumo.denuncias },
    { id: "fiscal", nome: "Fiscal", descricao: "Fez 15 denúncias de fontes.", meta: 15, valor: resumo.denuncias },
    { id: "apoiador", nome: "Apoiador", descricao: "Votou em 5 comentários da comunidade.", meta: 5, valor: resumo.votosComentarios },
    { id: "engajado", nome: "Engajado", descricao: "Votou em 30 comentários.", meta: 30, valor: resumo.votosComentarios },
    { id: "querido", nome: "Voz respeitada", descricao: "Recebeu 25 curtidas em comentários.", meta: 25, valor: resumo.curtidasRecebidas },
    { id: "influente", nome: "Influente", descricao: "Recebeu 75 curtidas em comentários.", meta: 75, valor: resumo.curtidasRecebidas },
    { id: "idolo", nome: "Ídolo da comunidade", descricao: "Recebeu 150 curtidas em comentários.", meta: 150, valor: resumo.curtidasRecebidas },
    { id: "veterano", nome: "Veterano", descricao: "Acumulou 150 contribuições.", meta: 150, valor: resumo.totalContribuicoes },
    { id: "lenda", nome: "Lenda", descricao: "Acumulou 300 contribuições.", meta: 300, valor: resumo.totalContribuicoes },
  ];
  return defs.map((d) => {
    const valor = todosConquistados ? d.meta : Number(d.valor || 0);
    return {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      meta: d.meta,
      progresso: Math.min(valor, d.meta),
      conquistado: valor >= d.meta,
    };
  });
}

// Resumo de contribuições de um usuário (e-mail logado ou cliente_id anônimo).
// Usado na página "Minha atividade" e para derivar os selos exibidos nos
// comentários — assim os dois lugares mostram exatamente os mesmos selos.
function obterResumoContribuicoes(email) {
  const vazio = {
    comentarios: 0,
    reacoesNoticias: 0,
    reacoesFontes: 0,
    denuncias: 0,
    votosComentarios: 0,
    curtidasRecebidas: 0,
    totalContribuicoes: 0,
  };
  if (!email) return vazio;

  const comentarios = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM noticia_feedback
         WHERE (usuario_email = ? OR cliente_id = ?)
           AND NULLIF(TRIM(comentario), '') IS NOT NULL`,
      )
      .get(email, email)?.n || 0,
  );
  const reacoesNoticias = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM noticia_feedback
         WHERE (usuario_email = ? OR cliente_id = ?) AND reacao IN ('like', 'dislike')`,
      )
      .get(email, email)?.n || 0,
  );
  const reacoesFontes = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM fonte_feedback
         WHERE usuario_email = ? AND reacao IN ('like', 'dislike')`,
      )
      .get(email)?.n || 0,
  );
  const denuncias = Number(
    db
      .prepare("SELECT COUNT(*) AS n FROM fonte_denuncias WHERE usuario_email = ?")
      .get(email)?.n || 0,
  );
  const votosComentarios = Number(
    db
      .prepare("SELECT COUNT(*) AS n FROM comentario_votos WHERE usuario_email = ?")
      .get(email)?.n || 0,
  );
  const curtidasRecebidas = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM comentario_votos cv
         JOIN noticia_feedback nf ON nf.id = cv.comentario_id
         WHERE (nf.usuario_email = ? OR nf.cliente_id = ?) AND cv.reacao = 'like'`,
      )
      .get(email, email)?.n || 0,
  );

  const resumo = {
    comentarios,
    reacoesNoticias,
    reacoesFontes,
    denuncias,
    votosComentarios,
    curtidasRecebidas,
  };
  resumo.totalContribuicoes =
    comentarios + reacoesNoticias + reacoesFontes + denuncias + votosComentarios;
  return resumo;
}

// Selos já conquistados por um usuário, ordenados do mais difícil (maior meta)
// para o mais simples — o cliente mostra os primeiros e resume o resto em "+N".
function obterSelosUsuario(email) {
  return definirBadgesAtividade(obterResumoContribuicoes(email), {
    todosConquistados: emailComTodosSelos(email),
  })
    .filter((b) => b.conquistado)
    .sort((a, b) => b.meta - a.meta)
    .map((b) => ({ id: b.id, nome: b.nome }));
}

app.get("/api/usuario/atividade", (req, res) => {
  const sessao = obterSessaoUsuario(req.query.authToken);
  if (!sessao) {
    return res
      .status(401)
      .json({ ok: false, erro: "Entre pela extensão para ver sua atividade." });
  }
  const email = sessao.email;

  try {
    // Comentários em notícias (com título da análise e curtidas recebidas).
    const comentariosRows = db
      .prepare(
        `SELECT nf.url, nf.comentario, nf.reacao, nf.atualizado_em,
                COALESCE(NULLIF(ca.titulo, ''), NULLIF(nf.titulo, ''), nf.url) AS titulo,
                COALESCE(SUM(CASE WHEN cv.reacao = 'like' THEN 1 ELSE 0 END), 0) AS likes,
                COALESCE(SUM(CASE WHEN cv.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes
         FROM noticia_feedback nf
         LEFT JOIN cache_analises ca ON ca.url = nf.url
         LEFT JOIN comentario_votos cv ON cv.comentario_id = nf.id
         WHERE (nf.usuario_email = ? OR nf.cliente_id = ?)
           AND NULLIF(TRIM(nf.comentario), '') IS NOT NULL
         GROUP BY nf.id
         ORDER BY julianday(nf.atualizado_em) DESC
         LIMIT 50`,
      )
      .all(email, email);

    const fontesRows = db
      .prepare(
        `SELECT dominio, reacao, atualizado_em FROM fonte_feedback
         WHERE usuario_email = ? AND reacao IN ('like', 'dislike')
         ORDER BY julianday(atualizado_em) DESC LIMIT 50`,
      )
      .all(email);

    const denunciasRows = db
      .prepare(
        `SELECT dominio, motivo, comentario, criado_em FROM fonte_denuncias
         WHERE usuario_email = ?
         ORDER BY julianday(criado_em) DESC LIMIT 50`,
      )
      .all(email);

    const resumo = obterResumoContribuicoes(email);

    res.json({
      ok: true,
      usuario: { email: sessao.email, nome: sessao.nome },
      resumo,
      badges: definirBadgesAtividade(resumo, {
        todosConquistados: emailComTodosSelos(email),
      }),
      comentarios: comentariosRows.map((r) => ({
        url: r.url,
        titulo: r.titulo,
        comentario: r.comentario,
        reacao: r.reacao || "",
        data: r.atualizado_em,
        likes: Number(r.likes || 0),
        dislikes: Number(r.dislikes || 0),
      })),
      fontesAvaliadas: fontesRows.map((r) => ({
        dominio: r.dominio,
        reacao: r.reacao,
        data: r.atualizado_em,
      })),
      denuncias: denunciasRows.map((r) => ({
        dominio: r.dominio,
        motivo: r.motivo,
        comentario: r.comentario,
        data: r.criado_em,
      })),
    });
  } catch (err) {
    console.error("[/api/usuario/atividade] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível carregar sua atividade." });
  }
});

// Estatísticas de usuários para o Dashboard: total de cadastrados e quem já
// realizou análises (contagem distinta + nomes), público.
app.get("/api/usuarios/estatisticas", (req, res) => {
  try {
    const totalUsuarios = Number(
      db.prepare("SELECT COUNT(*) AS n FROM usuarios").get()?.n || 0,
    );
    const totalAnalises = Number(
      db.prepare("SELECT COUNT(*) AS n FROM cache_analises").get()?.n || 0,
    );

    const rows = db
      .prepare(
        `SELECT aa.email,
                COALESCE(NULLIF(u.nome, ''), '') AS nome_conta,
                MAX(aa.nome) AS nome_analise,
                COUNT(*) AS total,
                MAX(aa.criado_em) AS ultima
         FROM analise_autores aa
         LEFT JOIN usuarios u ON lower(u.email) = lower(aa.email)
         GROUP BY lower(aa.email)
         ORDER BY total DESC, ultima DESC
         LIMIT 100`,
      )
      .all();

    const analistas = rows.map((r) => ({
      nome: normalizarNomeUsuario(r.nome_conta || r.nome_analise, r.email),
      total: Number(r.total || 0),
      ultima: r.ultima || "",
    }));

    res.json({
      ok: true,
      totalUsuarios,
      totalAnalises,
      totalAnalistas: analistas.length,
      analistas,
    });
  } catch (err) {
    console.error("[/api/usuarios/estatisticas] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível carregar as estatísticas." });
  }
});

// ── COMUNIDADE: ranking de engajamento, catálogo de selos e atividade ────────

let _comunidadeCache = null;
let _comunidadeCacheTs = 0;
const COMUNIDADE_CACHE_TTL_MS = 30 * 1000;

// Catálogo estático dos selos (id, nome, descrição, meta), derivado das defs.
function catalogoSelos() {
  return definirBadgesAtividade({
    comentarios: 0,
    reacoesNoticias: 0,
    reacoesFontes: 0,
    denuncias: 0,
    votosComentarios: 0,
    curtidasRecebidas: 0,
    totalContribuicoes: 0,
  }).map((b) => ({ id: b.id, nome: b.nome, descricao: b.descricao, meta: b.meta }));
}

app.get("/api/comunidade", (req, res) => {
  try {
    if (
      _comunidadeCache &&
      Date.now() - _comunidadeCacheTs < COMUNIDADE_CACHE_TTL_MS
    ) {
      return res.json(_comunidadeCache);
    }

    const totalMembros = Number(
      db.prepare("SELECT COUNT(*) AS n FROM usuarios").get()?.n || 0,
    );

    // Ranking: para cada usuário registrado, calcula engajamento e selos.
    const usuarios = db.prepare("SELECT email, nome FROM usuarios").all();
    const ranking = usuarios
      .map((u) => {
        const resumo = obterResumoContribuicoes(u.email);
        const selos = definirBadgesAtividade(resumo, {
          todosConquistados: emailComTodosSelos(u.email),
        })
          .filter((b) => b.conquistado)
          .sort((a, b) => b.meta - a.meta)
          .map((b) => ({ id: b.id, nome: b.nome }));
        return {
          nome: normalizarNomeUsuario(u.nome, u.email),
          selos,
          totalSelos: selos.length,
          // Pontos de engajamento: cada contribuição vale 1; curtida recebida, 2.
          pontos: resumo.totalContribuicoes + resumo.curtidasRecebidas * 2,
          comentarios: resumo.comentarios,
          curtidasRecebidas: resumo.curtidasRecebidas,
        };
      })
      .filter((m) => m.pontos > 0 || m.totalSelos > 0)
      .sort((a, b) => b.pontos - a.pontos || b.totalSelos - a.totalSelos)
      .slice(0, 12);

    // Atividade recente: últimos comentários em qualquer análise.
    const recentes = db
      .prepare(
        `SELECT nf.usuario_email, nf.cliente_id, nf.usuario_nome, nf.comentario,
                nf.atualizado_em, nf.url,
                COALESCE(NULLIF(ca.titulo, ''), NULLIF(nf.titulo, ''), nf.url) AS titulo
         FROM noticia_feedback nf
         LEFT JOIN cache_analises ca ON ca.url = nf.url
         WHERE NULLIF(TRIM(nf.comentario), '') IS NOT NULL
         ORDER BY julianday(nf.atualizado_em) DESC
         LIMIT 8`,
      )
      .all();

    const selosCache = new Map();
    const selosDe = (email) => {
      const chave = normalizarEmailUsuario(email);
      if (!selosCache.has(chave)) selosCache.set(chave, obterSelosUsuario(email));
      return selosCache.get(chave);
    };

    const atividade = recentes.map((r) => {
      const email = r.usuario_email || r.cliente_id || "";
      return {
        nome: normalizarNomeUsuario(r.usuario_nome, email),
        selos: selosDe(email),
        comentario: String(r.comentario || "").slice(0, 240),
        titulo: r.titulo,
        url: r.url,
        data: r.atualizado_em,
      };
    });

    const payload = {
      ok: true,
      totalMembros,
      ranking,
      catalogo: catalogoSelos(),
      atividade,
    };
    _comunidadeCache = payload;
    _comunidadeCacheTs = Date.now();
    res.json(payload);
  } catch (err) {
    console.error("[/api/comunidade] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível carregar a comunidade." });
  }
});

// ── RANKING / DENÚNCIA DE FONTES (veículos) ──────────────────────────────────

const MOTIVOS_DENUNCIA_FONTE = new Set([
  "desinformacao",
  "sensacionalismo",
  "sem_fontes",
  "conteudo_ofensivo",
  "spam",
  "outro",
]);

const MOTIVOS_DENUNCIA_USUARIO = new Set([
  "conteudo_ofensivo",
  "assedio",
  "spam",
  "desinformacao",
  "outro",
]);

// Redes sociais / plataformas que NÃO são sites de notícia — ficam fora do ranking.
const DOMINIOS_NAO_NOTICIA = new Set([
  "instagram.com",
  "facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "kwai.com",
  "whatsapp.com",
  "wa.me",
  "t.me",
  "telegram.org",
  "telegram.me",
  "linkedin.com",
  "reddit.com",
  "pinterest.com",
  "threads.net",
  "snapchat.com",
  "twitch.tv",
  "discord.com",
  "discord.gg",
]);

// Veículos de notícia conhecidos — aparecem no ranking mesmo sem análise.
// A ordem reflete a fama/popularidade (usada como critério de desempate).
// Não há limite: para incluir mais fontes, basta adicioná-las nesta lista.
const FONTES_NOTICIA_CONHECIDAS = [
  // ── Grandes portais nacionais ──
  "g1.globo.com",
  "uol.com.br",
  "folha.uol.com.br",
  "estadao.com.br",
  "cnnbrasil.com.br",
  "r7.com",
  "terra.com.br",
  "metropoles.com",
  "oglobo.globo.com",
  "veja.abril.com.br",
  "band.uol.com.br",
  "ig.com.br",
  "msn.com",
  // ── Economia / negócios ──
  "exame.com",
  "infomoney.com.br",
  "valor.globo.com",
  "moneytimes.com.br",
  "seudinheiro.com",
  "investnews.com.br",
  // ── Jornais e revistas ──
  "gazetadopovo.com.br",
  "correiobraziliense.com.br",
  "jovempan.com.br",
  "istoe.com.br",
  "cartacapital.com.br",
  "poder360.com.br",
  "em.com.br",
  "opovo.com.br",
  "agenciabrasil.ebc.com.br",
  "brasildefato.com.br",
  "revistaforum.com.br",
  "oantagonista.com.br",
  "congressoemfoco.uol.com.br",
  "jb.com.br",
  "diariodopoder.com.br",
  // ── Regionais ──
  "gauchazh.clicrbs.com.br",
  "nsctotal.com.br",
  "diariodonordeste.verdesmares.com.br",
  "otempo.com.br",
  "agazeta.com.br",
  "atribuna.com.br",
  "diariodepernambuco.com.br",
  "jornaldebrasilia.com.br",
  "cbn.globoradio.globo.com",
  // ── Agências de checagem ──
  "aosfatos.org",
  "lupa.uol.com.br",
  "projetocomprova.com.br",
  "e-farsas.com",
  "boatos.org",
  // ── Tecnologia / ciência ──
  "tecmundo.com.br",
  "olhardigital.com.br",
  "canaltech.com.br",
  "tecnoblog.net",
  "tilt.uol.com.br",
  "revistapesquisa.fapesp.br",
  // ── Esportes ──
  "ge.globo.com",
  "lance.com.br",
  "espn.com.br",
  // ── Internacionais ──
  "bbc.com",
  "cnn.com",
  "reuters.com",
  "apnews.com",
  "nytimes.com",
  "theguardian.com",
  "washingtonpost.com",
  "elpais.com",
  "dw.com",
  "france24.com",
  "aljazeera.com",
  "lemonde.fr",
  "ft.com",
  "wsj.com",
  "bloomberg.com",
  "forbes.com",
  "observador.pt",
];

// Índice de fama por domínio (menor = mais famoso).
const FAMA_FONTE = new Map(
  FONTES_NOTICIA_CONHECIDAS.map((dominio, i) => [dominio, i]),
);

function ehDominioNaoNoticia(dominio) {
  if (!dominio) return true;
  if (DOMINIOS_NAO_NOTICIA.has(dominio)) return true;
  // Pega subdomínios também (ex.: m.facebook.com, l.instagram.com).
  return Array.from(DOMINIOS_NAO_NOTICIA).some((bloqueado) =>
    dominio.endsWith(`.${bloqueado}`),
  );
}

function normalizarDominioFonte(value) {
  const texto = String(value || "").trim().toLowerCase();
  if (!texto) return "";
  // Aceita tanto um domínio puro quanto uma URL completa.
  const comoUrl = normalizarUrlPublica(
    /^https?:\/\//i.test(texto) ? texto : `https://${texto}`,
  );
  const dominio = comoUrl ? dominioDaUrl(comoUrl) : "";
  return (dominio || texto.replace(/^www\./, ""))
    .replace(/[^a-z0-9.\-:]/g, "")
    .slice(0, 120);
}

function normalizarMotivoDenuncia(value) {
  const motivo = String(value || "").trim().toLowerCase();
  return MOTIVOS_DENUNCIA_FONTE.has(motivo) ? motivo : "";
}

function normalizarMotivoDenunciaUsuario(value) {
  const motivo = String(value || "").trim().toLowerCase();
  return MOTIVOS_DENUNCIA_USUARIO.has(motivo) ? motivo : "";
}

function obterResumoFonte(dominio) {
  const votos = db
    .prepare(
      `SELECT
         SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes
       FROM fonte_feedback WHERE dominio = ?`,
    )
    .get(dominio);
  const denuncias = db
    .prepare("SELECT COUNT(*) AS total FROM fonte_denuncias WHERE dominio = ?")
    .get(dominio);

  const likes = Number(votos?.likes || 0);
  const dislikes = Number(votos?.dislikes || 0);
  return {
    likes,
    dislikes,
    saldo: likes - dislikes,
    denuncias: Number(denuncias?.total || 0),
  };
}

// Lookup usado pelo avaliarFontesNoResultado: retorna a avaliação da
// comunidade para um domínio, ou null quando o site não tem avaliação.
function obterAvaliacaoFonteDominio(dominio) {
  const normalizado = normalizarDominioFonte(dominio);
  if (!normalizado) return null;
  const resumo = obterResumoFonte(normalizado);
  if (!resumo.likes && !resumo.dislikes && !resumo.denuncias) return null;
  return {
    likes: resumo.likes,
    dislikes: resumo.dislikes,
    denuncias: resumo.denuncias,
  };
}

app.get("/api/fontes", (req, res) => {
  const sessao = obterSessaoUsuario(req.query.authToken);
  const usuarioEmail = sessao?.email || "";

  // 1. Agrega as análises por domínio (veículo de notícia).
  const rows = db
    .prepare("SELECT url, veredicto, score FROM cache_analises")
    .all();
  const mapa = new Map();
  function garantirFonte(dominio) {
    if (!mapa.has(dominio)) {
      mapa.set(dominio, {
        dominio,
        totalAnalises: 0,
        verdadeiras: 0,
        falsas: 0,
        mistas: 0,
        somaScore: 0,
      });
    }
    return mapa.get(dominio);
  }

  rows.forEach((row) => {
    const dominio = dominioDaUrl(row.url);
    if (!dominio || ehDominioNaoNoticia(dominio)) return;
    const fonte = garantirFonte(dominio);
    fonte.totalAnalises += 1;
    if (row.veredicto === "true") fonte.verdadeiras += 1;
    else if (row.veredicto === "false") fonte.falsas += 1;
    else fonte.mistas += 1;
    fonte.somaScore += Number(row.score || 0);
  });

  // Semeia o ranking com veículos de notícia conhecidos (mesmo sem análise).
  FONTES_NOTICIA_CONHECIDAS.forEach((dominio) => {
    if (!ehDominioNaoNoticia(dominio)) garantirFonte(dominio);
  });

  // 2. Likes / dislikes por domínio.
  const votosMapa = new Map();
  db.prepare(
    `SELECT dominio,
       SUM(CASE WHEN reacao = 'like' THEN 1 ELSE 0 END) AS likes,
       SUM(CASE WHEN reacao = 'dislike' THEN 1 ELSE 0 END) AS dislikes
     FROM fonte_feedback GROUP BY dominio`,
  )
    .all()
    .forEach((v) => votosMapa.set(v.dominio, v));

  // 3. Denúncias por domínio.
  const denunciaMapa = new Map();
  db.prepare(
    "SELECT dominio, COUNT(*) AS total FROM fonte_denuncias GROUP BY dominio",
  )
    .all()
    .forEach((d) => denunciaMapa.set(d.dominio, Number(d.total || 0)));

  // 4. Reação do usuário logado (se houver).
  const reacoesUsuario = new Map();
  if (usuarioEmail) {
    db.prepare(
      "SELECT dominio, reacao FROM fonte_feedback WHERE usuario_email = ?",
    )
      .all(usuarioEmail)
      .forEach((m) => reacoesUsuario.set(m.dominio, m.reacao));
  }

  // Inclui domínios que só têm votos/denúncias (sem análise no cache).
  votosMapa.forEach((_, dominio) => {
    if (!ehDominioNaoNoticia(dominio)) garantirFonte(dominio);
  });
  denunciaMapa.forEach((_, dominio) => {
    if (!ehDominioNaoNoticia(dominio)) garantirFonte(dominio);
  });

  const fontes = Array.from(mapa.values()).map((fonte) => {
    const votos = votosMapa.get(fonte.dominio) || {};
    const likes = Number(votos.likes || 0);
    const dislikes = Number(votos.dislikes || 0);
    return {
      dominio: fonte.dominio,
      analisada: fonte.totalAnalises > 0,
      totalAnalises: fonte.totalAnalises,
      verdadeiras: fonte.verdadeiras,
      falsas: fonte.falsas,
      mistas: fonte.mistas,
      mediaScore: fonte.totalAnalises
        ? Math.round(fonte.somaScore / fonte.totalAnalises)
        : 0,
      likes,
      dislikes,
      saldo: likes - dislikes,
      fama: FAMA_FONTE.has(fonte.dominio) ? FAMA_FONTE.get(fonte.dominio) : 999,
      denuncias: Number(denunciaMapa.get(fonte.dominio) || 0),
      reacaoUsuario: reacoesUsuario.get(fonte.dominio) || "",
    };
  });

  // Ranking por saldo de likes/dislikes; sem votos, ordena por fama/popularidade.
  fontes.sort(
    (a, b) =>
      b.saldo - a.saldo ||
      b.likes - a.likes ||
      Number(b.analisada) - Number(a.analisada) ||
      b.totalAnalises - a.totalAnalises ||
      a.fama - b.fama ||
      a.dominio.localeCompare(b.dominio),
  );

  res.json({
    ok: true,
    usuario: sessao ? { email: sessao.email, nome: sessao.nome } : null,
    fontes,
  });
});

// Resumo de UMA fonte (usado pelo selo da extensão ao visitar um site).
app.get("/api/fontes/uma", (req, res) => {
  const sessao = obterSessaoUsuario(req.query.authToken);
  const dominio = normalizarDominioFonte(req.query.dominio);

  if (!dominio || ehDominioNaoNoticia(dominio)) {
    return res.json({ ok: true, noRanking: false, dominio: dominio || "" });
  }

  let totalAnalises = 0;
  db.prepare("SELECT url FROM cache_analises")
    .all()
    .forEach((row) => {
      if (dominioDaUrl(row.url) === dominio) totalAnalises += 1;
    });

  const resumo = obterResumoFonte(dominio);
  const conhecida = FAMA_FONTE.has(dominio);
  const noRanking =
    conhecida ||
    totalAnalises > 0 ||
    resumo.likes > 0 ||
    resumo.dislikes > 0 ||
    resumo.denuncias > 0;

  let reacaoUsuario = "";
  if (sessao) {
    const row = db
      .prepare(
        "SELECT reacao FROM fonte_feedback WHERE dominio = ? AND usuario_email = ?",
      )
      .get(dominio, sessao.email);
    reacaoUsuario = row?.reacao || "";
  }

  res.json({
    ok: true,
    noRanking,
    dominio,
    analisada: totalAnalises > 0,
    totalAnalises,
    likes: resumo.likes,
    dislikes: resumo.dislikes,
    denuncias: resumo.denuncias,
    reacaoUsuario,
    logado: Boolean(sessao),
  });
});

app.post("/api/fontes/voto", (req, res) => {
  const sessao = obterSessaoUsuario(req.body?.authToken);
  const dominio = normalizarDominioFonte(req.body?.dominio);
  const reacao = normalizarReacaoFeedback(req.body?.reacao);

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      erro: "Entre na extensão para avaliar uma fonte.",
    });
  }
  if (!dominio) {
    return res.status(400).json({ ok: false, erro: "Fonte inválida." });
  }
  if (!reacao) {
    return res
      .status(400)
      .json({ ok: false, erro: "Escolha like ou dislike." });
  }

  try {
    const existente = db
      .prepare(
        "SELECT reacao FROM fonte_feedback WHERE dominio = ? AND usuario_email = ?",
      )
      .get(dominio, sessao.email);

    let reacaoUsuario = reacao;
    if (existente && existente.reacao === reacao) {
      // Clicar de novo na mesma reação remove o voto (toggle).
      db.prepare(
        "DELETE FROM fonte_feedback WHERE dominio = ? AND usuario_email = ?",
      ).run(dominio, sessao.email);
      reacaoUsuario = "";
    } else {
      db.prepare(
        `INSERT INTO fonte_feedback (dominio, usuario_email, reacao)
         VALUES (?, ?, ?)
         ON CONFLICT(dominio, usuario_email) DO UPDATE SET
           reacao = excluded.reacao,
           atualizado_em = CURRENT_TIMESTAMP`,
      ).run(dominio, sessao.email, reacao);
    }

    res.json({ ok: true, dominio, reacaoUsuario, ...obterResumoFonte(dominio) });
  } catch (err) {
    console.error("[/api/fontes/voto] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível salvar a avaliação." });
  }
});

app.post("/api/fontes/denuncia", async (req, res) => {
  const sessao = obterSessaoUsuario(req.body?.authToken);
  const dominio = normalizarDominioFonte(req.body?.dominio);
  const motivo = normalizarMotivoDenuncia(req.body?.motivo);
  const comentario = normalizarComentarioFeedback(req.body?.comentario);

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      erro: "Entre na extensão para denunciar uma fonte.",
    });
  }
  if (!dominio) {
    return res.status(400).json({ ok: false, erro: "Fonte inválida." });
  }
  if (!motivo) {
    return res
      .status(400)
      .json({ ok: false, erro: "Selecione um motivo para a denúncia." });
  }

  try {
    db.prepare(
      `INSERT INTO fonte_denuncias (dominio, usuario_email, usuario_nome, motivo, comentario)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(dominio, usuario_email) DO UPDATE SET
         usuario_nome = excluded.usuario_nome,
         motivo = excluded.motivo,
         comentario = excluded.comentario,
         atualizado_em = CURRENT_TIMESTAMP`,
    ).run(dominio, sessao.email, sessao.nome, motivo, comentario);

    // Notifica a empresa por e-mail (best-effort, não bloqueia a denúncia).
    const destino = emailEmpresaDestino();
    if (destino && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter
        .sendMail({
          from: `"VerusAI" <${process.env.EMAIL_USER}>`,
          to: destino,
          replyTo: sessao.email,
          subject: `Denúncia de fonte - ${dominio}`,
          text:
            `Usuário: ${sessao.nome} <${sessao.email}>\n` +
            `Fonte denunciada: ${dominio}\n` +
            `Motivo: ${motivo}\n\n` +
            `Comentário:\n${comentario || "(sem comentário)"}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
              <h2>Denúncia de fonte</h2>
              <p><strong>Usuário:</strong> ${escapeHtmlEmail(sessao.nome)} &lt;${escapeHtmlEmail(sessao.email)}&gt;</p>
              <p><strong>Fonte:</strong> ${escapeHtmlEmail(dominio)}</p>
              <p><strong>Motivo:</strong> ${escapeHtmlEmail(motivo)}</p>
              <hr/>
              <p style="white-space:pre-wrap">${escapeHtmlEmail(comentario || "(sem comentário)")}</p>
            </div>
          `,
        })
        .catch((err) =>
          console.warn("[/api/fontes/denuncia] e-mail ignorado:", err.message),
        );
    }

    res.json({
      ok: true,
      dominio,
      jaDenunciou: true,
      mensagem: "Denúncia registrada. Obrigado por ajudar.",
      ...obterResumoFonte(dominio),
    });
  } catch (err) {
    console.error("[/api/fontes/denuncia] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível registrar a denúncia." });
  }
});

// Denúncia de um usuário a partir de um comentário dele.
app.post("/api/usuarios/denuncia", (req, res) => {
  const sessao = obterSessaoUsuario(req.body?.authToken);
  const comentarioId = Number(req.body?.comentarioId);
  const motivo = normalizarMotivoDenunciaUsuario(req.body?.motivo);
  const comentario = normalizarComentarioFeedback(req.body?.comentario);

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      erro: "Entre na extensão para denunciar um usuário.",
    });
  }
  if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
    return res.status(400).json({ ok: false, erro: "Comentário inválido." });
  }
  if (!motivo) {
    return res
      .status(400)
      .json({ ok: false, erro: "Selecione um motivo para a denúncia." });
  }

  const alvo = db
    .prepare(
      "SELECT usuario_email, cliente_id, usuario_nome FROM noticia_feedback WHERE id = ?",
    )
    .get(comentarioId);
  if (!alvo) {
    return res.status(404).json({ ok: false, erro: "Comentário não encontrado." });
  }

  const denunciadoEmail = alvo.usuario_email || alvo.cliente_id || "";
  const denunciadoNome = normalizarNomeUsuario(alvo.usuario_nome, denunciadoEmail);

  if (
    normalizarEmailUsuario(denunciadoEmail) === normalizarEmailUsuario(sessao.email)
  ) {
    return res
      .status(400)
      .json({ ok: false, erro: "Você não pode denunciar a si mesmo." });
  }

  try {
    db.prepare(
      `INSERT INTO usuario_denuncias
         (comentario_id, denunciado_email, denunciado_nome, usuario_email, usuario_nome, motivo, comentario)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(comentario_id, usuario_email) DO UPDATE SET
         motivo = excluded.motivo,
         comentario = excluded.comentario,
         denunciado_email = excluded.denunciado_email,
         denunciado_nome = excluded.denunciado_nome,
         atualizado_em = CURRENT_TIMESTAMP`,
    ).run(
      comentarioId,
      denunciadoEmail,
      denunciadoNome,
      sessao.email,
      sessao.nome,
      motivo,
      comentario,
    );

    // Notifica a empresa por e-mail (best-effort, não bloqueia a denúncia).
    const destino = emailEmpresaDestino();
    if (destino && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter
        .sendMail({
          from: `"VerusAI" <${process.env.EMAIL_USER}>`,
          to: destino,
          replyTo: sessao.email,
          subject: `Denúncia de usuário - ${denunciadoNome || denunciadoEmail}`,
          text:
            `Denunciante: ${sessao.nome} <${sessao.email}>\n` +
            `Usuário denunciado: ${denunciadoNome} <${denunciadoEmail}>\n` +
            `Comentário #${comentarioId}\n` +
            `Motivo: ${motivo}\n\n` +
            `Detalhes:\n${comentario || "(sem detalhes)"}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
              <h2>Denúncia de usuário</h2>
              <p><strong>Denunciante:</strong> ${escapeHtmlEmail(sessao.nome)} &lt;${escapeHtmlEmail(sessao.email)}&gt;</p>
              <p><strong>Usuário denunciado:</strong> ${escapeHtmlEmail(denunciadoNome)} &lt;${escapeHtmlEmail(denunciadoEmail)}&gt;</p>
              <p><strong>Comentário:</strong> #${comentarioId}</p>
              <p><strong>Motivo:</strong> ${escapeHtmlEmail(motivo)}</p>
              <hr/>
              <p style="white-space:pre-wrap">${escapeHtmlEmail(comentario || "(sem detalhes)")}</p>
            </div>
          `,
        })
        .catch((err) =>
          console.warn("[/api/usuarios/denuncia] e-mail ignorado:", err.message),
        );
    }

    res.json({ ok: true, mensagem: "Denúncia registrada. Obrigado por ajudar." });
  } catch (err) {
    console.error("[/api/usuarios/denuncia] erro:", err);
    res
      .status(500)
      .json({ ok: false, erro: "Não foi possível registrar a denúncia." });
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

// Links do RSS do Google Notícias (news.google.com/rss/articles/...) são
// redirecionadores: não entregam o conteúdo da matéria, só apontam para o
// portal real. A análise precisa da URL do portal, então resolvemos o link
// antes de usá-lo. O Google exige duas etapas: ler a página do artigo para
// extrair assinatura/timestamp e então consultar o endpoint "batchexecute".
const GOOGLE_NEWS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const googleNewsUrlCache = new Map();

function ehUrlGoogleNews(valor) {
  try {
    const url = new URL(String(valor || "").trim());
    if (!/(^|\.)news\.google\.com$/i.test(url.hostname)) return false;
    return /\/(articles|read)\//.test(url.pathname);
  } catch (e) {
    return false;
  }
}

function idArtigoGoogleNews(valor) {
  try {
    const partes = new URL(valor).pathname.split("/");
    const i = partes.findIndex((p) => p === "articles" || p === "read");
    return i >= 0 ? partes[i + 1] || "" : "";
  } catch (e) {
    return "";
  }
}

async function resolverUrlGoogleNews(valor) {
  if (!ehUrlGoogleNews(valor)) return valor;

  const id = idArtigoGoogleNews(valor);
  if (!id) return valor;

  const emCache = googleNewsUrlCache.get(id);
  if (emCache && Date.now() - emCache.salvoEm < GOOGLE_NEWS_CACHE_TTL_MS) {
    return emCache.url;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)",
    };

    const pagina = await fetch(`https://news.google.com/articles/${id}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: { ...headers, Accept: "text/html,*/*;q=0.7" },
    });
    const html = await pagina.text();
    const assinatura = html.match(/data-n-a-sg="([^"]+)"/);
    const timestamp = html.match(/data-n-a-ts="([^"]+)"/);
    if (!assinatura || !timestamp) return valor;

    const articleReq = [
      "Fbv4je",
      JSON.stringify([
        "garturlreq",
        [
          ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null,
            null, null, null, null, 0, 1],
          "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
        ],
        id,
        Number(timestamp[1]),
        assinatura[1],
      ]),
    ];
    const body =
      "f.req=" + encodeURIComponent(JSON.stringify([[articleReq]]));

    const resposta = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      },
    );
    const texto = await resposta.text();
    const match = texto.match(/(https?:\/\/[^"\\]+)/);
    const urlReal = match ? match[1] : "";

    if (urlReal && !ehUrlGoogleNews(urlReal)) {
      googleNewsUrlCache.set(id, { url: urlReal, salvoEm: Date.now() });
      return urlReal;
    }
    return valor;
  } catch (err) {
    console.warn("[google-news] falha ao resolver link:", err.message);
    return valor;
  } finally {
    clearTimeout(timeout);
  }
}

// Resolve um link do Google Notícias para a URL real do portal, usado pelo
// site antes de analisar uma notícia do "Ao Vivo".
app.get("/api/resolver-noticia", async (req, res) => {
  const original = String(req.query.url || "").trim();
  if (!normalizarUrlPublica(original)) {
    return res.status(400).json({ erro: "URL inválida." });
  }

  if (!ehUrlGoogleNews(original)) {
    return res.json({ url: original, resolvido: false });
  }

  const url = await resolverUrlGoogleNews(original);
  res.json({ url, resolvido: url !== original });
});

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

// "Mais checadas da semana": destaque editorial das checagens mais relevantes
// do período — prioriza conteúdo sinalizado (falso/misto), ordenado pelo
// engajamento (curtidas + descurtidas + comentários) e pela data. Se a janela
// recente estiver vazia, amplia para todo o histórico para nunca ficar vazio.
app.get("/api/analises/trending", (req, res) => {
  const limite = Math.max(1, Math.min(12, parseInt(req.query.limite, 10) || 4));
  const dias = Math.max(1, Math.min(90, parseInt(req.query.dias, 10) || 7));

  const buscar = (comJanela) =>
    db
      .prepare(
        `SELECT ca.url, ca.titulo, ca.veredicto, ca.score, ca.verificacoes,
                ca.fontes_consultadas, ca.entidades, ca.resultado, ca.criado_em,
                COALESCE(SUM(CASE WHEN nf.reacao = 'like' THEN 1 ELSE 0 END), 0) AS total_likes,
                COALESCE(SUM(CASE WHEN nf.reacao = 'dislike' THEN 1 ELSE 0 END), 0) AS total_dislikes,
                COALESCE(SUM(CASE WHEN NULLIF(TRIM(nf.comentario), '') IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_comentarios
         FROM cache_analises ca
         LEFT JOIN noticia_feedback nf ON ca.url = nf.url
         WHERE ca.veredicto IN ('false', 'mixed')
           ${comJanela ? "AND julianday(ca.criado_em) >= julianday('now', ?)" : ""}
         GROUP BY ca.url
         ORDER BY (total_likes + total_dislikes + total_comentarios) DESC,
                  CASE ca.veredicto WHEN 'false' THEN 0 ELSE 1 END,
                  ca.criado_em DESC
         LIMIT ?`,
      )
      .all(...(comJanela ? [`-${dias} days`, limite] : [limite]));

  let rows = buscar(true);
  let escopo = "semana";
  if (!rows.length) {
    rows = buscar(false);
    escopo = "geral";
  }

  res.json({
    escopo,
    periodoDias: dias,
    analises: rows.map((row) => ({
      ...montarAnalisePublica(row, false),
      total_likes: Number(row.total_likes),
      total_dislikes: Number(row.total_dislikes),
      total_comentarios: Number(row.total_comentarios),
      interacoes:
        Number(row.total_likes) +
        Number(row.total_dislikes) +
        Number(row.total_comentarios),
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

// Recebe uma lista de URLs (links de uma página) e retorna quais já têm
// análise salva no cache, com veredito e score — usado pela extensão para
// marcar na página os links de notícias já checadas pelo VerusAI.
function normalizarUrlComparavel(value) {
  try {
    const u = new URL(String(value || "").trim());
    if (!/^https?:$/i.test(u.protocol)) return "";
    u.hash = "";
    let s = (
      u.protocol +
      "//" +
      u.hostname.replace(/^www\./i, "") +
      u.pathname +
      u.search
    ).toLowerCase();
    return s.replace(/\/$/, "");
  } catch (e) {
    return "";
  }
}

app.post("/api/analises/por-urls", (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  const pedido = new Set(
    urls.map(normalizarUrlComparavel).filter(Boolean).slice(0, 400),
  );
  if (!pedido.size) return res.json({ ok: true, analises: [] });

  const rows = db
    .prepare("SELECT url, titulo, veredicto, score FROM cache_analises")
    .all();

  const analises = [];
  const vistos = new Set();
  for (const row of rows) {
    const norm = normalizarUrlComparavel(row.url);
    if (!norm || !pedido.has(norm) || vistos.has(norm)) continue;
    vistos.add(norm);
    analises.push({
      url: row.url,
      urlNorm: norm,
      titulo: row.titulo || "",
      veredito: row.veredicto || "",
      score: row.score ?? null,
    });
  }

  res.json({ ok: true, analises });
});

app.delete("/api/analises", (req, res) => {
  const { url, adminKey } = req.body;
  if (adminKey !== process.env.ADMIN_KEY)
    return res.status(403).json({ erro: "Não autorizado" });
  db.prepare("DELETE FROM cache_analises WHERE url = ?").run(url);
  res.json({ mensagem: "Removida" });
});

// ─── Transparência (deputados, senadores, prefeito de Franca-SP) ──────────────
const TRANSP_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const transpCache = new Map();
const TRANSP_UA =
  "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)";

function transpCacheGet(key) {
  const e = transpCache.get(key);
  if (e && Date.now() - e.salvoEm < TRANSP_CACHE_TTL_MS) return e.valor;
  return null;
}
function transpCacheSet(key, valor) {
  transpCache.set(key, { valor, salvoEm: Date.now() });
}
// Quando o dado em cache foi buscado da fonte (ISO). Se não houver entrada
// válida, assume agora (acabou de ser buscado).
function transpCacheSalvoEm(key) {
  const e = transpCache.get(key);
  return new Date(e ? e.salvoEm : Date.now()).toISOString();
}

async function transpFetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": TRANSP_UA },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Franca-SP: o portal municipal (EddyData) exige login/token e id de tenant,
// sem API aberta estável. Usamos o SICONFI (Tesouro Nacional), que publica a
// execução orçamentária de cada município em API pública e sem autenticação.
const FRANCA_IBGE = 3516200;

// Prefeitos de Franca-SP por mandato — dado curado (não há API pública de
// prefeito). Fonte: Wikipédia / TSE. Adicionar a cada nova gestão.
const FRANCA_PREFEITOS = [
  {
    de: 2025, ate: 2028,
    nome: "Alexandre Augusto Ferreira", partido: "MDB", mandato: "2025–2028",
    foto: "/assets/icons/prefeito_franca.jpg",
    fonte: "https://pt.wikipedia.org/wiki/Franca",
  },
  {
    de: 2021, ate: 2024,
    nome: "Alexandre Augusto Ferreira", partido: "MDB", mandato: "2021–2024",
    foto: "/assets/icons/prefeito_franca.jpg",
    fonte: "https://pt.wikipedia.org/wiki/Franca",
  },
  {
    de: 2017, ate: 2020,
    nome: "Gilson de Souza", partido: "DEM", mandato: "2017–2020",
    foto: "/assets/icons/prefeito_franca_gilson.jpg",
    fonte: "https://pt.wikipedia.org/wiki/Gilson_de_Souza_(prefeito)",
  },
];

// Prefeito que governava no ano informado (ou o mais antigo conhecido).
function prefeitoDeFranca(ano) {
  return (
    FRANCA_PREFEITOS.find((p) => ano >= p.de && ano <= p.ate) ||
    FRANCA_PREFEITOS[FRANCA_PREFEITOS.length - 1]
  );
}

// Funções orçamentárias oficiais (Portaria MOG 42/1999), normalizadas. Servem
// para separar a função (nível 1) das subfunções no RREO Anexo 02 do SICONFI.
const FUNCOES_ORCAMENTARIAS = new Set([
  "legislativa", "judiciaria", "essencial a justica", "administracao",
  "defesa nacional", "seguranca publica", "relacoes exteriores",
  "assistencia social", "previdencia social", "saude", "trabalho", "educacao",
  "cultura", "direitos da cidadania", "urbanismo", "habitacao", "saneamento",
  "gestao ambiental", "ciencia e tecnologia", "agricultura",
  "organizacao agraria", "industria", "comercio e servicos", "comunicacoes",
  "energia", "transporte", "desporto e lazer", "encargos especiais",
  "reserva de contingencia",
]);

function normalizaTxt(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const ANO_ATUAL = new Date().getFullYear();

function anoValido(req) {
  const ano = parseInt(req.query.ano, 10);
  if (!Number.isFinite(ano) || ano < 2008 || ano > ANO_ATUAL) return ANO_ATUAL;
  return ano;
}

// Lista de deputados federais (Câmara) — com filtros opcionais uf/partido.
app.get("/api/transparencia/deputados", async (req, res) => {
  const uf = String(req.query.uf || "").trim().toUpperCase().slice(0, 2);
  const partido = String(req.query.partido || "").trim().toUpperCase().slice(0, 20);
  const cacheKey = `dep:${uf}:${partido}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache)
    return res.json({ deputados: emCache, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: true });

  try {
    const base = new URL("https://dadosabertos.camara.leg.br/api/v2/deputados");
    base.searchParams.set("ordem", "ASC");
    base.searchParams.set("ordenarPor", "nome");
    base.searchParams.set("itens", "100");
    if (uf) base.searchParams.set("siglaUf", uf);
    if (partido) base.searchParams.set("siglaPartido", partido);

    let url = base.toString();
    const deputados = [];
    for (let pagina = 0; pagina < 8 && url; pagina++) {
      const data = await transpFetchJson(url);
      (data.dados || []).forEach((d) =>
        deputados.push({
          id: d.id,
          nome: d.nome,
          partido: d.siglaPartido || "",
          uf: d.siglaUf || "",
          foto: d.urlFoto || "",
          email: d.email || "",
        }),
      );
      const next = (data.links || []).find((l) => l.rel === "next");
      url = next ? next.href : null;
    }

    transpCacheSet(cacheKey, deputados);
    res.json({ deputados, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: false });
  } catch (err) {
    console.warn("[transparencia] deputados:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar os deputados." });
  }
});

// Processa as despesas (CEAP) de um deputado num ano, cacheado.
async function despesasDeputadoAno(id, ano) {
  const cacheKey = `depDesp:${id}:${ano}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let url =
    `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas` +
    `?ano=${ano}&itens=100&ordem=DESC&ordenarPor=dataDocumento`;
  const itens = [];
  for (let pagina = 0; pagina < 15 && url; pagina++) {
    const data = await transpFetchJson(url);
    (data.dados || []).forEach((d) => itens.push(d));
    const next = (data.links || []).find((l) => l.rel === "next");
    url = next ? next.href : null;
  }

  let total = 0;
  const porCategoria = {};
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: 0 }));
  const porCatMes = {}; // { mes: { categoria: valor } }
  itens.forEach((d) => {
    const v = Number(d.valorLiquido) || 0;
    total += v;
    const cat = d.tipoDespesa || "Outros";
    porCategoria[cat] = (porCategoria[cat] || 0) + v;
    const m = Number(d.mes);
    if (m >= 1 && m <= 12) {
      porMes[m - 1].valor += v;
      if (!porCatMes[m]) porCatMes[m] = {};
      porCatMes[m][cat] = (porCatMes[m][cat] || 0) + v;
    }
  });
  const categorias = Object.entries(porCategoria)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const categoriasMes = ordenarCategoriasPorMes(porCatMes);
  const recentes = itens.slice(0, 10).map((d) => ({
    data: d.dataDocumento,
    tipo: d.tipoDespesa,
    fornecedor: d.nomeFornecedor,
    valor: Number(d.valorLiquido) || 0,
    url: d.urlDocumento || "",
  }));

  const valor = {
    ano, total, qtde: itens.length, categorias, porMes, categoriasMes, recentes,
    atualizadoEm: new Date().toISOString(),
  };
  transpCacheSet(cacheKey, valor);
  return valor;
}

// Converte { mes: {categoria: valor} } em { mes: [{categoria, valor}] } ordenado.
function ordenarCategoriasPorMes(porCatMes) {
  const out = {};
  Object.keys(porCatMes).forEach((m) => {
    out[m] = Object.entries(porCatMes[m])
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  });
  return out;
}

// Despesas (CEAP) de um deputado por ano.
app.get("/api/transparencia/deputados/:id/despesas", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id))
    return res.status(400).json({ erro: "ID inválido." });
  try {
    res.json(await despesasDeputadoAno(id, anoValido(req)));
  } catch (err) {
    console.warn("[transparencia] despesas deputado:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar as despesas." });
  }
});

// Total de gastos (CEAP) por ano de um deputado — gráfico de todos os anos.
app.get("/api/transparencia/deputados/:id/gastos-anos", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
  const cacheKey = `depGastosAnos:${id}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const anosAlvo = [];
    for (let a = 2019; a <= ANO_ATUAL; a++) anosAlvo.push(a);
    const resultados = await Promise.all(
      anosAlvo.map((a) => despesasDeputadoAno(id, a).catch(() => null)),
    );
    const anos = resultados
      .filter((r) => r && r.total > 0)
      .map((r) => ({ ano: r.ano, total: r.total }));
    const valor = { anos, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] gastos-anos deputado:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar o histórico de gastos." });
  }
});

// Lista de senadores em exercício (Senado).
app.get("/api/transparencia/senadores", async (req, res) => {
  const uf = String(req.query.uf || "").trim().toUpperCase().slice(0, 2);
  const cacheKey = `sen:${uf}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache)
    return res.json({ senadores: emCache, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: true });

  try {
    const data = await transpFetchJson(
      "https://legis.senado.leg.br/dadosabertos/senador/lista/atual",
    );
    const lista =
      data?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
    let senadores = lista.map((p) => {
      const i = p.IdentificacaoParlamentar || {};
      return {
        codigo: i.CodigoParlamentar || "",
        nome: i.NomeParlamentar || "",
        nomeCompleto: i.NomeCompletoParlamentar || "",
        partido: i.SiglaPartidoParlamentar || "",
        uf: i.UfParlamentar || "",
        foto: i.UrlFotoParlamentar || "",
        email: i.EmailParlamentar || "",
        pagina: i.UrlPaginaParlamentar || "",
      };
    });
    if (uf) senadores = senadores.filter((s) => s.uf === uf);
    senadores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    transpCacheSet(cacheKey, senadores);
    res.json({ senadores, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: false });
  } catch (err) {
    console.warn("[transparencia] senadores:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar os senadores." });
  }
});

// Carrega e indexa o arquivo anual de CEAPS do Senado por código de senador.
// O endpoint retorna todas as despesas do ano; cacheamos o índice 30 min para
// não rebaixar o serviço a cada consulta individual.
async function carregarCeapsAno(ano) {
  const cacheKey = `senCeapsAno:${ano}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let lista;
  try {
    const r = await fetch(
      `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/${ano}`,
      {
        redirect: "follow",
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": TRANSP_UA },
      },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    lista = await r.json();
  } finally {
    clearTimeout(timeout);
  }

  const porSenador = new Map();
  (Array.isArray(lista) ? lista : []).forEach((d) => {
    const cod = String(d.codSenador || "");
    if (!cod) return;
    if (!porSenador.has(cod)) porSenador.set(cod, []);
    porSenador.get(cod).push(d);
  });
  transpCacheSet(cacheKey, porSenador);
  return porSenador;
}

// Processa as despesas (CEAPS) de um senador num ano (a partir do índice anual).
async function despesasSenadorAno(codigo, ano) {
  const porSenador = await carregarCeapsAno(ano);
  const itens = porSenador.get(codigo) || [];

  let total = 0;
  const porCategoria = {};
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: 0 }));
  const porCatMes = {}; // { mes: { categoria: valor } }
  itens.forEach((d) => {
    const v = Number(d.valorReembolsado) || 0;
    total += v;
    const cat = d.tipoDespesa || d.tipoDocumento || "Outros";
    porCategoria[cat] = (porCategoria[cat] || 0) + v;
    const m = Number(d.mes);
    if (m >= 1 && m <= 12) {
      porMes[m - 1].valor += v;
      if (!porCatMes[m]) porCatMes[m] = {};
      porCatMes[m][cat] = (porCatMes[m][cat] || 0) + v;
    }
  });
  const categorias = Object.entries(porCategoria)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const categoriasMes = ordenarCategoriasPorMes(porCatMes);
  const recentes = [...itens]
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))
    .slice(0, 10)
    .map((d) => ({
      data: d.data,
      tipo: d.tipoDespesa || d.tipoDocumento || "Outros",
      fornecedor: d.fornecedor || d.cpfCnpj || "",
      valor: Number(d.valorReembolsado) || 0,
      url: "",
    }));

  return {
    ano, total, qtde: itens.length, categorias, porMes, categoriasMes, recentes,
    atualizadoEm: transpCacheSalvoEm(`senCeapsAno:${ano}`),
  };
}

// Despesas (CEAPS) de um senador por ano.
// Fonte: Dados Abertos da Administração do Senado Federal.
app.get("/api/transparencia/senadores/:codigo/despesas", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim();
  if (!codigo) return res.status(400).json({ erro: "Código inválido." });

  try {
    res.json(await despesasSenadorAno(codigo, anoValido(req)));
  } catch (err) {
    console.warn("[transparencia] despesas senador:", err.message);
    res
      .status(502)
      .json({ erro: "Não foi possível carregar as despesas do senador." });
  }
});

// Total de gastos (CEAPS) por ano de um senador — gráfico de todos os anos.
app.get("/api/transparencia/senadores/:codigo/gastos-anos", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim();
  if (!codigo) return res.status(400).json({ erro: "Código inválido." });
  const cacheKey = `senGastosAnos:${codigo}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const anosAlvo = [];
    for (let a = 2019; a <= ANO_ATUAL; a++) anosAlvo.push(a);
    const resultados = await Promise.all(
      anosAlvo.map((a) => despesasSenadorAno(codigo, a).catch(() => null)),
    );
    const anos = resultados
      .filter((r) => r && r.total > 0)
      .map((r) => ({ ano: r.ano, total: r.total }));
    const valor = { anos, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] gastos-anos senador:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar o histórico de gastos." });
  }
});

// ─── Perfil completo de parlamentares ────────────────────────────────────────
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";
const SENADO_API = "https://legis.senado.leg.br/dadosabertos";
// Subsídio mensal bruto de deputados e senadores — valor fixo e igual para
// todos (não há API "por pessoa"); exibido apenas como referência.
const SUBSIDIO_PARLAMENTAR = 46366.19;
// No Senado o JSON encapsula listas como objeto único quando há só 1 item.
const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const semFalha = (p) => p.catch(() => ({}));

// Perfil (dados pessoais, contato, comissões, frentes, profissões) — Câmara.
app.get("/api/transparencia/deputados/:id/perfil", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
  const cacheKey = `depPerfil:${id}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const [det, orgaosR, frentesR, profR, ocupR] = await Promise.all([
      transpFetchJson(`${CAMARA_API}/deputados/${id}`),
      semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/orgaos?ordem=DESC&ordenarPor=dataInicio&itens=100`)),
      semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/frentes`)),
      semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/profissoes`)),
      semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/ocupacoes`)),
    ]);
    const d = det.dados || {};
    const st = d.ultimoStatus || {};
    const orgaos = orgaosR.dados || [];
    const perfil = {
      id,
      casa: "deputado",
      nome: st.nome || d.nomeCivil || "",
      nomeCivil: d.nomeCivil || "",
      foto: st.urlFoto || "",
      partido: st.siglaPartido || "",
      uf: st.siglaUf || "",
      situacao: st.situacao || "",
      condicao: st.condicaoEleitoral || "",
      email: (st.gabinete && st.gabinete.email) || st.email || "",
      telefone: (st.gabinete && st.gabinete.telefone) || "",
      gabinete: st.gabinete || {},
      site: d.urlWebsite || "",
      redes: d.redeSocial || [],
      sexo: d.sexo || "",
      nascimento: d.dataNascimento || "",
      falecimento: d.dataFalecimento || "",
      naturalidade: [d.municipioNascimento, d.ufNascimento].filter(Boolean).join(" - "),
      escolaridade: d.escolaridade || "",
      cpf: d.cpf || "",
      subsidio: SUBSIDIO_PARLAMENTAR,
      comissoes: orgaos
        .filter((o) => !o.dataFim)
        .map((o) => ({ sigla: o.siglaOrgao, nome: o.nomeOrgao, cargo: o.titulo, inicio: o.dataInicio })),
      qtdeComissoesHist: orgaos.length,
      frentes: (frentesR.dados || []).map((f) => f.titulo).filter(Boolean),
      profissoes: (profR.dados || []).map((p) => p.titulo).filter(Boolean),
      ocupacoes: (ocupR.dados || []).map((o) => ({
        titulo: o.titulo || "",
        entidade: o.entidade || "",
        inicio: o.anoInicio || "",
        fim: o.anoFim || "",
      })),
      atualizadoEm: new Date().toISOString(),
    };
    transpCacheSet(cacheKey, perfil);
    res.json({ ...perfil, cache: false });
  } catch (err) {
    console.warn("[transparencia] perfil deputado:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar o perfil do deputado." });
  }
});

// Produção legislativa: proposições de autoria + discursos recentes — Câmara.
app.get("/api/transparencia/deputados/:id/producao", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
  const cacheKey = `depProd:${id}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const [propsR, discR] = await Promise.all([
      semFalha(transpFetchJson(`${CAMARA_API}/proposicoes?idDeputadoAutor=${id}&ordem=DESC&ordenarPor=id&itens=25`)),
      semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/discursos?ordem=DESC&ordenarPor=dataHoraInicio&itens=15`)),
    ]);
    const proposicoes = (propsR.dados || []).map((p) => ({
      sigla: `${p.siglaTipo} ${p.numero}/${p.ano}`,
      ementa: p.ementa || "",
    }));
    const discursos = (discR.dados || []).map((s) => ({
      data: s.dataHoraInicio || "",
      tipo: s.tipoDiscurso || "",
      sumario: s.sumario || (s.transcricao ? String(s.transcricao).slice(0, 240) : ""),
      video: s.urlVideo || "",
      texto: s.urlTexto || "",
    }));
    const valor = { proposicoes, discursos, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] producao deputado:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar a produção do deputado." });
  }
});

// Agenda / eventos recentes — Câmara.
app.get("/api/transparencia/deputados/:id/agenda", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
  const cacheKey = `depAgenda:${id}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const r = await semFalha(
      transpFetchJson(`${CAMARA_API}/deputados/${id}/eventos?ordem=DESC&ordenarPor=dataHoraInicio&itens=20`),
    );
    const eventos = (r.dados || []).map((e) => ({
      data: e.dataHoraInicio || "",
      fim: e.dataHoraFim || "",
      tipo: e.descricaoTipo || "",
      descricao: e.descricao || "",
      situacao: e.situacao || "",
      local: (e.localCamara && e.localCamara.nome) || e.localExterno || "",
    }));
    const valor = { eventos, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] agenda deputado:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar a agenda do deputado." });
  }
});

// Perfil (dados, contato, comissões, mandato, cargos, auxílio-moradia) — Senado.
app.get("/api/transparencia/senadores/:codigo/perfil", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim();
  if (!codigo) return res.status(400).json({ erro: "Código inválido." });
  const cacheKey = `senPerfil:${codigo}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const [detR, comR, mandR, cargoR] = await Promise.all([
      transpFetchJson(`${SENADO_API}/senador/${codigo}`),
      semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/comissoes`)),
      semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/mandatos`)),
      semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/cargos`)),
    ]);
    const p = (detR.DetalheParlamentar && detR.DetalheParlamentar.Parlamentar) || {};
    const ident = p.IdentificacaoParlamentar || {};
    const basicos = p.DadosBasicosParlamentar || {};
    const telefones = asArray(p.Telefones && p.Telefones.Telefone)
      .map((t) => t.NumeroTelefone)
      .filter(Boolean);

    const comRaiz =
      comR.MembroComissaoParlamentar &&
      comR.MembroComissaoParlamentar.Parlamentar &&
      comR.MembroComissaoParlamentar.Parlamentar.MembroComissoes;
    const comissoes = asArray(comRaiz && comRaiz.Comissao)
      .filter((c) => !c.DataFim)
      .map((c) => ({
        sigla: (c.IdentificacaoComissao && c.IdentificacaoComissao.SiglaComissao) || "",
        nome: (c.IdentificacaoComissao && c.IdentificacaoComissao.NomeComissao) || "",
        cargo: c.DescricaoParticipacao || "",
        inicio: c.DataInicio || "",
      }));

    const mandRaiz =
      mandR.MandatoParlamentar &&
      mandR.MandatoParlamentar.Parlamentar &&
      mandR.MandatoParlamentar.Parlamentar.Mandatos;
    const mandatos = asArray(mandRaiz && mandRaiz.Mandato).map((m) => {
      const legs = [m.PrimeiraLegislaturaDoMandato, m.SegundaLegislaturaDoMandato]
        .filter(Boolean)
        .map((l) => `${(l.DataInicio || "").slice(0, 4)}–${(l.DataFim || "").slice(0, 4)}`);
      return { uf: m.UfParlamentar || "", participacao: m.DescricaoParticipacao || "", periodo: legs.join(" / ") };
    });

    const cargoRaiz =
      cargoR.CargoParlamentar &&
      cargoR.CargoParlamentar.Parlamentar &&
      cargoR.CargoParlamentar.Parlamentar.Cargos;
    const cargos = asArray(cargoRaiz && cargoRaiz.Cargo)
      .filter((c) => !c.DataFim)
      .map((c) => ({
        cargo: c.DescricaoCargo || "",
        orgao: (c.IdentificacaoComissao && c.IdentificacaoComissao.NomeComissao) || "",
      }));

    const auxilio = await auxilioMoradiaSenador(ident.NomeParlamentar || "");

    const perfil = {
      codigo,
      casa: "senador",
      nome: ident.NomeParlamentar || "",
      nomeCivil: ident.NomeCompletoParlamentar || "",
      foto: ident.UrlFotoParlamentar || "",
      partido: ident.SiglaPartidoParlamentar || "",
      uf: ident.UfParlamentar || "",
      email: ident.EmailParlamentar || "",
      site: ident.UrlPaginaParlamentar || "",
      sexo: ident.SexoParlamentar || "",
      telefones,
      nascimento: basicos.DataNascimento || "",
      naturalidade: [basicos.Naturalidade, basicos.UfNaturalidade].filter(Boolean).join(" - "),
      endereco: basicos.EnderecoParlamentar || "",
      subsidio: SUBSIDIO_PARLAMENTAR,
      comissoes,
      mandatos,
      cargos,
      auxilioMoradia: auxilio,
      atualizadoEm: new Date().toISOString(),
    };
    transpCacheSet(cacheKey, perfil);
    res.json({ ...perfil, cache: false });
  } catch (err) {
    console.warn("[transparencia] perfil senador:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar o perfil do senador." });
  }
});

// Produção (autorias + discursos) — Senado.
app.get("/api/transparencia/senadores/:codigo/producao", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim();
  if (!codigo) return res.status(400).json({ erro: "Código inválido." });
  const cacheKey = `senProd:${codigo}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const [autR, discR] = await Promise.all([
      semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/autorias`)),
      semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/discursos`)),
    ]);
    const autRaiz =
      autR.MateriasAutoriaParlamentar &&
      autR.MateriasAutoriaParlamentar.Parlamentar &&
      autR.MateriasAutoriaParlamentar.Parlamentar.Autorias;
    const proposicoes = asArray(autRaiz && autRaiz.Autoria)
      .map((a) => ({
        sigla: (a.Materia && a.Materia.DescricaoIdentificacao) || "",
        ementa: (a.Materia && a.Materia.Ementa) || "",
        data: (a.Materia && a.Materia.Data) || "",
        principal: a.IndicadorAutorPrincipal === "Sim",
      }))
      .sort((x, y) => String(y.data).localeCompare(String(x.data)))
      .slice(0, 25);

    const discRaiz =
      discR.DiscursosParlamentar &&
      discR.DiscursosParlamentar.Parlamentar &&
      discR.DiscursosParlamentar.Parlamentar.Pronunciamentos;
    const discursos = asArray(discRaiz && discRaiz.Pronunciamento)
      .map((s) => ({
        data: s.DataPronunciamento || "",
        tipo: (s.TipoUsoPalavra && s.TipoUsoPalavra.Descricao) || "",
        sumario: s.TextoResumo || "",
        texto: s.UrlTexto || "",
      }))
      .slice(0, 15);

    const valor = { proposicoes, discursos, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] producao senador:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar a produção do senador." });
  }
});

// Votações nominais recentes — Senado.
app.get("/api/transparencia/senadores/:codigo/votacoes", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim();
  if (!codigo) return res.status(400).json({ erro: "Código inválido." });
  const cacheKey = `senVot:${codigo}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const r = await semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/votacoes`));
    const raiz =
      r.VotacaoParlamentar &&
      r.VotacaoParlamentar.Parlamentar &&
      r.VotacaoParlamentar.Parlamentar.Votacoes;
    const votacoes = asArray(raiz && raiz.Votacao)
      .map((v) => ({
        data: (v.SessaoPlenaria && v.SessaoPlenaria.DataSessao) || "",
        materia: (v.Materia && v.Materia.DescricaoIdentificacao) || "",
        ementa: (v.Materia && v.Materia.Ementa) || "",
        voto: v.DescricaoVoto || v.SiglaDescricaoVoto || "",
      }))
      .sort((x, y) => String(y.data).localeCompare(String(x.data)))
      .slice(0, 25);
    const valor = { votacoes, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] votacoes senador:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar as votações do senador." });
  }
});

// Auxílio-moradia/imóvel funcional de um senador (Dados Abertos da Adm. do
// Senado). A lista é por nome; cacheamos e casamos pelo nome normalizado.
async function auxilioMoradiaSenador(nome) {
  if (!nome) return null;
  try {
    const cacheKey = "senAuxilioMoradia";
    let lista = transpCacheGet(cacheKey);
    if (!lista) {
      lista = await transpFetchJson(
        "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/auxilio-moradia",
      );
      lista = Array.isArray(lista) ? lista : [];
      transpCacheSet(cacheKey, lista);
    }
    const alvo = normalizaTxt(nome);
    const item = lista.find((x) => normalizaTxt(x.nomeParlamentar) === alvo);
    if (!item) return null;
    return {
      auxilioMoradia: Boolean(item.auxilioMoradia),
      imovelFuncional: Boolean(item.imovelFuncional),
    };
  } catch {
    return null;
  }
}

// Busca o RREO Anexo 02 (despesa por função) de Franca no SICONFI, tentando
// do 6º ao 1º bimestre — retorna o primeiro período com dados publicados.
async function buscarDespesaFrancaAno(ano) {
  for (let periodo = 6; periodo >= 1; periodo--) {
    const url =
      "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo" +
      `?an_exercicio=${ano}&nr_periodo=${periodo}` +
      "&co_tipo_demonstrativo=RREO" +
      `&no_anexo=${encodeURIComponent("RREO-Anexo 02")}&id_ente=${FRANCA_IBGE}`;
    const data = await transpFetchJson(url);
    const itens = data?.items || [];
    if (itens.length) return { itens, periodo, url };
  }
  return null;
}

// Processa a execução orçamentária da Franca para um ano (com recuo de ano se
// o exercício pedido ainda não foi publicado). Cacheado por ano pedido.
async function montarFrancaAno(anoPedido) {
  const cacheKey = `franca:${anoPedido}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let ano = anoPedido;
  let resultado = await buscarDespesaFrancaAno(ano);
  for (let tent = 0; !resultado && tent < 3; tent++) {
    ano -= 1;
    resultado = await buscarDespesaFrancaAno(ano);
  }
  if (!resultado) {
    return {
      disponivel: false,
      motivo: "O SICONFI ainda não publicou a execução orçamentária deste período.",
    };
  }

  const { itens, periodo, url } = resultado;
  // Despesa liquidada (efetivamente realizada) até o bimestre, exceto intra.
  const liquidadas = itens.filter(
    (x) =>
      normalizaTxt(x.rotulo).startsWith("total das despesas exceto") &&
      normalizaTxt(x.coluna).startsWith("despesas liquidadas at"),
  );

  let total = 0;
  const funcoes = [];
  liquidadas.forEach((x) => {
    const nome = normalizaTxt(x.conta);
    if (nome.startsWith("despesas (exceto")) {
      total = Number(x.valor) || 0;
    } else if (FUNCOES_ORCAMENTARIAS.has(nome)) {
      const valor = Number(x.valor) || 0;
      if (valor > 0) funcoes.push({ funcao: x.conta, valor });
    }
  });
  funcoes.sort((a, b) => b.valor - a.valor);

  const meta = itens[0] || {};
  const valor = {
    disponivel: true,
    ano,
    periodo,
    instituicao: meta.instituicao || "Prefeitura Municipal de Franca - SP",
    populacao: meta.populacao || null,
    total,
    funcoes,
    prefeito: prefeitoDeFranca(ano),
    fonte: url,
    fonteLabel: "SICONFI · Tesouro Nacional (RREO — Anexo 02)",
    atualizadoEm: new Date().toISOString(),
  };
  transpCacheSet(cacheKey, valor);
  return valor;
}

// Gastos da Prefeitura de Franca-SP (despesa liquidada por função) de um ano.
app.get("/api/transparencia/franca", async (req, res) => {
  try {
    res.json(await montarFrancaAno(anoValido(req)));
  } catch (err) {
    console.warn("[transparencia] franca:", err.message);
    res
      .status(502)
      .json({ erro: "Não foi possível carregar os dados de Franca-SP." });
  }
});

// Total liquidado por ano (todos os anos com dados) — gráfico histórico.
app.get("/api/transparencia/franca/historico", async (req, res) => {
  const cacheKey = "francaHist";
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return res.json({ ...emCache, cache: true });

  try {
    const anos = [];
    for (let a = 2019; a <= ANO_ATUAL; a++) {
      const d = await montarFrancaAno(a);
      // só inclui anos que têm dados próprios (evita duplicar via recuo de ano)
      if (d && d.disponivel && d.ano === a) anos.push({ ano: a, total: d.total });
    }
    const valor = { anos, atualizadoEm: new Date().toISOString() };
    transpCacheSet(cacheKey, valor);
    res.json({ ...valor, cache: false });
  } catch (err) {
    console.warn("[transparencia] franca historico:", err.message);
    res
      .status(502)
      .json({ erro: "Não foi possível carregar o histórico de Franca-SP." });
  }
});

// ─── Presidentes, ex-presidentes e vices ─────────────────────────────────────
// O esqueleto vem de PRESIDENTES (curado); tenta-se enriquecer cada nome com
// foto/biografia via API REST do Wikipédia (pt). Quando a API não traz dado,
// `temDadosApi=false` e o front-end exibe o selo "Sem dados de API".

// Executa `fn` sobre os itens com no máximo `limite` chamadas simultâneas,
// preservando a ordem dos resultados.
async function mapComLimite(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function worker() {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i], i);
    }
  }
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) || 0 },
    worker,
  );
  await Promise.all(trabalhadores);
  return resultados;
}

// Busca foto + resumo de uma pessoa na API REST do Wikipédia (pt), com cache.
// Retorna sempre um objeto; em caso de falha/404/desambiguação, temDadosApi=false.
async function enriquecerPessoaWiki(wiki) {
  const vazio = { foto: "", bio: "", url: "", temDadosApi: false };
  if (!wiki) return vazio;
  const cacheKey = `presWiki:${wiki}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let resultado = vazio;
  try {
    const data = await transpFetchJson(
      `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wiki)}`,
    );
    if (data && data.type !== "disambiguation") {
      const foto = (data.thumbnail && data.thumbnail.source) || "";
      const bio = data.extract || "";
      resultado = {
        foto,
        bio,
        url:
          (data.content_urls &&
            data.content_urls.desktop &&
            data.content_urls.desktop.page) ||
          "",
        temDadosApi: Boolean(foto || bio),
      };
    }
  } catch (err) {
    // Sem dado na API — mantém o objeto vazio (o front-end mostra o selo).
  }
  transpCacheSet(cacheKey, resultado);
  return resultado;
}

// Lista (timeline) de todos os presidentes, com foto e flag de dados de API.
app.get("/api/transparencia/presidentes", async (req, res) => {
  const cacheKey = "presLista";
  const emCache = transpCacheGet(cacheKey);
  if (emCache)
    return res.json({
      presidentes: emCache,
      atualizadoEm: transpCacheSalvoEm(cacheKey),
      cache: true,
    });

  try {
    const presidentes = await mapComLimite(PRESIDENTES, 8, async (p) => {
      const en = await enriquecerPessoaWiki(p.wiki);
      return {
        id: p.id,
        ordem: p.ordem,
        nome: p.nome,
        partido: p.partido || "—",
        era: p.era,
        tipo: p.tipo || "presidente",
        inicio: p.inicio,
        fim: p.fim || null,
        espectro: p.espectro || "",
        foto: en.foto,
        totalVices: (p.vices || []).length,
      };
    });
    transpCacheSet(cacheKey, presidentes);
    res.json({
      presidentes,
      atualizadoEm: transpCacheSalvoEm(cacheKey),
      cache: false,
    });
  } catch (err) {
    console.warn("[transparencia] presidentes:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar os presidentes." });
  }
});

// Detalhe de um presidente: biografia + vice(s), todos enriquecidos via API.
app.get("/api/transparencia/presidentes/:id", async (req, res) => {
  const id = String(req.params.id || "");
  const p = PRESIDENTES.find((x) => x.id === id);
  if (!p) return res.status(404).json({ erro: "Presidente não encontrado." });

  try {
    const en = await enriquecerPessoaWiki(p.wiki);
    const vices = await mapComLimite(p.vices || [], 5, async (v) => {
      const ven = await enriquecerPessoaWiki(v.wiki);
      return {
        nome: v.nome,
        periodo: v.periodo || "",
        foto: ven.foto,
        bio: ven.bio,
        url: ven.url,
      };
    });

    res.json({
      id: p.id,
      ordem: p.ordem,
      nome: p.nome,
      partido: p.partido || "—",
      era: p.era,
      tipo: p.tipo || "presidente",
      inicio: p.inicio,
      fim: p.fim || null,
      obs: p.obs || "",
      espectro: p.espectro || "",
      resumo: p.resumo || "",
      feitos: Array.isArray(p.feitos) ? p.feitos : [],
      escandalos: Array.isArray(p.escandalos) ? p.escandalos : [],
      foto: en.foto,
      bio: en.bio,
      url: en.url,
      vices,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[transparencia] presidente detalhe:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar o presidente." });
  }
});

// ─── Menções de pessoas em notícias analisadas (aba Transparência) ───────────
// Varre as análises salvas (cache_analises.entidades) e monta um índice de
// nomes mencionados + as notícias onde aparecem. O front-end casa esse índice
// com deputados, senadores e presidentes para exibir a notificação na pessoa.
function normalizarNomeBusca(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coletarMencoesIndex() {
  const cacheKey = "transpMencoes";
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let rows = [];
  try {
    rows = db
      .prepare(
        "SELECT url, titulo, veredicto, score, entidades, criado_em FROM cache_analises ORDER BY criado_em DESC LIMIT 1000",
      )
      .all();
  } catch (err) {
    console.warn("[transparencia] mencoes query:", err.message);
  }

  const mapa = new Map();
  rows.forEach((row) => {
    const entidades = safeParseJson(row.entidades || "[]", []);
    if (!Array.isArray(entidades) || !entidades.length) return;
    const vistasNaNoticia = new Set();
    entidades.forEach((e) => {
      const nome =
        typeof e === "string" ? e : (e && (e.nome || e.name || e.texto)) || "";
      const chave = normalizarNomeBusca(nome);
      if (!chave || chave.length < 3) return;
      if (vistasNaNoticia.has(chave)) return; // não conta a mesma pessoa 2x na mesma notícia
      vistasNaNoticia.add(chave);
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome,
          chave,
          tipo: (e && (e.tipo || e.type)) || "",
          total: 0,
          noticias: [],
        });
      }
      const reg = mapa.get(chave);
      reg.total += 1;
      if (reg.noticias.length < 25) {
        reg.noticias.push({
          url: row.url,
          titulo: row.titulo || row.url,
          veredito: row.veredicto || "",
          score: row.score ?? null,
          data: row.criado_em,
        });
      }
    });
  });

  const lista = Array.from(mapa.values());
  transpCacheSet(cacheKey, lista);
  return lista;
}

app.get("/api/transparencia/mencoes", (req, res) => {
  try {
    res.json({
      mencoes: coletarMencoesIndex(),
      atualizadoEm: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[transparencia] mencoes:", err.message);
    res.status(502).json({ erro: "Não foi possível carregar as menções." });
  }
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
