// Avaliação comunitária de fontes (veículos de notícia): listas de domínios,
// normalizações e resumos de votos/denúncias por domínio.
const { db } = require("../../db.js");
const { dominioDaUrl, normalizarUrlPublica } = require("../../lib/utils.js");

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

module.exports = {
  FONTES_NOTICIA_CONHECIDAS,
  FAMA_FONTE,
  ehDominioNaoNoticia,
  normalizarDominioFonte,
  normalizarMotivoDenuncia,
  normalizarMotivoDenunciaUsuario,
  obterResumoFonte,
  obterAvaliacaoFonteDominio,
};
