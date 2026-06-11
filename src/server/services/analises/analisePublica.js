// Montagem da visão pública de uma análise: extrai o buildFinal do resultado
// do pipeline, normaliza fontes/entidades e formata o objeto exibido no site.
const {
  safeParseJson,
  toPublicDate,
  toScore,
  dominioDaUrl,
  normalizarUrlPublica,
} = require("../../lib/utils.js");
const { anexarAvaliacoesDeFontes } = require("./avaliarFontesNoResultado.js");
const { obterAvaliacaoFonteDominio } = require("../comunidade/fontesComunidade.js");

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
    .replace(/[̀-ͯ]/g, "")
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

module.exports = {
  getBuildFinal,
  mapVereditoPublico,
  fonteLabel,
  normalizarFonteConsultada,
  coletarFontesConsultadas,
  coletarFontesPublicas,
  normalizarEntidadePublica,
  coletarEntidadesPublicas,
  montarAnalisePublica,
};
