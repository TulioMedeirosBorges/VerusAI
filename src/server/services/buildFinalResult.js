const WHITELIST = ["g1.globo.com","bbc.com","bbc.co.uk","cnnbrasil.com.br","uol.com.br","folha.uol.com.br","estadao.com.br","agenciabrasil.ebc.com.br","reuters.com","apnews.com"];
const YELLOWLIST = ["terra.com.br","ig.com.br","metropoles.com","brasil247.com","diariodocentrodomundo.com.br","revistaoeste.com","jovempan.com.br"];
const BLACKLIST = ["beforeitsnews.com","infowars.com","naturalnews.com","worldtruth.tv"];

function getDomainReputation(url) {
  if (!url) return { pontos: 0.5, tipo: "desconhecido" };
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (WHITELIST.some(d => host === d || host.endsWith("." + d))) return { pontos: 2, tipo: "whitelist" };
    if (YELLOWLIST.some(d => host === d || host.endsWith("." + d))) return { pontos: 1, tipo: "yellowlist" };
    if (BLACKLIST.some(d => host === d || host.endsWith("." + d))) return { pontos: -2, tipo: "blacklist" };
    return { pontos: 0.5, tipo: "desconhecido" };
  } catch {
    return { pontos: 0.5, tipo: "desconhecido" };
  }
}

function calcularPontuacao(resultados, fontes, sourceInfo, tipo, conteudo) {
  let pontos = 0;

  // 1. Reputação do site de origem
  const urlOrigem = sourceInfo?.sourceUrl || sourceInfo?.officialArticleUrl || null;
  const repOrigem = getDomainReputation(urlOrigem);
  pontos += repOrigem.pontos;

  // Também considera as fontes encontradas nas claims
  const melhorFonte = fontes[0];
  if (melhorFonte?.url) {
    const repFonte = getDomainReputation(melhorFonte.url);
    pontos += repFonte.pontos;
  }

  // 2. Estrutura das afirmações
  const total = resultados.length;
  const supported = resultados.filter(r => r.status === "supported").length;
  const disputed = resultados.filter(r => r.status === "disputed").length;
  const insufficient = resultados.filter(r => r.status === "insufficient_evidence").length;

  if (total === 0) {
    pontos += 1; // vago
  } else if (disputed > supported) {
    pontos -= 2; // absurda/contraditória
  } else if (insufficient > supported) {
    pontos += 1; // vaga
  } else {
    pontos += 2; // clara e coerente
  }

  // 3. Fonte da informação
  const temFonteConfiavel = fontes.some(f => getDomainReputation(f.url).tipo === "whitelist");
  const temFonteGenerica = fontes.length > 0;
  const semFonte = fontes.length === 0;

  if (temFonteConfiavel) pontos += 2;
  else if (temFonteGenerica) pontos += 1;
  else pontos -= 2;

  // 4. Tom do texto (baseado no tipo de página)
  if (tipo === "noticia") pontos += 1;
  else if (tipo === "opiniao") pontos += 0;
  else pontos -= 2;

  // 5. Confirmação externa
  const checkable = total - resultados.filter(r => r.status === "not_checkable").length;
  if (checkable > 0) {
    const taxaSupported = supported / checkable;
    const taxaDisputed = disputed / checkable;
    if (taxaSupported >= 0.7) pontos += 3;
    else if (taxaSupported >= 0.4) pontos += 1;
    else if (taxaDisputed >= 0.5) pontos -= 3;
  }

  // Regra extra: site desconhecido + sem fonte
  if (repOrigem.tipo === "desconhecido" && semFonte) pontos -= 1;

  return Math.round(pontos * 10) / 10;
}

function pontuacaoParaVerdict(pontos) {
  if (pontos >= 8) return { overallVerdict: "true", confidenceLabel: "alta", confidenceScore: Math.min(100, Math.round((pontos / 10) * 100)) };
  if (pontos >= 4) return { overallVerdict: "mixed", confidenceLabel: "média", confidenceScore: Math.round((pontos / 10) * 100) };
  if (pontos >= 1) return { overallVerdict: "mixed", confidenceLabel: "baixa", confidenceScore: Math.round((pontos / 10) * 100) };
  return { overallVerdict: "false", confidenceLabel: "baixa", confidenceScore: Math.max(0, Math.round(((pontos + 10) / 10) * 10)) };
}

function buildFinalResult(tipo, conteudo, checagem, fontes, sourceInfo = null) {
  // Para busca e genérico, ainda tenta mostrar descrição e info do canal
  if (tipo === "busca" || tipo === "generico") {
    const titulo = conteudo?.titulo || null;
    const corpo = conteudo?.corpo || null;
    const descricao = corpo ? corpo.slice(0, 800) : null;

    let summary;
    if (tipo === "busca") {
      summary = "Página de resultados de busca. Abra uma notícia específica para analisar.";
    } else if (sourceInfo?.channelName) {
      summary = titulo
        ? `"${titulo}" — conteúdo do canal ${sourceInfo.channelName}. ${descricao || ""}`
        : `Conteúdo do canal ${sourceInfo.channelName}. ${descricao || ""}`;
    } else {
      summary = titulo
        ? `"${titulo}" — ${descricao || "Não foi possível identificar uma notícia nesta página."}`
        : descricao || "Não foi possível identificar uma notícia nesta página.";
    }

    const warnings = ["Este conteúdo não foi identificado como uma notícia verificável"];
    if (sourceInfo?.channelName) warnings.push(`Publicado pelo canal: ${sourceInfo.channelName}`);
    if (sourceInfo?.isExclusive) warnings.push(`Conteúdo aparentemente exclusivo deste canal`);

    return {
      pageType: tipo === "busca" ? "search" : "generic",
      summary,
      overallVerdict: "unverifiable",
      confidenceLabel: "baixa",
      confidenceScore: 0,
      claims: [],
      links: sourceInfo?.officialArticleUrl ? [{ title: sourceInfo.channelName, url: sourceInfo.officialArticleUrl, tier: "other" }] : [],
      warnings,
      source: sourceInfo || null,
    };
  }

  const { resultados = [] } = checagem;
  const supported = resultados.filter((r) => r.status === "supported").length;
  const disputed = resultados.filter((r) => r.status === "disputed").length;
  const mixed = resultados.filter((r) => r.status === "mixed").length;
  const insufficient = resultados.filter((r) => r.status === "insufficient_evidence").length;
  const notCheckable = resultados.filter((r) => r.status === "not_checkable").length;
  const total = resultados.length;
  const checkable = total - notCheckable;

  // Sistema de pontuação
  const pontuacao = calcularPontuacao(resultados, fontes, sourceInfo, tipo, conteudo);
  const { overallVerdict, confidenceLabel, confidenceScore } = pontuacaoParaVerdict(pontuacao);

  const claims = resultados.map((r) => ({
    text: r.afirmacao,
    verdict: r.status,
    sources: r.sources || (r.url && r.fonte ? [{ title: r.fonte, url: r.url, sourceType: r.sourceType || "secondary", snippet: null }] : []),
  }));

  // Agrega todas as fontes únicas de todas as claims
  const todasFontes = resultados.flatMap((r) => r.sources || []);
  const fontesUnicas = [];
  const seenUrls = new Set();
  for (const f of todasFontes) {
    if (!seenUrls.has(f.url)) {
      seenUrls.add(f.url);
      fontesUnicas.push(f);
    }
  }

  // Mescla com fontes ranqueadas (que já têm domainTier/domainScore)
  const linksRanqueados = fontes.map((f) => ({ title: f.fonte, url: f.url, tier: f.domainTier || "other", score: f.domainScore || 0, sourceType: f.sourceType || null }));
  const linksExtras = fontesUnicas
    .filter((f) => !linksRanqueados.some((l) => l.url === f.url))
    .map((f) => ({ title: f.title, url: f.url, tier: "other", score: 0, sourceType: f.sourceType || null }));

  const links = [...linksRanqueados, ...linksExtras].slice(0, 8);

  const warnings = [];
  if (total === 0) warnings.push("Nenhuma afirmação verificável encontrada");
  if (fontes.length === 0) warnings.push("Nenhuma fonte identificada");
  if (insufficient + notCheckable > supported + disputed) warnings.push("Maioria das afirmações sem evidências suficientes");
  if (sourceInfo?.isExclusive) warnings.push(`Conteúdo aparentemente exclusivo de ${sourceInfo.channelName}`);
  if (sourceInfo?.credibility === "baixa") warnings.push(`Canal "${sourceInfo.channelName}" tem credibilidade baixa`);
  if (sourceInfo?.credibility === "desconhecida") warnings.push(`Canal "${sourceInfo.channelName}" não é amplamente reconhecido`);
  if (tipo === "opiniao") warnings.push("Conteúdo de opinião — verificação limitada");
  if (fontes.some((f) => f.domainTier === "social")) warnings.push("Fontes incluem redes sociais");

  const titulo = conteudo.titulo ? `${conteudo.titulo}. ` : "";
  const verdictText = {
    true: pontuacao >= 8
      ? "As afirmações verificadas encontraram forte respaldo em fontes confiáveis."
      : "Parte das afirmações verificáveis encontrou respaldo em fontes consultadas.",
    false: "As afirmações verificadas foram contestadas ou não encontraram suporte em fontes confiáveis.",
    mixed: pontuacao >= 4
      ? "As afirmações apresentaram resultados divergentes entre as fontes consultadas."
      : "Poucas evidências encontradas. Verifique as fontes antes de compartilhar.",
    unverifiable: "Não foi possível verificar o conteúdo com as fontes disponíveis.",
  }[overallVerdict];

  const summary = `${titulo}${verdictText}`;

  return {
    pageType: tipo === "noticia" ? "news_article" : tipo,
    summary,
    overallVerdict,
    confidenceLabel,
    confidenceScore,
    pontuacao,
    claims,
    links,
    warnings,
    source: sourceInfo || null,
  };
}

module.exports = { buildFinalResult };
