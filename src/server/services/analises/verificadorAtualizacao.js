// Verificador de atualização: detecta quando uma nova análise é, na verdade,
// uma atualização de notícia já existente no site (por URL ou similaridade de
// conteúdo) e mescla as informações novas com as anteriores.
const { db } = require("../../db.js");
const { safeParseJson } = require("../../lib/utils.js");
const {
  getBuildFinal,
  normalizarFonteConsultada,
  coletarFontesConsultadas,
  normalizarEntidadePublica,
  coletarEntidadesPublicas,
} = require("./analisePublica.js");

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
    .replace(/[̀-ͯ]/g, "")
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

module.exports = { prepararResultadoComVerificador };
