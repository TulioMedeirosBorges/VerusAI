// Persistência de uma análise concluída no cache público (cache_analises),
// passando pelo verificador de atualização (mescla com notícia existente) e
// pelo backfill de metadados de análises antigas.
const { db } = require("../../db.js");
const { safeParseJson, toScore, dominioDaUrl } = require("../../lib/utils.js");
const {
  getBuildFinal,
  mapVereditoPublico,
  coletarFontesConsultadas,
  coletarEntidadesPublicas,
} = require("./analisePublica.js");
const { prepararResultadoComVerificador } = require("./verificadorAtualizacao.js");
const { anexarAvaliacoesDeFontes } = require("./avaliarFontesNoResultado.js");
const { obterAvaliacaoFonteDominio } = require("../comunidade/fontesComunidade.js");
const { transpCacheDelete } = require("../integracoes/transpCache.js");

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
  transpCacheDelete("transpMencoes");

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

// Executa uma vez ao subir o servidor (mesmo comportamento do server.js antigo).
backfillCacheAnalisesMetadata();

module.exports = { salvarAnaliseNoCache };
