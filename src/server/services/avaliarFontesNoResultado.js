"use strict";

/**
 * avaliarFontesNoResultado.js
 *
 * Roda DEPOIS que o buildFinal monta a resposta final. Percorre as fontes
 * (sites de notícia) que aparecem no resultado — a URL analisada e cada
 * fontePrincipal — identifica o domínio de cada uma e verifica no banco se
 * aquele site já recebeu avaliações da comunidade (like / dislike / denúncia
 * vindas do Ranking de Fontes). Se tiver, anexa um alerta àquela fonte.
 *
 * Ex.: "g1.globo.com/algo" -> identifica "g1.globo.com" -> "10 usuários gostam dela".
 *
 * O acesso ao banco é injetado via `obterAvaliacaoPorDominio(dominio)` para
 * manter este módulo desacoplado e testável. Essa função deve retornar
 * `{ likes, dislikes, denuncias }` ou `null` quando a fonte não tem avaliação.
 */

function extrairDominio(valor) {
  if (!valor) return "";
  let texto = String(valor).trim().toLowerCase();
  if (!texto) return "";

  if (/^https?:\/\//.test(texto)) {
    try {
      return new URL(texto).hostname.replace(/^www\./, "");
    } catch (e) {
      /* segue para o fallback abaixo */
    }
  }

  const dominio = texto
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .trim();

  // Precisa parecer um domínio (ter um ponto) para evitar nomes como "IBGE".
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio) ? dominio : "";
}

function dominioDaFonte(fonte) {
  if (!fonte) return "";
  if (typeof fonte === "string") return extrairDominio(fonte);
  return (
    extrairDominio(fonte.url || fonte.href || fonte.link) ||
    extrairDominio(fonte.dominio || fonte.domain) ||
    extrairDominio(fonte.fonte || fonte.titulo)
  );
}

function montarMensagemAvaliacao({ likes, dislikes, denuncias }) {
  const partes = [];
  if (likes > 0) {
    partes.push(`${likes} ${likes === 1 ? "usuário gosta" : "usuários gostam"} dela`);
  }
  if (dislikes > 0) {
    partes.push(`${dislikes} não ${dislikes === 1 ? "gosta" : "gostam"} dela`);
  }
  if (denuncias > 0) {
    partes.push(`${denuncias} ${denuncias === 1 ? "denúncia" : "denúncias"}`);
  }
  return partes.join(" · ");
}

function nivelAvaliacao({ likes, dislikes, denuncias }) {
  if (denuncias > 0) return "denuncia";
  if (dislikes > likes) return "negativa";
  return "positiva";
}

/**
 * Anexa as avaliações da comunidade às fontes do resultado.
 * Muta `buildFinal` (adiciona `avaliacoesFontes` e marca cada fontePrincipal
 * avaliada com `avaliacaoComunidade`) e também o retorna.
 */
function anexarAvaliacoesDeFontes(buildFinal, obterAvaliacaoPorDominio) {
  if (!buildFinal || typeof buildFinal !== "object") return buildFinal;
  if (typeof obterAvaliacaoPorDominio !== "function") return buildFinal;

  const avaliacaoPorDominio = new Map();

  function avaliar(dominio) {
    if (!dominio) return null;
    if (avaliacaoPorDominio.has(dominio)) return avaliacaoPorDominio.get(dominio);

    let avaliacao = null;
    try {
      const bruto = obterAvaliacaoPorDominio(dominio);
      if (bruto) {
        const likes = Number(bruto.likes || 0);
        const dislikes = Number(bruto.dislikes || 0);
        const denuncias = Number(bruto.denuncias || 0);
        if (likes || dislikes || denuncias) {
          avaliacao = {
            dominio,
            likes,
            dislikes,
            denuncias,
            mensagem: montarMensagemAvaliacao({ likes, dislikes, denuncias }),
            nivel: nivelAvaliacao({ likes, dislikes, denuncias }),
          };
        }
      }
    } catch (e) {
      avaliacao = null;
    }

    avaliacaoPorDominio.set(dominio, avaliacao);
    return avaliacao;
  }

  const alertas = new Map();

  // 1. Fonte principal da notícia: o domínio da própria URL analisada.
  const dominioPrincipal = extrairDominio(
    buildFinal.urlOriginal || buildFinal.url || "",
  );
  if (dominioPrincipal) {
    const avaliacao = avaliar(dominioPrincipal);
    if (avaliacao) {
      alertas.set(dominioPrincipal, { ...avaliacao, principal: true });
    }
  }

  // 2. Cada fonte listada em fontesPrincipais.
  const fontes = Array.isArray(buildFinal.fontesPrincipais)
    ? buildFinal.fontesPrincipais
    : [];
  fontes.forEach((fonte) => {
    if (!fonte || typeof fonte !== "object") return;
    const dominio = dominioDaFonte(fonte);
    const avaliacao = avaliar(dominio);
    if (!avaliacao) return;

    fonte.avaliacaoComunidade = {
      likes: avaliacao.likes,
      dislikes: avaliacao.dislikes,
      denuncias: avaliacao.denuncias,
      mensagem: avaliacao.mensagem,
      nivel: avaliacao.nivel,
    };

    if (!alertas.has(dominio)) {
      alertas.set(dominio, { ...avaliacao, principal: false });
    }
  });

  buildFinal.avaliacoesFontes = Array.from(alertas.values()).sort(
    (a, b) =>
      Number(b.principal) - Number(a.principal) ||
      b.denuncias - a.denuncias ||
      b.likes - a.likes,
  );

  return buildFinal;
}

module.exports = {
  anexarAvaliacoesDeFontes,
  extrairDominio,
  dominioDaFonte,
  montarMensagemAvaliacao,
  nivelAvaliacao,
};
