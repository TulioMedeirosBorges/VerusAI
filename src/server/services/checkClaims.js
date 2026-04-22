const { callOpenAIJSON } = require("./openai");

const STATUS_VALIDOS = ["supported", "disputed", "mixed", "insufficient_evidence", "not_checkable"];

function buildPrompt(lista) {
  return `
Você é um verificador de fatos experiente. Para cada afirmação abaixo, você DEVE buscar ativamente evidências antes de responder.

INSTRUÇÕES DE BUSCA — siga nesta ordem para cada afirmação:
1. Busque pelo tema principal da afirmação em portais jornalísticos brasileiros (G1, Folha, Estadão, UOL, CNN Brasil)
2. Se não encontrar, busque em fontes internacionais (Reuters, BBC, AP News)
3. Se for sobre governo, leis ou dados oficiais, busque em fontes primárias (gov.br, ibge.gov.br, stf.jus.br)
4. Tente variações da busca: use palavras-chave diferentes, datas aproximadas, nomes de pessoas envolvidas
5. Só use "insufficient_evidence" se após todas essas tentativas não encontrar NADA relevante

CLASSIFICAÇÃO:
- "supported": encontrou fonte que confirma — mesmo que parcialmente
- "disputed": encontrou fonte que EXPLICITAMENTE contradiz ou desmente com evidência concreta — só use se tiver prova real
- "mixed": fontes divergem entre si
- "insufficient_evidence": buscou exaustivamente e não encontrou nada verificável
- "not_checkable": afirmação subjetiva, opinião ou inverificável por natureza (use raramente)

REGRA IMPORTANTE sobre "disputed":
- Só classifique como "disputed" se tiver uma fonte real que CONTRADIZ a afirmação
- Se encontrou cobertura do assunto mas sem contradição direta, use "supported" ou "mixed"
- Se não encontrou nada que confirme nem contradiga, use "insufficient_evidence"
- NUNCA use "disputed" sem ter uma source com URL real que comprove a contestação

REGRAS DE VALIDAÇÃO — CRÍTICO:
- Valide APENAS se encontrou uma fonte que confirma EXATAMENTE a mesma afirmação: mesmo país, mesmo contexto, mesmos valores, mesma pessoa, mesma data
- Conteúdo semelhante, parecido ou do mesmo tema NÃO é prova — só use "supported" se a correspondência for exata
- Se a fonte fala de outro país, outro período ou valores diferentes, use "insufficient_evidence"
- Se encontrou cobertura do tema mas sem confirmar os detalhes específicos, use "mixed"
- NUNCA generalize: "isso acontece em outros países" ou "algo parecido ocorreu" não valida a afirmação

REGRAS DE FONTE:
- Cada source deve ser de um domínio diferente
- NUNCA invente URLs — se não tiver a URL exata, omita a source mas mantenha o status e summary
- O summary deve refletir o que você encontrou mesmo sem URL confirmada
- Uma afirmação pode ter status "supported" com sources vazio se você tem certeza do fato mas não tem a URL exata

AFIRMAÇÕES:
${lista}

Retorne APENAS um JSON válido:
{
  "resultados": [
    {
      "afirmacao": "texto exato da afirmação",
      "status": "supported" | "disputed" | "mixed" | "insufficient_evidence" | "not_checkable",
      "summary": "O que foi encontrado sobre essa afirmação, em 1-2 frases em português",
      "sources": [
        {
          "title": "Nome do veículo",
          "url": "https://...",
          "sourceType": "primary" | "secondary",
          "snippet": "O que essa fonte diz, em até 100 caracteres, em português"
        }
      ]
    }
  ]
}
  `;
}

function buildRetryPrompt(lista) {
  return `
As afirmações abaixo não tiveram evidências encontradas na primeira busca.
Tente novamente com abordagens diferentes:

- Busque pelo contexto mais amplo (ex: se é sobre uma pessoa, busque notícias recentes sobre ela)
- Busque pelo evento ou tema relacionado, não pela afirmação literal
- Considere que a afirmação pode estar correta mesmo sem cobertura ampla — nesse caso, classifique como "supported" com summary explicando o contexto
- Se o fato é amplamente conhecido e verificável pelo seu conhecimento, classifique como "supported" mesmo sem URL
- REGRA INVIOLAVEL: mesmo nessa segunda tentativa, só classifique como "supported" se a correspondência for exata (mesmo país, mesmo contexto, mesmos valores) — conteúdo semelhante ou de outro país não é prova

AFIRMAÇÕES SEM EVIDÊNCIA:
${lista}

Retorne APENAS um JSON válido com o mesmo formato anterior.
  `;
}

async function checkClaims(afirmacoes) {
  if (!afirmacoes || afirmacoes.length === 0) {
    return { resultados: [] };
  }

  const lista = afirmacoes.map((a, i) => `${i + 1}. ${a}`).join("\n");

  // Primeira tentativa
  const resultado = await callOpenAIJSON(buildPrompt(lista), { useSearch: true, caller: "checkClaims" });

  let resultados = Array.isArray(resultado.resultados)
    ? resultado.resultados
        .filter((r) => r && typeof r.afirmacao === "string")
        .map((r) => sanitizeResult(r))
    : [];

  // Segunda tentativa para claims sem evidência — só tenta se houver poucos
  const semEvidencia = resultados.filter((r) => r.status === "insufficient_evidence");

  if (semEvidencia.length > 0 && semEvidencia.length <= 3) {
    console.log(`[checkClaims] ${semEvidencia.length} claims sem evidência — tentando novamente...`);
    const listaRetry = semEvidencia.map((r, i) => `${i + 1}. ${r.afirmacao}`).join("\n");

    try {
      const retry = await callOpenAIJSON(buildRetryPrompt(listaRetry), { useSearch: true, caller: "checkClaims-retry" });

      if (Array.isArray(retry.resultados)) {
        const retryMap = new Map(
          retry.resultados
            .filter((r) => r && typeof r.afirmacao === "string")
            .map((r) => [r.afirmacao.trim().toLowerCase(), sanitizeResult(r)])
        );

        resultados = resultados.map((r) => {
          if (r.status !== "insufficient_evidence") return r;
          const retryResult = retryMap.get(r.afirmacao.toLowerCase());
          return retryResult && retryResult.status !== "insufficient_evidence" ? retryResult : r;
        });
      }
    } catch (e) {
      console.warn("[checkClaims] Retry falhou:", e.message);
    }
  }

  console.log(`[checkClaims] ${resultados.length} resultados | supported=${resultados.filter(r => r.status === "supported").length} disputed=${resultados.filter(r => r.status === "disputed").length} insufficient=${resultados.filter(r => r.status === "insufficient_evidence").length}`);
  return { resultados };
}

function sanitizeResult(r) {
  const seenDomains = new Set();
  const sources = Array.isArray(r.sources)
    ? r.sources
        .filter((s) => s && typeof s.title === "string" && typeof s.url === "string" && s.url.startsWith("http"))
        .filter((s) => {
          try {
            const domain = new URL(s.url).hostname.replace(/^www\./, "");
            if (seenDomains.has(domain)) return false;
            seenDomains.add(domain);
            return true;
          } catch { return false; }
        })
        .map((s) => ({
          title: s.title.trim(),
          url: s.url.trim(),
          sourceType: ["primary", "secondary"].includes(s.sourceType) ? s.sourceType : "secondary",
          snippet: typeof s.snippet === "string" ? s.snippet.trim() : null,
        }))
        .slice(0, 2)
    : [];

  const status = (() => {
    const s = STATUS_VALIDOS.includes(r.status) ? r.status : "insufficient_evidence";
    if (s === "disputed" && sources.length === 0) return "insufficient_evidence";
    return s;
  })();

  return {
    afirmacao: r.afirmacao.trim(),
    status,
    summary: typeof r.summary === "string" ? r.summary.trim() : null,
    sources,
    fonte: sources[0]?.title || null,
    url: sources[0]?.url || null,
    sourceType: sources[0]?.sourceType || null,
  };
}

module.exports = { checkClaims };
