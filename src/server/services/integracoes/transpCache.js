// Cache em memória da aba Transparência (TTL 30 min). Fica em módulo próprio
// porque é compartilhado: as rotas de transparência leem/gravam aqui e o
// salvarAnalise invalida o índice de menções quando uma nova análise é salva.
const TRANSP_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const transpCache = new Map();

function transpCacheGet(key) {
  const e = transpCache.get(key);
  if (e && Date.now() - e.salvoEm < TRANSP_CACHE_TTL_MS) return e.valor;
  return null;
}

function transpCacheSet(key, valor) {
  transpCache.set(key, { valor, salvoEm: Date.now() });
}

// Quando o dado em cache foi buscado da fonte (ISO). Se não houver entrada
// válida, assume agora (acabou de ser buscado).
function transpCacheSalvoEm(key) {
  const e = transpCache.get(key);
  return new Date(e ? e.salvoEm : Date.now()).toISOString();
}

function transpCacheDelete(key) {
  transpCache.delete(key);
}

module.exports = {
  transpCacheGet,
  transpCacheSet,
  transpCacheSalvoEm,
  transpCacheDelete,
};
