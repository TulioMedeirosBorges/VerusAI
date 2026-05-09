// services/normalizeClaims.js
// Limpa e padroniza as claims antes de enviar para a próxima IA

function normalizeClaims(claimsData) {
  const { origem, claimsSelecionadas, resumoExtracao } = claimsData;

  return {
    contexto: {
      url: origem.url,
      veiculo: origem.siteName,
      dataPublicacao: origem.publishDate,
      tipo: origem.tipo,
    },
    claims: claimsSelecionadas.map((claim) => ({
      id: claim.id,
      texto: claim.texto,
      tipo: claim.tipoClaim,
      importancia: claim.importancia,
      motivo: claim.motivoImportancia,
      verificacoes: {
        ano: claim.exigeAnoCorreto,
        data: claim.exigeDataCorreta,
        local: claim.exigeLocalCorreto,
        pessoa: claim.exigePessoaCorreta,
        instituicao: claim.exigeInstituicaoCorreta,
      },
      elementos: {
        datas: claim.elementosCriticos.anosOuDatas,
        locais: claim.elementosCriticos.locais,
        pessoas: claim.elementosCriticos.pessoas,
        instituicoes: claim.elementosCriticos.instituicoes,
        numeros: claim.elementosCriticos.numerosOuValores,
      },
      contextoChecagem: claim.contextoNecessarioParaChecagem,
    })),
    resumo: {
      total: resumoExtracao.totalClaimsSelecionadas,
      complexa: resumoExtracao.noticiaComplexa,
      observacoes: resumoExtracao.observacoes,
    },
  };
}

module.exports = { normalizeClaims };
