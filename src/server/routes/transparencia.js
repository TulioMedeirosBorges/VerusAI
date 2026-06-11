// ─── Transparência (deputados, senadores, prefeito de Franca-SP) ──────────────
// Rotas e helpers da aba Transparência: Câmara, Senado, SICONFI (Franca-SP),
// presidentes (Wikipédia) e índice de menções de pessoas nas análises salvas.
const { db } = require("../db.js");
const { safeParseJson } = require("../lib/utils.js");
const {
  transpCacheGet,
  transpCacheSet,
  transpCacheSalvoEm,
} = require("../services/integracoes/transpCache.js");
const { PRESIDENTES } = require("../data/presidentes.js");

const TRANSP_UA =
  "Mozilla/5.0 (compatible; VerusAI/1.0; +http://localhost:3000/site)";

async function transpFetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": TRANSP_UA },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Franca-SP: o portal municipal (EddyData) exige login/token e id de tenant,
// sem API aberta estável. Usamos o SICONFI (Tesouro Nacional), que publica a
// execução orçamentária de cada município em API pública e sem autenticação.
const FRANCA_IBGE = 3516200;

// Prefeitos de Franca-SP por mandato — dado curado (não há API pública de
// prefeito). Fonte: Wikipédia / TSE. Adicionar a cada nova gestão.
const FRANCA_PREFEITOS = [
  {
    de: 2025, ate: 2028,
    nome: "Alexandre Augusto Ferreira", partido: "MDB", mandato: "2025–2028",
    foto: "/assets/icons/prefeito_franca.jpg",
    fonte: "https://pt.wikipedia.org/wiki/Franca",
  },
  {
    de: 2021, ate: 2024,
    nome: "Alexandre Augusto Ferreira", partido: "MDB", mandato: "2021–2024",
    foto: "/assets/icons/prefeito_franca.jpg",
    fonte: "https://pt.wikipedia.org/wiki/Franca",
  },
  {
    de: 2017, ate: 2020,
    nome: "Gilson de Souza", partido: "DEM", mandato: "2017–2020",
    foto: "/assets/icons/prefeito_franca_gilson.jpg",
    fonte: "https://pt.wikipedia.org/wiki/Gilson_de_Souza_(prefeito)",
  },
];

// Prefeito que governava no ano informado (ou o mais antigo conhecido).
function prefeitoDeFranca(ano) {
  return (
    FRANCA_PREFEITOS.find((p) => ano >= p.de && ano <= p.ate) ||
    FRANCA_PREFEITOS[FRANCA_PREFEITOS.length - 1]
  );
}

// Funções orçamentárias oficiais (Portaria MOG 42/1999), normalizadas. Servem
// para separar a função (nível 1) das subfunções no RREO Anexo 02 do SICONFI.
const FUNCOES_ORCAMENTARIAS = new Set([
  "legislativa", "judiciaria", "essencial a justica", "administracao",
  "defesa nacional", "seguranca publica", "relacoes exteriores",
  "assistencia social", "previdencia social", "saude", "trabalho", "educacao",
  "cultura", "direitos da cidadania", "urbanismo", "habitacao", "saneamento",
  "gestao ambiental", "ciencia e tecnologia", "agricultura",
  "organizacao agraria", "industria", "comercio e servicos", "comunicacoes",
  "energia", "transporte", "desporto e lazer", "encargos especiais",
  "reserva de contingencia",
]);

function normalizaTxt(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const ANO_ATUAL = new Date().getFullYear();

function anoValido(req) {
  const ano = parseInt(req.query.ano, 10);
  if (!Number.isFinite(ano) || ano < 2008 || ano > ANO_ATUAL) return ANO_ATUAL;
  return ano;
}

// Processa as despesas (CEAP) de um deputado num ano, cacheado.
async function despesasDeputadoAno(id, ano) {
  const cacheKey = `depDesp:${id}:${ano}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let url =
    `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas` +
    `?ano=${ano}&itens=100&ordem=DESC&ordenarPor=dataDocumento`;
  const itens = [];
  for (let pagina = 0; pagina < 15 && url; pagina++) {
    const data = await transpFetchJson(url);
    (data.dados || []).forEach((d) => itens.push(d));
    const next = (data.links || []).find((l) => l.rel === "next");
    url = next ? next.href : null;
  }

  let total = 0;
  const porCategoria = {};
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: 0 }));
  const porCatMes = {}; // { mes: { categoria: valor } }
  itens.forEach((d) => {
    const v = Number(d.valorLiquido) || 0;
    total += v;
    const cat = d.tipoDespesa || "Outros";
    porCategoria[cat] = (porCategoria[cat] || 0) + v;
    const m = Number(d.mes);
    if (m >= 1 && m <= 12) {
      porMes[m - 1].valor += v;
      if (!porCatMes[m]) porCatMes[m] = {};
      porCatMes[m][cat] = (porCatMes[m][cat] || 0) + v;
    }
  });
  const categorias = Object.entries(porCategoria)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const categoriasMes = ordenarCategoriasPorMes(porCatMes);
  const recentes = itens.slice(0, 10).map((d) => ({
    data: d.dataDocumento,
    tipo: d.tipoDespesa,
    fornecedor: d.nomeFornecedor,
    valor: Number(d.valorLiquido) || 0,
    url: d.urlDocumento || "",
  }));

  const valor = {
    ano, total, qtde: itens.length, categorias, porMes, categoriasMes, recentes,
    atualizadoEm: new Date().toISOString(),
  };
  transpCacheSet(cacheKey, valor);
  return valor;
}

// Converte { mes: {categoria: valor} } em { mes: [{categoria, valor}] } ordenado.
function ordenarCategoriasPorMes(porCatMes) {
  const out = {};
  Object.keys(porCatMes).forEach((m) => {
    out[m] = Object.entries(porCatMes[m])
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  });
  return out;
}

// Carrega e indexa o arquivo anual de CEAPS do Senado por código de senador.
// O endpoint retorna todas as despesas do ano; cacheamos o índice 30 min para
// não rebaixar o serviço a cada consulta individual.
async function carregarCeapsAno(ano) {
  const cacheKey = `senCeapsAno:${ano}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let lista;
  try {
    const r = await fetch(
      `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/${ano}`,
      {
        redirect: "follow",
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": TRANSP_UA },
      },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    lista = await r.json();
  } finally {
    clearTimeout(timeout);
  }

  const porSenador = new Map();
  (Array.isArray(lista) ? lista : []).forEach((d) => {
    const cod = String(d.codSenador || "");
    if (!cod) return;
    if (!porSenador.has(cod)) porSenador.set(cod, []);
    porSenador.get(cod).push(d);
  });
  transpCacheSet(cacheKey, porSenador);
  return porSenador;
}

// Processa as despesas (CEAPS) de um senador num ano (a partir do índice anual).
async function despesasSenadorAno(codigo, ano) {
  const porSenador = await carregarCeapsAno(ano);
  const itens = porSenador.get(codigo) || [];

  let total = 0;
  const porCategoria = {};
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: 0 }));
  const porCatMes = {}; // { mes: { categoria: valor } }
  itens.forEach((d) => {
    const v = Number(d.valorReembolsado) || 0;
    total += v;
    const cat = d.tipoDespesa || d.tipoDocumento || "Outros";
    porCategoria[cat] = (porCategoria[cat] || 0) + v;
    const m = Number(d.mes);
    if (m >= 1 && m <= 12) {
      porMes[m - 1].valor += v;
      if (!porCatMes[m]) porCatMes[m] = {};
      porCatMes[m][cat] = (porCatMes[m][cat] || 0) + v;
    }
  });
  const categorias = Object.entries(porCategoria)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const categoriasMes = ordenarCategoriasPorMes(porCatMes);
  const recentes = [...itens]
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))
    .slice(0, 10)
    .map((d) => ({
      data: d.data,
      tipo: d.tipoDespesa || d.tipoDocumento || "Outros",
      fornecedor: d.fornecedor || d.cpfCnpj || "",
      valor: Number(d.valorReembolsado) || 0,
      url: "",
    }));

  return {
    ano, total, qtde: itens.length, categorias, porMes, categoriasMes, recentes,
    atualizadoEm: transpCacheSalvoEm(`senCeapsAno:${ano}`),
  };
}

// ─── Perfil completo de parlamentares ────────────────────────────────────────
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";
const SENADO_API = "https://legis.senado.leg.br/dadosabertos";
// Subsídio mensal bruto de deputados e senadores — valor fixo e igual para
// todos (não há API "por pessoa"); exibido apenas como referência.
const SUBSIDIO_PARLAMENTAR = 46366.19;
// No Senado o JSON encapsula listas como objeto único quando há só 1 item.
const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const semFalha = (p) => p.catch(() => ({}));

// Auxílio-moradia/imóvel funcional de um senador (Dados Abertos da Adm. do
// Senado). A lista é por nome; cacheamos e casamos pelo nome normalizado.
async function auxilioMoradiaSenador(nome) {
  if (!nome) return null;
  try {
    const cacheKey = "senAuxilioMoradia";
    let lista = transpCacheGet(cacheKey);
    if (!lista) {
      lista = await transpFetchJson(
        "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/auxilio-moradia",
      );
      lista = Array.isArray(lista) ? lista : [];
      transpCacheSet(cacheKey, lista);
    }
    const alvo = normalizaTxt(nome);
    const item = lista.find((x) => normalizaTxt(x.nomeParlamentar) === alvo);
    if (!item) return null;
    return {
      auxilioMoradia: Boolean(item.auxilioMoradia),
      imovelFuncional: Boolean(item.imovelFuncional),
    };
  } catch {
    return null;
  }
}

// Busca o RREO Anexo 02 (despesa por função) de Franca no SICONFI, tentando
// do 6º ao 1º bimestre — retorna o primeiro período com dados publicados.
async function buscarDespesaFrancaAno(ano) {
  for (let periodo = 6; periodo >= 1; periodo--) {
    const url =
      "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo" +
      `?an_exercicio=${ano}&nr_periodo=${periodo}` +
      "&co_tipo_demonstrativo=RREO" +
      `&no_anexo=${encodeURIComponent("RREO-Anexo 02")}&id_ente=${FRANCA_IBGE}`;
    const data = await transpFetchJson(url);
    const itens = data?.items || [];
    if (itens.length) return { itens, periodo, url };
  }
  return null;
}

// Processa a execução orçamentária da Franca para um ano (com recuo de ano se
// o exercício pedido ainda não foi publicado). Cacheado por ano pedido.
async function montarFrancaAno(anoPedido) {
  const cacheKey = `franca:${anoPedido}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let ano = anoPedido;
  let resultado = await buscarDespesaFrancaAno(ano);
  for (let tent = 0; !resultado && tent < 3; tent++) {
    ano -= 1;
    resultado = await buscarDespesaFrancaAno(ano);
  }
  if (!resultado) {
    return {
      disponivel: false,
      motivo: "O SICONFI ainda não publicou a execução orçamentária deste período.",
    };
  }

  const { itens, periodo, url } = resultado;
  // Despesa liquidada (efetivamente realizada) até o bimestre, exceto intra.
  const liquidadas = itens.filter(
    (x) =>
      normalizaTxt(x.rotulo).startsWith("total das despesas exceto") &&
      normalizaTxt(x.coluna).startsWith("despesas liquidadas at"),
  );

  let total = 0;
  const funcoes = [];
  liquidadas.forEach((x) => {
    const nome = normalizaTxt(x.conta);
    if (nome.startsWith("despesas (exceto")) {
      total = Number(x.valor) || 0;
    } else if (FUNCOES_ORCAMENTARIAS.has(nome)) {
      const valor = Number(x.valor) || 0;
      if (valor > 0) funcoes.push({ funcao: x.conta, valor });
    }
  });
  funcoes.sort((a, b) => b.valor - a.valor);

  const meta = itens[0] || {};
  const valor = {
    disponivel: true,
    ano,
    periodo,
    instituicao: meta.instituicao || "Prefeitura Municipal de Franca - SP",
    populacao: meta.populacao || null,
    total,
    funcoes,
    prefeito: prefeitoDeFranca(ano),
    fonte: url,
    fonteLabel: "SICONFI · Tesouro Nacional (RREO — Anexo 02)",
    atualizadoEm: new Date().toISOString(),
  };
  transpCacheSet(cacheKey, valor);
  return valor;
}

// ─── Presidentes, ex-presidentes e vices ─────────────────────────────────────
// O esqueleto vem de PRESIDENTES (curado); tenta-se enriquecer cada nome com
// foto/biografia via API REST do Wikipédia (pt). Quando a API não traz dado,
// `temDadosApi=false` e o front-end exibe o selo "Sem dados de API".

// Executa `fn` sobre os itens com no máximo `limite` chamadas simultâneas,
// preservando a ordem dos resultados.
async function mapComLimite(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function worker() {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i], i);
    }
  }
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) || 0 },
    worker,
  );
  await Promise.all(trabalhadores);
  return resultados;
}

// Busca foto + resumo de uma pessoa na API REST do Wikipédia (pt), com cache.
// Retorna sempre um objeto; em caso de falha/404/desambiguação, temDadosApi=false.
async function enriquecerPessoaWiki(wiki) {
  const vazio = { foto: "", bio: "", url: "", temDadosApi: false };
  if (!wiki) return vazio;
  const cacheKey = `presWiki:${wiki}`;
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let resultado = vazio;
  try {
    const data = await transpFetchJson(
      `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wiki)}`,
    );
    if (data && data.type !== "disambiguation") {
      const foto = (data.thumbnail && data.thumbnail.source) || "";
      const bio = data.extract || "";
      resultado = {
        foto,
        bio,
        url:
          (data.content_urls &&
            data.content_urls.desktop &&
            data.content_urls.desktop.page) ||
          "",
        temDadosApi: Boolean(foto || bio),
      };
    }
  } catch (err) {
    // Sem dado na API — mantém o objeto vazio (o front-end mostra o selo).
  }
  transpCacheSet(cacheKey, resultado);
  return resultado;
}

// ─── Menções de pessoas em notícias analisadas (aba Transparência) ───────────
// Varre as análises salvas (cache_analises.entidades) e monta um índice de
// nomes mencionados + as notícias onde aparecem. O front-end casa esse índice
// com deputados, senadores e presidentes para exibir a notificação na pessoa.
function normalizarNomeBusca(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coletarMencoesIndex() {
  const cacheKey = "transpMencoes";
  const emCache = transpCacheGet(cacheKey);
  if (emCache) return emCache;

  let rows = [];
  try {
    rows = db
      .prepare(
        "SELECT url, titulo, veredicto, score, entidades, criado_em FROM cache_analises ORDER BY criado_em DESC LIMIT 1000",
      )
      .all();
  } catch (err) {
    console.warn("[transparencia] mencoes query:", err.message);
  }

  const mapa = new Map();
  rows.forEach((row) => {
    const entidades = safeParseJson(row.entidades || "[]", []);
    if (!Array.isArray(entidades) || !entidades.length) return;
    const vistasNaNoticia = new Set();
    entidades.forEach((e) => {
      const nome =
        typeof e === "string" ? e : (e && (e.nome || e.name || e.texto)) || "";
      const chave = normalizarNomeBusca(nome);
      if (!chave || chave.length < 3) return;
      if (vistasNaNoticia.has(chave)) return; // não conta a mesma pessoa 2x na mesma notícia
      vistasNaNoticia.add(chave);
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome,
          chave,
          tipo: (e && (e.tipo || e.type)) || "",
          total: 0,
          noticias: [],
        });
      }
      const reg = mapa.get(chave);
      reg.total += 1;
      if (reg.noticias.length < 25) {
        reg.noticias.push({
          url: row.url,
          titulo: row.titulo || row.url,
          veredito: row.veredicto || "",
          score: row.score ?? null,
          data: row.criado_em,
        });
      }
    });
  });

  const lista = Array.from(mapa.values());
  transpCacheSet(cacheKey, lista);
  return lista;
}

module.exports = function registrarRotasTransparencia(app) {
  // Lista de deputados federais (Câmara) — com filtros opcionais uf/partido.
  app.get("/api/transparencia/deputados", async (req, res) => {
    const uf = String(req.query.uf || "").trim().toUpperCase().slice(0, 2);
    const partido = String(req.query.partido || "").trim().toUpperCase().slice(0, 20);
    const cacheKey = `dep:${uf}:${partido}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache)
      return res.json({ deputados: emCache, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: true });

    try {
      const base = new URL("https://dadosabertos.camara.leg.br/api/v2/deputados");
      base.searchParams.set("ordem", "ASC");
      base.searchParams.set("ordenarPor", "nome");
      base.searchParams.set("itens", "100");
      if (uf) base.searchParams.set("siglaUf", uf);
      if (partido) base.searchParams.set("siglaPartido", partido);

      let url = base.toString();
      const deputados = [];
      for (let pagina = 0; pagina < 8 && url; pagina++) {
        const data = await transpFetchJson(url);
        (data.dados || []).forEach((d) =>
          deputados.push({
            id: d.id,
            nome: d.nome,
            partido: d.siglaPartido || "",
            uf: d.siglaUf || "",
            foto: d.urlFoto || "",
            email: d.email || "",
          }),
        );
        const next = (data.links || []).find((l) => l.rel === "next");
        url = next ? next.href : null;
      }

      transpCacheSet(cacheKey, deputados);
      res.json({ deputados, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: false });
    } catch (err) {
      console.warn("[transparencia] deputados:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar os deputados." });
    }
  });

  // Despesas (CEAP) de um deputado por ano.
  app.get("/api/transparencia/deputados/:id/despesas", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id))
      return res.status(400).json({ erro: "ID inválido." });
    try {
      res.json(await despesasDeputadoAno(id, anoValido(req)));
    } catch (err) {
      console.warn("[transparencia] despesas deputado:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar as despesas." });
    }
  });

  // Total de gastos (CEAP) por ano de um deputado — gráfico de todos os anos.
  app.get("/api/transparencia/deputados/:id/gastos-anos", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
    const cacheKey = `depGastosAnos:${id}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const anosAlvo = [];
      for (let a = 2019; a <= ANO_ATUAL; a++) anosAlvo.push(a);
      const resultados = await Promise.all(
        anosAlvo.map((a) => despesasDeputadoAno(id, a).catch(() => null)),
      );
      const anos = resultados
        .filter((r) => r && r.total > 0)
        .map((r) => ({ ano: r.ano, total: r.total }));
      const valor = { anos, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] gastos-anos deputado:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar o histórico de gastos." });
    }
  });

  // Lista de senadores em exercício (Senado).
  app.get("/api/transparencia/senadores", async (req, res) => {
    const uf = String(req.query.uf || "").trim().toUpperCase().slice(0, 2);
    const cacheKey = `sen:${uf}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache)
      return res.json({ senadores: emCache, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: true });

    try {
      const data = await transpFetchJson(
        "https://legis.senado.leg.br/dadosabertos/senador/lista/atual",
      );
      const lista =
        data?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
      let senadores = lista.map((p) => {
        const i = p.IdentificacaoParlamentar || {};
        return {
          codigo: i.CodigoParlamentar || "",
          nome: i.NomeParlamentar || "",
          nomeCompleto: i.NomeCompletoParlamentar || "",
          partido: i.SiglaPartidoParlamentar || "",
          uf: i.UfParlamentar || "",
          foto: i.UrlFotoParlamentar || "",
          email: i.EmailParlamentar || "",
          pagina: i.UrlPaginaParlamentar || "",
        };
      });
      if (uf) senadores = senadores.filter((s) => s.uf === uf);
      senadores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      transpCacheSet(cacheKey, senadores);
      res.json({ senadores, atualizadoEm: transpCacheSalvoEm(cacheKey), cache: false });
    } catch (err) {
      console.warn("[transparencia] senadores:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar os senadores." });
    }
  });

  // Despesas (CEAPS) de um senador por ano.
  // Fonte: Dados Abertos da Administração do Senado Federal.
  app.get("/api/transparencia/senadores/:codigo/despesas", async (req, res) => {
    const codigo = String(req.params.codigo || "").trim();
    if (!codigo) return res.status(400).json({ erro: "Código inválido." });

    try {
      res.json(await despesasSenadorAno(codigo, anoValido(req)));
    } catch (err) {
      console.warn("[transparencia] despesas senador:", err.message);
      res
        .status(502)
        .json({ erro: "Não foi possível carregar as despesas do senador." });
    }
  });

  // Total de gastos (CEAPS) por ano de um senador — gráfico de todos os anos.
  app.get("/api/transparencia/senadores/:codigo/gastos-anos", async (req, res) => {
    const codigo = String(req.params.codigo || "").trim();
    if (!codigo) return res.status(400).json({ erro: "Código inválido." });
    const cacheKey = `senGastosAnos:${codigo}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const anosAlvo = [];
      for (let a = 2019; a <= ANO_ATUAL; a++) anosAlvo.push(a);
      const resultados = await Promise.all(
        anosAlvo.map((a) => despesasSenadorAno(codigo, a).catch(() => null)),
      );
      const anos = resultados
        .filter((r) => r && r.total > 0)
        .map((r) => ({ ano: r.ano, total: r.total }));
      const valor = { anos, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] gastos-anos senador:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar o histórico de gastos." });
    }
  });

  // Perfil (dados pessoais, contato, comissões, frentes, profissões) — Câmara.
  app.get("/api/transparencia/deputados/:id/perfil", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
    const cacheKey = `depPerfil:${id}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const [det, orgaosR, frentesR, profR, ocupR] = await Promise.all([
        transpFetchJson(`${CAMARA_API}/deputados/${id}`),
        semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/orgaos?ordem=DESC&ordenarPor=dataInicio&itens=100`)),
        semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/frentes`)),
        semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/profissoes`)),
        semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/ocupacoes`)),
      ]);
      const d = det.dados || {};
      const st = d.ultimoStatus || {};
      const orgaos = orgaosR.dados || [];
      const perfil = {
        id,
        casa: "deputado",
        nome: st.nome || d.nomeCivil || "",
        nomeCivil: d.nomeCivil || "",
        foto: st.urlFoto || "",
        partido: st.siglaPartido || "",
        uf: st.siglaUf || "",
        situacao: st.situacao || "",
        condicao: st.condicaoEleitoral || "",
        email: (st.gabinete && st.gabinete.email) || st.email || "",
        telefone: (st.gabinete && st.gabinete.telefone) || "",
        gabinete: st.gabinete || {},
        site: d.urlWebsite || "",
        redes: d.redeSocial || [],
        sexo: d.sexo || "",
        nascimento: d.dataNascimento || "",
        falecimento: d.dataFalecimento || "",
        naturalidade: [d.municipioNascimento, d.ufNascimento].filter(Boolean).join(" - "),
        escolaridade: d.escolaridade || "",
        cpf: d.cpf || "",
        subsidio: SUBSIDIO_PARLAMENTAR,
        comissoes: orgaos
          .filter((o) => !o.dataFim)
          .map((o) => ({ sigla: o.siglaOrgao, nome: o.nomeOrgao, cargo: o.titulo, inicio: o.dataInicio })),
        qtdeComissoesHist: orgaos.length,
        frentes: (frentesR.dados || []).map((f) => f.titulo).filter(Boolean),
        profissoes: (profR.dados || []).map((p) => p.titulo).filter(Boolean),
        ocupacoes: (ocupR.dados || []).map((o) => ({
          titulo: o.titulo || "",
          entidade: o.entidade || "",
          inicio: o.anoInicio || "",
          fim: o.anoFim || "",
        })),
        atualizadoEm: new Date().toISOString(),
      };
      transpCacheSet(cacheKey, perfil);
      res.json({ ...perfil, cache: false });
    } catch (err) {
      console.warn("[transparencia] perfil deputado:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar o perfil do deputado." });
    }
  });

  // Produção legislativa: proposições de autoria + discursos recentes — Câmara.
  app.get("/api/transparencia/deputados/:id/producao", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
    const cacheKey = `depProd:${id}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const [propsR, discR] = await Promise.all([
        semFalha(transpFetchJson(`${CAMARA_API}/proposicoes?idDeputadoAutor=${id}&ordem=DESC&ordenarPor=id&itens=25`)),
        semFalha(transpFetchJson(`${CAMARA_API}/deputados/${id}/discursos?ordem=DESC&ordenarPor=dataHoraInicio&itens=15`)),
      ]);
      const proposicoes = (propsR.dados || []).map((p) => ({
        sigla: `${p.siglaTipo} ${p.numero}/${p.ano}`,
        ementa: p.ementa || "",
      }));
      const discursos = (discR.dados || []).map((s) => ({
        data: s.dataHoraInicio || "",
        tipo: s.tipoDiscurso || "",
        sumario: s.sumario || (s.transcricao ? String(s.transcricao).slice(0, 240) : ""),
        video: s.urlVideo || "",
        texto: s.urlTexto || "",
      }));
      const valor = { proposicoes, discursos, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] producao deputado:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar a produção do deputado." });
    }
  });

  // Agenda / eventos recentes — Câmara.
  app.get("/api/transparencia/deputados/:id/agenda", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });
    const cacheKey = `depAgenda:${id}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const r = await semFalha(
        transpFetchJson(`${CAMARA_API}/deputados/${id}/eventos?ordem=DESC&ordenarPor=dataHoraInicio&itens=20`),
      );
      const eventos = (r.dados || []).map((e) => ({
        data: e.dataHoraInicio || "",
        fim: e.dataHoraFim || "",
        tipo: e.descricaoTipo || "",
        descricao: e.descricao || "",
        situacao: e.situacao || "",
        local: (e.localCamara && e.localCamara.nome) || e.localExterno || "",
      }));
      const valor = { eventos, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] agenda deputado:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar a agenda do deputado." });
    }
  });

  // Perfil (dados, contato, comissões, mandato, cargos, auxílio-moradia) — Senado.
  app.get("/api/transparencia/senadores/:codigo/perfil", async (req, res) => {
    const codigo = String(req.params.codigo || "").trim();
    if (!codigo) return res.status(400).json({ erro: "Código inválido." });
    const cacheKey = `senPerfil:${codigo}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const [detR, comR, mandR, cargoR] = await Promise.all([
        transpFetchJson(`${SENADO_API}/senador/${codigo}`),
        semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/comissoes`)),
        semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/mandatos`)),
        semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/cargos`)),
      ]);
      const p = (detR.DetalheParlamentar && detR.DetalheParlamentar.Parlamentar) || {};
      const ident = p.IdentificacaoParlamentar || {};
      const basicos = p.DadosBasicosParlamentar || {};
      const telefones = asArray(p.Telefones && p.Telefones.Telefone)
        .map((t) => t.NumeroTelefone)
        .filter(Boolean);

      const comRaiz =
        comR.MembroComissaoParlamentar &&
        comR.MembroComissaoParlamentar.Parlamentar &&
        comR.MembroComissaoParlamentar.Parlamentar.MembroComissoes;
      const comissoes = asArray(comRaiz && comRaiz.Comissao)
        .filter((c) => !c.DataFim)
        .map((c) => ({
          sigla: (c.IdentificacaoComissao && c.IdentificacaoComissao.SiglaComissao) || "",
          nome: (c.IdentificacaoComissao && c.IdentificacaoComissao.NomeComissao) || "",
          cargo: c.DescricaoParticipacao || "",
          inicio: c.DataInicio || "",
        }));

      const mandRaiz =
        mandR.MandatoParlamentar &&
        mandR.MandatoParlamentar.Parlamentar &&
        mandR.MandatoParlamentar.Parlamentar.Mandatos;
      const mandatos = asArray(mandRaiz && mandRaiz.Mandato).map((m) => {
        const legs = [m.PrimeiraLegislaturaDoMandato, m.SegundaLegislaturaDoMandato]
          .filter(Boolean)
          .map((l) => `${(l.DataInicio || "").slice(0, 4)}–${(l.DataFim || "").slice(0, 4)}`);
        return { uf: m.UfParlamentar || "", participacao: m.DescricaoParticipacao || "", periodo: legs.join(" / ") };
      });

      const cargoRaiz =
        cargoR.CargoParlamentar &&
        cargoR.CargoParlamentar.Parlamentar &&
        cargoR.CargoParlamentar.Parlamentar.Cargos;
      const cargos = asArray(cargoRaiz && cargoRaiz.Cargo)
        .filter((c) => !c.DataFim)
        .map((c) => ({
          cargo: c.DescricaoCargo || "",
          orgao: (c.IdentificacaoComissao && c.IdentificacaoComissao.NomeComissao) || "",
        }));

      const auxilio = await auxilioMoradiaSenador(ident.NomeParlamentar || "");

      const perfil = {
        codigo,
        casa: "senador",
        nome: ident.NomeParlamentar || "",
        nomeCivil: ident.NomeCompletoParlamentar || "",
        foto: ident.UrlFotoParlamentar || "",
        partido: ident.SiglaPartidoParlamentar || "",
        uf: ident.UfParlamentar || "",
        email: ident.EmailParlamentar || "",
        site: ident.UrlPaginaParlamentar || "",
        sexo: ident.SexoParlamentar || "",
        telefones,
        nascimento: basicos.DataNascimento || "",
        naturalidade: [basicos.Naturalidade, basicos.UfNaturalidade].filter(Boolean).join(" - "),
        endereco: basicos.EnderecoParlamentar || "",
        subsidio: SUBSIDIO_PARLAMENTAR,
        comissoes,
        mandatos,
        cargos,
        auxilioMoradia: auxilio,
        atualizadoEm: new Date().toISOString(),
      };
      transpCacheSet(cacheKey, perfil);
      res.json({ ...perfil, cache: false });
    } catch (err) {
      console.warn("[transparencia] perfil senador:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar o perfil do senador." });
    }
  });

  // Produção (autorias + discursos) — Senado.
  app.get("/api/transparencia/senadores/:codigo/producao", async (req, res) => {
    const codigo = String(req.params.codigo || "").trim();
    if (!codigo) return res.status(400).json({ erro: "Código inválido." });
    const cacheKey = `senProd:${codigo}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const [autR, discR] = await Promise.all([
        semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/autorias`)),
        semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/discursos`)),
      ]);
      const autRaiz =
        autR.MateriasAutoriaParlamentar &&
        autR.MateriasAutoriaParlamentar.Parlamentar &&
        autR.MateriasAutoriaParlamentar.Parlamentar.Autorias;
      const proposicoes = asArray(autRaiz && autRaiz.Autoria)
        .map((a) => ({
          sigla: (a.Materia && a.Materia.DescricaoIdentificacao) || "",
          ementa: (a.Materia && a.Materia.Ementa) || "",
          data: (a.Materia && a.Materia.Data) || "",
          principal: a.IndicadorAutorPrincipal === "Sim",
        }))
        .sort((x, y) => String(y.data).localeCompare(String(x.data)))
        .slice(0, 25);

      const discRaiz =
        discR.DiscursosParlamentar &&
        discR.DiscursosParlamentar.Parlamentar &&
        discR.DiscursosParlamentar.Parlamentar.Pronunciamentos;
      const discursos = asArray(discRaiz && discRaiz.Pronunciamento)
        .map((s) => ({
          data: s.DataPronunciamento || "",
          tipo: (s.TipoUsoPalavra && s.TipoUsoPalavra.Descricao) || "",
          sumario: s.TextoResumo || "",
          texto: s.UrlTexto || "",
        }))
        .slice(0, 15);

      const valor = { proposicoes, discursos, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] producao senador:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar a produção do senador." });
    }
  });

  // Votações nominais recentes — Senado.
  app.get("/api/transparencia/senadores/:codigo/votacoes", async (req, res) => {
    const codigo = String(req.params.codigo || "").trim();
    if (!codigo) return res.status(400).json({ erro: "Código inválido." });
    const cacheKey = `senVot:${codigo}`;
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const r = await semFalha(transpFetchJson(`${SENADO_API}/senador/${codigo}/votacoes`));
      const raiz =
        r.VotacaoParlamentar &&
        r.VotacaoParlamentar.Parlamentar &&
        r.VotacaoParlamentar.Parlamentar.Votacoes;
      const votacoes = asArray(raiz && raiz.Votacao)
        .map((v) => ({
          data: (v.SessaoPlenaria && v.SessaoPlenaria.DataSessao) || "",
          materia: (v.Materia && v.Materia.DescricaoIdentificacao) || "",
          ementa: (v.Materia && v.Materia.Ementa) || "",
          voto: v.DescricaoVoto || v.SiglaDescricaoVoto || "",
        }))
        .sort((x, y) => String(y.data).localeCompare(String(x.data)))
        .slice(0, 25);
      const valor = { votacoes, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] votacoes senador:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar as votações do senador." });
    }
  });

  // Gastos da Prefeitura de Franca-SP (despesa liquidada por função) de um ano.
  app.get("/api/transparencia/franca", async (req, res) => {
    try {
      res.json(await montarFrancaAno(anoValido(req)));
    } catch (err) {
      console.warn("[transparencia] franca:", err.message);
      res
        .status(502)
        .json({ erro: "Não foi possível carregar os dados de Franca-SP." });
    }
  });

  // Total liquidado por ano (todos os anos com dados) — gráfico histórico.
  app.get("/api/transparencia/franca/historico", async (req, res) => {
    const cacheKey = "francaHist";
    const emCache = transpCacheGet(cacheKey);
    if (emCache) return res.json({ ...emCache, cache: true });

    try {
      const anosBuscados = [];
      for (let a = 2019; a <= ANO_ATUAL; a++) anosBuscados.push(a);
      const dados = await mapComLimite(anosBuscados, 4, montarFrancaAno);
      const anos = [];
      anosBuscados.forEach((a, i) => {
        const d = dados[i];
        // só inclui anos que têm dados próprios (evita duplicar via recuo de ano)
        if (d && d.disponivel && d.ano === a) anos.push({ ano: a, total: d.total });
      });
      const valor = { anos, atualizadoEm: new Date().toISOString() };
      transpCacheSet(cacheKey, valor);
      res.json({ ...valor, cache: false });
    } catch (err) {
      console.warn("[transparencia] franca historico:", err.message);
      res
        .status(502)
        .json({ erro: "Não foi possível carregar o histórico de Franca-SP." });
    }
  });

  // Lista (timeline) de todos os presidentes, com foto e flag de dados de API.
  app.get("/api/transparencia/presidentes", async (req, res) => {
    const cacheKey = "presLista";
    const emCache = transpCacheGet(cacheKey);
    if (emCache)
      return res.json({
        presidentes: emCache,
        atualizadoEm: transpCacheSalvoEm(cacheKey),
        cache: true,
      });

    try {
      const presidentes = await mapComLimite(PRESIDENTES, 8, async (p) => {
        const en = await enriquecerPessoaWiki(p.wiki);
        return {
          id: p.id,
          ordem: p.ordem,
          nome: p.nome,
          partido: p.partido || "—",
          era: p.era,
          tipo: p.tipo || "presidente",
          inicio: p.inicio,
          fim: p.fim || null,
          espectro: p.espectro || "",
          foto: en.foto,
          totalVices: (p.vices || []).length,
        };
      });
      transpCacheSet(cacheKey, presidentes);
      res.json({
        presidentes,
        atualizadoEm: transpCacheSalvoEm(cacheKey),
        cache: false,
      });
    } catch (err) {
      console.warn("[transparencia] presidentes:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar os presidentes." });
    }
  });

  // Detalhe de um presidente: biografia + vice(s), todos enriquecidos via API.
  app.get("/api/transparencia/presidentes/:id", async (req, res) => {
    const id = String(req.params.id || "");
    const p = PRESIDENTES.find((x) => x.id === id);
    if (!p) return res.status(404).json({ erro: "Presidente não encontrado." });

    try {
      const en = await enriquecerPessoaWiki(p.wiki);
      const vices = await mapComLimite(p.vices || [], 5, async (v) => {
        const ven = await enriquecerPessoaWiki(v.wiki);
        return {
          nome: v.nome,
          periodo: v.periodo || "",
          foto: ven.foto,
          bio: ven.bio,
          url: ven.url,
        };
      });

      res.json({
        id: p.id,
        ordem: p.ordem,
        nome: p.nome,
        partido: p.partido || "—",
        era: p.era,
        tipo: p.tipo || "presidente",
        inicio: p.inicio,
        fim: p.fim || null,
        obs: p.obs || "",
        espectro: p.espectro || "",
        resumo: p.resumo || "",
        feitos: Array.isArray(p.feitos) ? p.feitos : [],
        escandalos: Array.isArray(p.escandalos) ? p.escandalos : [],
        foto: en.foto,
        bio: en.bio,
        url: en.url,
        vices,
        atualizadoEm: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[transparencia] presidente detalhe:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar o presidente." });
    }
  });

  app.get("/api/transparencia/mencoes", (req, res) => {
    try {
      res.json({
        mencoes: coletarMencoesIndex(),
        atualizadoEm: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[transparencia] mencoes:", err.message);
      res.status(502).json({ erro: "Não foi possível carregar as menções." });
    }
  });
};
