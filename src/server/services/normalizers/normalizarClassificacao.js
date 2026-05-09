const TIPOS_VALIDOS = [
  "noticia",
  "opiniao",
  "busca",
  "social",
  "produto",
  "generico",
  "erro",
];

function normalizarClassificacao(resultado) {
  const categoriaTextoPrincipal = TIPOS_VALIDOS.includes(
    resultado.categoriatextoprincipal,
  )
    ? resultado.categoriatextoprincipal
    : TIPOS_VALIDOS.includes(resultado.tipo)
      ? resultado.tipo
      : "generico";

  const categoriaPagina = TIPOS_VALIDOS.includes(resultado.categoriapagina)
    ? resultado.categoriapagina
    : categoriaTextoPrincipal;

  const tipo = categoriaTextoPrincipal;

  const textoLimpo =
    typeof resultado.textolimpo === "string" && resultado.textolimpo.trim()
      ? resultado.textolimpo
      : typeof resultado.textoutilcompleto === "string" &&
          resultado.textoutilcompleto.trim()
        ? resultado.textoutilcompleto
        : "";

  return {
    categoriapagina: categoriaPagina,
    categoriatextoprincipal: categoriaTextoPrincipal,
    tipo,

    tituloprovavel:
      typeof resultado.tituloprovavel === "string"
        ? resultado.tituloprovavel
        : "",

    textolimpo: textoLimpo,
    textoutilcompleto: textoLimpo,

    motivoclassificacao:
      typeof resultado.motivoclassificacao === "string"
        ? resultado.motivoclassificacao
        : "",

    motivonaosernoticia:
      typeof resultado.motivonaosernoticia === "string"
        ? resultado.motivonaosernoticia
        : "",

    devecontinuaranalise: categoriaTextoPrincipal === "noticia",

    publishdate:
      typeof resultado.publishdate === "string" ? resultado.publishdate : "",

    local: typeof resultado.local === "string" ? resultado.local : "",
    url: typeof resultado.local === "string" ? resultado.local : "",
  };
}

module.exports = { normalizarClassificacao };
