// test-normalize.js
const {
  normalizeClaims,
} = require("./src/server/services/ai-services/extractClaims");

// Dados do console que você forneceu
const claimsData = {
  ok: true,
  etapa: "extractClaims",
  origem: {
    url: "https://g1.globo.com/saude/noticia/2026/05/08/anvisa-fiscalizacao-produtos-da-ype-caso-de-bacteria.ghtml",
    domain: "g1.globo.com",
    siteName: "g1",
    pageType: "noticia",
    language: "pt-BR",
    publishDate: "2026-05-08",
    categoriaPagina: "noticia",
    categoriaTextoPrincipal: "noticia",
    tipo: "noticia",
  },
  claimsSelecionadas: [
    {
      id: 1,
      texto:
        "A Anvisa afirmou ao g1 em 7 de maio de 2026 que a inspeção que levou à suspensão da fabricação e ao recolhimento temporário de produtos da Ypê tem conexão com um histórico de contaminação microbiológica registrado na empresa em novembro de 2025.",
      tipoClaim: "principal",
      importancia: "alta",
      motivoImportancia:
        "É a afirmação central da reportagem e relaciona a fiscalização atual ao episódio anterior de contaminação.",
      exigeAnoCorreto: true,
      exigeDataCorreta: true,
      exigeLocalCorreto: false,
      exigePessoaCorreta: false,
      exigeInstituicaoCorreta: true,
      elementosCriticos: {
        anosOuDatas: ["7 de maio de 2026", "novembro de 2025"],
        locais: [],
        pessoas: [],
        instituicoes: ["Anvisa", "Ypê", "g1"],
        numerosOuValores: [],
      },
      contextoNecessarioParaChecagem:
        "Verificar a comunicação da Anvisa ao g1, a existência da medida contra produtos da Ypê e o histórico regulatório de contaminação microbiológica em novembro de 2025.",
    },
    {
      id: 2,
      texto:
        "Em novembro de 2025, a Ypê anunciou um recolhimento voluntário cautelar de lotes após identificar a bactéria Pseudomonas aeruginosa exclusivamente em lava-roupas líquidos.",
      tipoClaim: "principal",
      importancia: "alta",
      motivoImportancia:
        "É o fato anterior que sustenta a conexão mencionada pela Anvisa e contextualiza a fiscalização atual.",
      exigeAnoCorreto: true,
      exigeDataCorreta: true,
      exigeLocalCorreto: false,
      exigePessoaCorreta: false,
      exigeInstituicaoCorreta: true,
      elementosCriticos: {
        anosOuDatas: ["novembro de 2025"],
        locais: [],
        pessoas: [],
        instituicoes: ["Ypê"],
        numerosOuValores: [],
      },
      contextoNecessarioParaChecagem:
        "Confirmar comunicados da Ypê ou registros oficiais sobre o recolhimento voluntário, os lotes afetados e a identificação da bactéria Pseudomonas aeruginosa em lava-roupas líquidos.",
    },
  ],
  claimsDescartadas: [],
  resumoExtracao: {
    totalClaimsEncontradas: 17,
    totalClaimsSelecionadas: 12,
    totalClaimsDescartadas: 5,
    noticiaComplexa: true,
    motivoPermitirMaisDe5:
      "A reportagem combina medida regulatória da Anvisa, histórico de contaminação, detalhes da inspeção, escopo dos produtos afetados, recurso administrativo da empresa e informações sanitárias contextuais.",
    observacoes:
      "As claims selecionadas preservam atribuições a Anvisa, Ypê e MSD quando o texto apresenta declarações ou informações provenientes dessas instituições.",
  },
};

// Normaliza e exibe o resultado
const resultado = normalizeClaims(claimsData);
console.log(JSON.stringify(resultado, null, 2));
