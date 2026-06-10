// data/presidentes.js
// Lista curada de TODOS os chefes de Estado do Brasil desde a Proclamação da
// República (1889) até hoje, com seus vice-presidentes. É o "esqueleto" de
// dados (sempre presente, versionado no código); o servidor tenta enriquecer
// cada nome com foto/biografia via API REST do Wikipédia (pt).
//
// Cada presidente traz, além de período/partido/vices:
//   resumo     – quem foi e o que marcou seu governo (1–2 frases);
//   feitos[]   – principais realizações/marcos do governo;
//   escandalos[] – escândalos, crises e polêmicas mais documentados.
// Conteúdo factual e neutro, baseado em fatos públicos amplamente registrados.
//
// Períodos conferidos com as listas oficiais de presidentes e de
// vice-presidentes do Brasil. Campo `wiki` = título do artigo na Wikipédia.

const PRESIDENTES = [
  // ─── República Velha (1889–1930) ───────────────────────────────────────────
  {
    id: "deodoro-da-fonseca",
    ordem: 1,
    nome: "Deodoro da Fonseca",
    partido: "—",
    era: "República Velha (1889–1930)",
    inicio: "1889-11-15",
    fim: "1891-11-23",
    wiki: "Deodoro da Fonseca",
    obs: "Proclamador da República; primeiro presidente.",
    resumo:
      "Marechal do Exército, liderou a Proclamação da República em 1889 e tornou-se o primeiro presidente do Brasil.",
    feitos: [
      "Proclamou a República em 15 de novembro de 1889, encerrando a Monarquia.",
      "Sob seu governo foi promulgada a primeira Constituição republicana (1891).",
    ],
    escandalos: [
      "Dissolveu o Congresso Nacional em novembro de 1891, num golpe que gerou forte reação.",
      "Renunciou sob pressão militar após a eclosão da Revolta da Armada.",
    ],
    vices: [
      { nome: "Floriano Peixoto", wiki: "Floriano Peixoto", periodo: "1891–1891" },
    ],
  },
  {
    id: "floriano-peixoto",
    ordem: 2,
    nome: "Floriano Peixoto",
    partido: "—",
    era: "República Velha (1889–1930)",
    inicio: "1891-11-23",
    fim: "1894-11-15",
    wiki: "Floriano Peixoto",
    obs: "Assumiu como vice; conhecido como o \"Marechal de Ferro\".",
    resumo:
      "Vice que assumiu após a renúncia de Deodoro; consolidou o regime republicano com mão firme, o que lhe rendeu o apelido de \"Marechal de Ferro\".",
    feitos: [
      "Consolidou a República em seus anos iniciais.",
      "Reprimiu a Revolta da Armada e a Revolução Federalista.",
    ],
    escandalos: [
      "Governo marcado por autoritarismo e repressão a opositores.",
      "Permaneceu no poder sem convocar novas eleições, gerando questionamentos de legitimidade.",
    ],
    vices: [],
  },
  {
    id: "prudente-de-morais",
    ordem: 3,
    nome: "Prudente de Morais",
    partido: "PR Federal",
    era: "República Velha (1889–1930)",
    inicio: "1894-11-15",
    fim: "1898-11-15",
    wiki: "Prudente de Morais",
    obs: "Primeiro presidente civil.",
    resumo:
      "Advogado paulista, foi o primeiro presidente civil do país, iniciando a chamada República das Oligarquias.",
    feitos: [
      "Primeiro presidente civil do Brasil.",
      "Conduziu o país durante a Guerra de Canudos (1896–1897).",
    ],
    escandalos: [
      "Sofreu um atentado em 1897, no qual morreu o ministro Marechal Bittencourt ao protegê-lo.",
    ],
    vices: [
      { nome: "Manuel Vitorino", wiki: "Manuel Vitorino", periodo: "1894–1898" },
    ],
  },
  {
    // Vice de Prudente de Morais (ordem 3) que exerceu a Presidência
    // interinamente; não consta na lista oficial numerada de presidentes.
    id: "manuel-vitorino",
    ordem: 3,
    nome: "Manuel Vitorino",
    partido: "PR Federal",
    tipo: "interino",
    era: "República Velha (1889–1930)",
    inicio: "1896-11-10",
    fim: "1897-03-04",
    wiki: "Manuel Vitorino",
    obs: "Exerceu interinamente a Presidência durante o mandato de Prudente de Morais.",
    resumo:
      "Médico e político baiano, vice de Prudente de Morais; assumiu interinamente em 1896–1897 enquanto o titular se recuperava de uma cirurgia.",
    feitos: [
      "Exerceu a Presidência interinamente durante a recuperação de Prudente de Morais.",
    ],
    escandalos: [
      "Aproveitou o interinato para promover mudanças políticas e administrativas, gerando atrito com Prudente de Morais ao seu retorno.",
    ],
    vices: [],
  },
  {
    id: "campos-sales",
    ordem: 4,
    nome: "Campos Sales",
    partido: "PRP",
    era: "República Velha (1889–1930)",
    inicio: "1898-11-15",
    fim: "1902-11-15",
    wiki: "Campos Sales",
    resumo:
      "Cafeicultor e político paulista, criou o arranjo que sustentou a República Velha e saneou as finanças do país.",
    feitos: [
      "Criou a \"política dos governadores\", base da articulação política da República Velha.",
      "Saneou as finanças com o funding loan e estabilizou a economia.",
    ],
    escandalos: [
      "A \"política dos governadores\" é criticada por consolidar o coronelismo e as fraudes eleitorais.",
    ],
    vices: [
      {
        nome: "Rosa e Silva",
        wiki: "Francisco de Assis Rosa e Silva",
        periodo: "1898–1902",
      },
    ],
  },
  {
    id: "rodrigues-alves",
    ordem: 5,
    nome: "Rodrigues Alves",
    partido: "PRP",
    era: "República Velha (1889–1930)",
    inicio: "1902-11-15",
    fim: "1906-11-15",
    wiki: "Rodrigues Alves",
    obs: "Eleito novamente em 1918, faleceu antes de tomar posse.",
    resumo:
      "Político paulista que modernizou e saneou o Rio de Janeiro, então capital. Reeleito em 1918, morreu antes de assumir o segundo mandato.",
    feitos: [
      "Promoveu a reforma urbana do Rio de Janeiro com o prefeito Pereira Passos.",
      "Apoiou Oswaldo Cruz no combate à febre amarela e à peste.",
    ],
    escandalos: [
      "A vacinação obrigatória contra a varíola provocou a Revolta da Vacina (1904).",
    ],
    vices: [
      { nome: "Afonso Pena", wiki: "Afonso Pena", periodo: "1903–1906" },
    ],
  },
  {
    id: "afonso-pena",
    ordem: 6,
    nome: "Afonso Pena",
    partido: "PRM",
    era: "República Velha (1889–1930)",
    inicio: "1906-11-15",
    fim: "1909-06-14",
    wiki: "Afonso Pena",
    obs: "Faleceu no exercício do cargo.",
    resumo:
      "Mineiro, investiu em infraestrutura e imigração; faleceu no exercício do cargo, em 1909.",
    feitos: [
      "Investiu em estradas de ferro e infraestrutura.",
      "Estimulou a imigração e a economia cafeeira (Convênio de Taubaté).",
    ],
    escandalos: [],
    vices: [
      { nome: "Nilo Peçanha", wiki: "Nilo Peçanha", periodo: "1906–1909" },
    ],
  },
  {
    id: "nilo-pecanha",
    ordem: 7,
    nome: "Nilo Peçanha",
    partido: "PRF",
    era: "República Velha (1889–1930)",
    inicio: "1909-06-14",
    fim: "1910-11-15",
    wiki: "Nilo Peçanha",
    resumo:
      "Vice que assumiu após a morte de Afonso Pena; ficou marcado pela criação do ensino técnico federal.",
    feitos: [
      "Concluiu o mandato de Afonso Pena.",
      "Criou as primeiras escolas técnicas federais (1909), origem dos atuais Institutos Federais.",
    ],
    escandalos: [],
    vices: [],
  },
  {
    id: "hermes-da-fonseca",
    ordem: 8,
    nome: "Hermes da Fonseca",
    partido: "PRC",
    era: "República Velha (1889–1930)",
    inicio: "1910-11-15",
    fim: "1914-11-15",
    wiki: "Hermes da Fonseca",
    resumo:
      "Marechal e sobrinho de Deodoro; seu governo foi conturbado por revoltas e por intervenções políticas nos estados.",
    feitos: ["Promoveu a reorganização e modernização das Forças Armadas."],
    escandalos: [
      "A \"Política das Salvações\" interveio em governos estaduais, gerando conflitos.",
      "Governo marcado pela Revolta da Chibata (1910) e pela Guerra do Contestado.",
    ],
    vices: [
      { nome: "Venceslau Brás", wiki: "Venceslau Brás", periodo: "1910–1914" },
    ],
  },
  {
    id: "venceslau-bras",
    ordem: 9,
    nome: "Venceslau Brás",
    partido: "PRM",
    era: "República Velha (1889–1930)",
    inicio: "1914-11-15",
    fim: "1918-11-15",
    wiki: "Venceslau Brás",
    resumo:
      "Mineiro, governou durante a Primeira Guerra Mundial e consolidou marcos legais importantes.",
    feitos: [
      "Sancionou o primeiro Código Civil brasileiro (1916).",
      "Declarou guerra às Potências Centrais na Primeira Guerra Mundial (1917).",
    ],
    escandalos: [],
    vices: [
      { nome: "Urbano Santos", wiki: "Urbano Santos", periodo: "1914–1918" },
    ],
  },
  {
    id: "delfim-moreira",
    ordem: 10,
    nome: "Delfim Moreira",
    partido: "PRM",
    era: "República Velha (1889–1930)",
    inicio: "1918-11-15",
    fim: "1919-07-28",
    wiki: "Delfim Moreira",
    obs: "Vice que assumiu por morte do presidente eleito Rodrigues Alves.",
    resumo:
      "Vice que assumiu interinamente porque o presidente eleito, Rodrigues Alves, faleceu antes de tomar posse. Tinha a saúde debilitada.",
    feitos: ["Garantiu a transição até a eleição extraordinária de Epitácio Pessoa."],
    escandalos: [
      "Governo marcado por sua saúde frágil, com auxiliares conduzindo grande parte das decisões.",
    ],
    vices: [],
  },
  {
    id: "epitacio-pessoa",
    ordem: 11,
    nome: "Epitácio Pessoa",
    partido: "PRM",
    era: "República Velha (1889–1930)",
    inicio: "1919-07-28",
    fim: "1922-11-15",
    wiki: "Epitácio Pessoa",
    resumo:
      "Paraibano, foi o primeiro presidente nascido no Nordeste; deu atenção ao combate à seca e à projeção externa do país.",
    feitos: [
      "Iniciou grandes obras de combate à seca no Nordeste.",
      "Chefiou a delegação brasileira na Conferência de Paz de Paris (1919).",
    ],
    escandalos: [
      "Entrou em crise com os militares ao nomear civis para os ministérios da Guerra e da Marinha.",
    ],
    vices: [
      { nome: "Delfim Moreira", wiki: "Delfim Moreira", periodo: "1918–1920" },
      { nome: "Bueno de Paiva", wiki: "Bueno de Paiva", periodo: "1920–1922" },
    ],
  },
  {
    id: "artur-bernardes",
    ordem: 12,
    nome: "Artur Bernardes",
    partido: "PRM",
    era: "República Velha (1889–1930)",
    inicio: "1922-11-15",
    fim: "1926-11-15",
    wiki: "Artur Bernardes",
    resumo:
      "Mineiro, governou quase todo o mandato sob estado de sítio, em meio às revoltas tenentistas.",
    feitos: ["Promoveu uma reforma constitucional em 1926, ampliando poderes do Executivo."],
    escandalos: [
      "Governou quase todo o mandato sob estado de sítio.",
      "Envolveu-se na crise das \"cartas falsas\" a ele atribuídas, que ofendiam o Exército.",
      "Reprimiu o tenentismo (Revolta de 1924 e Coluna Prestes).",
    ],
    vices: [
      { nome: "Estácio Coimbra", wiki: "Estácio Coimbra", periodo: "1922–1926" },
    ],
  },
  {
    id: "washington-luis",
    ordem: 13,
    nome: "Washington Luís",
    partido: "PRP",
    era: "República Velha (1889–1930)",
    inicio: "1926-11-15",
    fim: "1930-10-24",
    wiki: "Washington Luís",
    obs: "Deposto pela Revolução de 1930.",
    resumo:
      "Último presidente da República Velha; sua tentativa de impor um sucessor paulista rompeu o pacto oligárquico e desencadeou a Revolução de 1930.",
    feitos: [
      "Fez uma reforma monetária e investiu em rodovias (lema \"governar é abrir estradas\").",
    ],
    escandalos: [
      "Rompeu a política do \"café com leite\" ao indicar o paulista Júlio Prestes, em vez de um mineiro.",
      "Foi deposto pela Revolução de 1930, encerrando a República Velha.",
    ],
    vices: [
      {
        nome: "Fernando de Melo Viana",
        wiki: "Fernando de Melo Viana",
        periodo: "1926–1930",
      },
    ],
  },
  {
    id: "junta-1930",
    ordem: 14,
    nome: "Junta Governativa de 1930",
    partido: "—",
    tipo: "junta",
    era: "República Velha (1889–1930)",
    inicio: "1930-10-24",
    fim: "1930-11-03",
    wiki: "Junta Governativa Provisória de 1930",
    obs: "Governo colegiado de transição até a posse de Getúlio Vargas.",
    resumo:
      "Junta militar provisória que governou entre a deposição de Washington Luís e a posse de Getúlio Vargas.",
    feitos: ["Conduziu a transição até a posse de Getúlio Vargas."],
    escandalos: [],
    vices: [],
  },

  // ─── Era Vargas (1930–1945) ────────────────────────────────────────────────
  {
    id: "getulio-vargas-1",
    ordem: 15,
    nome: "Getúlio Vargas",
    partido: "—",
    era: "Era Vargas (1930–1945)",
    inicio: "1930-11-03",
    fim: "1945-10-30",
    wiki: "Getúlio Vargas",
    obs: "Governo Provisório, Constitucional e Estado Novo; deposto em 1945.",
    resumo:
      "Gaúcho, foi a figura central da política brasileira no século XX. Governou 15 anos seguidos, incluindo a ditadura do Estado Novo, com forte legado trabalhista e industrial.",
    feitos: [
      "Criou a CLT e a legislação trabalhista, o salário mínimo e a Justiça do Trabalho.",
      "Impulsionou a industrialização (Companhia Siderúrgica Nacional, Vale do Rio Doce).",
      "Instituiu o voto secreto e o voto feminino (Código Eleitoral de 1932).",
    ],
    escandalos: [
      "Implantou a ditadura do Estado Novo (1937), justificada pelo falso \"Plano Cohen\".",
      "Manteve censura (DIP) e repressão política, com perseguição e tortura de opositores.",
      "Foi deposto pelos militares em 1945.",
    ],
    vices: [],
  },
  {
    id: "jose-linhares",
    ordem: 16,
    nome: "José Linhares",
    partido: "—",
    era: "Era Vargas (1930–1945)",
    inicio: "1945-10-30",
    fim: "1946-01-31",
    wiki: "José Linhares",
    obs: "Presidente do STF; assumiu interinamente após a saída de Vargas.",
    resumo:
      "Presidente do Supremo Tribunal Federal que assumiu interinamente após a deposição de Vargas, conduzindo a redemocratização.",
    feitos: ["Conduziu a transição democrática até a posse de Eurico Gaspar Dutra."],
    escandalos: [],
    vices: [],
  },

  // ─── República Populista (1946–1964) ───────────────────────────────────────
  {
    id: "gaspar-dutra",
    ordem: 17,
    nome: "Eurico Gaspar Dutra",
    partido: "PSD",
    era: "República Populista (1946–1964)",
    inicio: "1946-01-31",
    fim: "1951-01-31",
    wiki: "Eurico Gaspar Dutra",
    resumo:
      "General eleito com apoio de Vargas; consolidou a redemocratização do pós-guerra, mas com forte anticomunismo.",
    feitos: [
      "Promulgou a Constituição democrática de 1946.",
      "Construiu a rodovia Presidente Dutra (Rio–São Paulo) e a hidrelétrica de Paulo Afonso.",
    ],
    escandalos: [
      "Cassou o registro do Partido Comunista (PCB) e os mandatos de seus parlamentares (1947).",
      "Rompeu relações diplomáticas com a União Soviética.",
    ],
    vices: [
      { nome: "Nereu Ramos", wiki: "Nereu Ramos", periodo: "1946–1951" },
    ],
  },
  {
    id: "getulio-vargas-2",
    ordem: 18,
    nome: "Getúlio Vargas",
    partido: "PTB",
    era: "República Populista (1946–1964)",
    inicio: "1951-01-31",
    fim: "1954-08-24",
    wiki: "Getúlio Vargas",
    obs: "Eleito presidente; faleceu no exercício do cargo.",
    resumo:
      "De volta ao poder pelo voto, conduziu uma política nacionalista; cercado por uma crise política, suicidou-se no Palácio do Catete.",
    feitos: [
      "Criou a Petrobras (1953), com a campanha \"O petróleo é nosso\".",
      "Lançou as bases da Eletrobras e do BNDE.",
    ],
    escandalos: [
      "Atentado da Rua Tonelero contra Carlos Lacerda, que matou o major Rubens Vaz.",
      "Pressionado a renunciar, suicidou-se em 24 de agosto de 1954.",
    ],
    vices: [
      { nome: "Café Filho", wiki: "Café Filho", periodo: "1951–1954" },
    ],
  },
  {
    id: "cafe-filho",
    ordem: 19,
    nome: "Café Filho",
    partido: "PSP",
    era: "República Populista (1946–1964)",
    inicio: "1954-08-24",
    fim: "1955-11-08",
    wiki: "Café Filho",
    resumo:
      "Vice que assumiu após o suicídio de Vargas; afastado por problemas de saúde em meio à crise política de 1955.",
    feitos: ["Assumiu após o suicídio de Vargas e conduziu o país rumo à eleição de 1955."],
    escandalos: [
      "Afastado durante a crise político-militar de novembro de 1955 e impedido de retomar o cargo.",
    ],
    vices: [],
  },
  {
    id: "carlos-luz",
    ordem: 20,
    nome: "Carlos Luz",
    partido: "PSD",
    era: "República Populista (1946–1964)",
    inicio: "1955-11-08",
    fim: "1955-11-11",
    wiki: "Carlos Luz",
    obs: "Presidente da Câmara; mandato mais curto da história (3 dias).",
    resumo:
      "Presidente da Câmara que assumiu por apenas três dias — o mandato mais curto da história do país.",
    feitos: [],
    escandalos: [
      "Deposto pelo movimento militar liderado por Henrique Teixeira Lott (o \"Contragolpe Preventivo\" de 1955).",
    ],
    vices: [],
  },
  {
    id: "nereu-ramos",
    ordem: 21,
    nome: "Nereu Ramos",
    partido: "PSD",
    era: "República Populista (1946–1964)",
    inicio: "1955-11-11",
    fim: "1956-01-31",
    wiki: "Nereu Ramos",
    resumo:
      "Vice do Senado que assumiu após o afastamento de Carlos Luz, garantindo a posse de Juscelino Kubitschek.",
    feitos: ["Garantiu a posse do presidente eleito Juscelino Kubitschek."],
    escandalos: ["Governou sob estado de sítio durante a crise política de 1955."],
    vices: [],
  },
  {
    id: "juscelino-kubitschek",
    ordem: 22,
    nome: "Juscelino Kubitschek",
    partido: "PSD",
    era: "República Populista (1946–1964)",
    inicio: "1956-01-31",
    fim: "1961-01-31",
    wiki: "Juscelino Kubitschek",
    obs: "Construtor de Brasília.",
    resumo:
      "Mineiro e médico, ficou conhecido por construir Brasília e por um período de otimismo e desenvolvimentismo (\"50 anos em 5\").",
    feitos: [
      "Construiu Brasília e transferiu a capital para o Planalto Central (1960).",
      "Plano de Metas com o lema \"50 anos em 5\"; implantou a indústria automobilística.",
      "Período de forte crescimento econômico e efervescência cultural (Bossa Nova).",
    ],
    escandalos: [
      "Crescimento da inflação e da dívida externa para financiar as obras.",
      "Acusações de corrupção nas obras de Brasília, nunca comprovadas judicialmente.",
    ],
    vices: [
      { nome: "João Goulart", wiki: "João Goulart", periodo: "1956–1961" },
    ],
  },
  {
    id: "janio-quadros",
    ordem: 23,
    nome: "Jânio Quadros",
    partido: "PTN",
    era: "República Populista (1946–1964)",
    inicio: "1961-01-31",
    fim: "1961-08-25",
    wiki: "Jânio Quadros",
    obs: "Renunciou após sete meses de governo.",
    resumo:
      "Eleito com votação recorde prometendo moralizar a administração; renunciou de forma surpreendente após apenas sete meses.",
    feitos: [
      "Eleito com ampla votação, tendo a vassoura como símbolo do combate à corrupção.",
      "Adotou uma política externa independente.",
    ],
    escandalos: [
      "Condecorou Che Guevara, gerando forte crise com setores conservadores.",
      "Renunciou em agosto de 1961 alegando pressão de \"forças ocultas\".",
    ],
    vices: [
      { nome: "João Goulart", wiki: "João Goulart", periodo: "1961" },
    ],
  },
  {
    id: "ranieri-mazzilli-1",
    ordem: 24,
    nome: "Ranieri Mazzilli",
    partido: "PSD",
    tipo: "interino",
    era: "República Populista (1946–1964)",
    inicio: "1961-08-25",
    fim: "1961-09-08",
    wiki: "Ranieri Mazzilli",
    obs: "Presidente da Câmara; interino após a renúncia de Jânio.",
    resumo:
      "Presidente da Câmara que assumiu interinamente após a renúncia de Jânio Quadros, em meio à crise da sucessão.",
    feitos: ["Exerceu o cargo durante a crise de sucessão de 1961."],
    escandalos: [
      "Período marcado pelo veto militar à posse de João Goulart, que resultou na adoção do parlamentarismo.",
    ],
    vices: [],
  },
  {
    id: "joao-goulart",
    ordem: 25,
    nome: "João Goulart",
    partido: "PTB",
    era: "República Populista (1946–1964)",
    inicio: "1961-09-08",
    fim: "1964-04-02",
    wiki: "João Goulart",
    obs: "Deposto pelo golpe militar de 1964.",
    resumo:
      "Conhecido como Jango, defendeu as Reformas de Base; foi deposto pelo golpe militar de 1964, que iniciou a ditadura.",
    feitos: [
      "Propôs as Reformas de Base (agrária, urbana, educacional, eleitoral).",
      "Restaurou o presidencialismo por meio de plebiscito (1963).",
    ],
    escandalos: [
      "Acusado por setores conservadores de inclinação comunista.",
      "Deposto pelo golpe militar de 1964 e forçado ao exílio.",
    ],
    vices: [],
  },

  // ─── Ditadura Militar (1964–1985) ──────────────────────────────────────────
  {
    id: "ranieri-mazzilli-2",
    ordem: 26,
    nome: "Ranieri Mazzilli",
    partido: "PSD",
    tipo: "interino",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1964-04-02",
    fim: "1964-04-15",
    wiki: "Ranieri Mazzilli",
    obs: "Interino logo após o golpe de 1964.",
    resumo:
      "Voltou a assumir interinamente logo após o golpe de 1964, até a eleição indireta de Castelo Branco.",
    feitos: [],
    escandalos: [
      "Governou já sob o Ato Institucional nº 1, que cassou mandatos e suspendeu direitos políticos.",
    ],
    vices: [],
  },
  {
    id: "castelo-branco",
    ordem: 27,
    nome: "Humberto Castelo Branco",
    partido: "ARENA",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1964-04-15",
    fim: "1967-03-15",
    wiki: "Humberto de Alencar Castelo Branco",
    resumo:
      "Primeiro general-presidente da ditadura militar; institucionalizou o novo regime e fez reformas econômicas.",
    feitos: [
      "Criou o Banco Central do Brasil e o BNH; reformou o sistema bancário e tributário.",
    ],
    escandalos: [
      "Editou os Atos Institucionais nº 1 e nº 2, com cassações, fim dos partidos e eleições indiretas.",
      "Deu início à estrutura repressiva da ditadura militar.",
    ],
    vices: [
      {
        nome: "José Maria Alkmin",
        wiki: "José Maria Alkmin",
        periodo: "1964–1967",
      },
    ],
  },
  {
    id: "costa-e-silva",
    ordem: 28,
    nome: "Costa e Silva",
    partido: "ARENA",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1967-03-15",
    fim: "1969-08-31",
    wiki: "Artur da Costa e Silva",
    obs: "Afastado por doença; substituído por uma junta militar.",
    resumo:
      "Segundo general-presidente; sob seu governo a ditadura atingiu o ápice do autoritarismo com o AI-5.",
    feitos: ["Governo iniciou um período de crescimento econômico."],
    escandalos: [
      "Decretou o AI-5 (1968), o ato mais duro da ditadura, fechando o Congresso e suspendendo garantias.",
      "Endurecimento da repressão, da censura e da perseguição política.",
    ],
    vices: [
      { nome: "Pedro Aleixo", wiki: "Pedro Aleixo", periodo: "1967–1969" },
    ],
  },
  {
    id: "junta-1969",
    ordem: 29,
    nome: "Junta Militar de 1969",
    partido: "—",
    tipo: "junta",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1969-08-31",
    fim: "1969-10-30",
    wiki: "Junta Governativa Provisória de 1969",
    obs: "Junta militar que impediu a posse do vice Pedro Aleixo.",
    resumo:
      "Junta de três ministros militares que governou após o AVC de Costa e Silva, impedindo a posse do vice civil Pedro Aleixo.",
    feitos: [],
    escandalos: [
      "Impôs a Lei de Segurança Nacional e a pena de morte, recrudescendo a repressão.",
    ],
    vices: [],
  },
  {
    id: "medici",
    ordem: 30,
    nome: "Emílio Garrastazu Médici",
    partido: "ARENA",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1969-10-30",
    fim: "1974-03-15",
    wiki: "Emílio Garrastazu Médici",
    resumo:
      "Governo do \"milagre econômico\" e, ao mesmo tempo, dos \"anos de chumbo\", o auge da repressão da ditadura.",
    feitos: [
      "\"Milagre econômico\", com altas taxas de crescimento do PIB.",
      "Grandes obras (Transamazônica) e uso do tricampeonato de 1970 como propaganda.",
    ],
    escandalos: [
      "Auge da repressão, da tortura e dos desaparecimentos políticos (\"anos de chumbo\").",
      "Forte censura à imprensa e às artes; aumento da concentração de renda.",
    ],
    vices: [
      {
        nome: "Augusto Rademaker",
        wiki: "Augusto Rademaker",
        periodo: "1969–1974",
      },
    ],
  },
  {
    id: "geisel",
    ordem: 31,
    nome: "Ernesto Geisel",
    partido: "ARENA",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1974-03-15",
    fim: "1979-03-15",
    wiki: "Ernesto Geisel",
    resumo:
      "Iniciou a distensão do regime, prometendo uma abertura política \"lenta, gradual e segura\", ainda em meio à repressão.",
    feitos: [
      "Iniciou a abertura política \"lenta, gradual e segura\".",
      "Firmou o Acordo Nuclear Brasil–Alemanha e lançou o Proálcool.",
    ],
    escandalos: [
      "Mortes sob tortura durante seu governo, como a do jornalista Vladimir Herzog (1975).",
      "Editou o \"Pacote de Abril\" (1977), fechando o Congresso para manter o controle político.",
    ],
    vices: [
      {
        nome: "Adalberto Pereira dos Santos",
        wiki: "Adalberto Pereira dos Santos",
        periodo: "1974–1979",
      },
    ],
  },
  {
    id: "figueiredo",
    ordem: 32,
    nome: "João Figueiredo",
    partido: "ARENA / PDS",
    era: "Ditadura Militar (1964–1985)",
    inicio: "1979-03-15",
    fim: "1985-03-15",
    wiki: "João Figueiredo",
    obs: "Último presidente do regime militar.",
    resumo:
      "Último presidente da ditadura; conduziu a fase final da abertura política, em meio a forte crise econômica.",
    feitos: [
      "Sancionou a Lei da Anistia (1979).",
      "Restabeleceu o pluripartidarismo e as eleições diretas para governador (1982).",
    ],
    escandalos: [
      "Atentado do Riocentro (1981), atribuído a setores militares contrários à abertura.",
      "Inflação alta, recessão e crise da dívida no fim do regime.",
    ],
    vices: [
      { nome: "Aureliano Chaves", wiki: "Aureliano Chaves", periodo: "1979–1985" },
    ],
  },

  // ─── Nova República (1985–presente) ────────────────────────────────────────
  {
    id: "sarney",
    ordem: 33,
    nome: "José Sarney",
    partido: "PMDB",
    era: "Nova República (1985–presente)",
    inicio: "1985-03-15",
    fim: "1990-03-15",
    wiki: "José Sarney",
    obs: "Eleito vice de Tancredo Neves, que faleceu antes de tomar posse.",
    resumo:
      "Assumiu como vice porque o presidente eleito Tancredo Neves morreu antes da posse; comandou a transição democrática e a Constituinte.",
    feitos: [
      "Conduziu a transição democrática e convocou a Assembleia Constituinte de 1988.",
      "Lançou o Plano Cruzado (1986) na tentativa de conter a hiperinflação.",
    ],
    escandalos: [
      "Fracasso sucessivo dos planos econômicos e disparada da hiperinflação.",
      "Acusações de clientelismo e de troca de favores para ampliar seu mandato de 4 para 5 anos.",
    ],
    vices: [],
  },
  {
    id: "collor",
    ordem: 34,
    nome: "Fernando Collor",
    partido: "PRN",
    era: "Nova República (1985–presente)",
    inicio: "1990-03-15",
    fim: "1992-12-29",
    wiki: "Fernando Collor",
    obs: "Renunciou durante o processo de impeachment.",
    resumo:
      "Primeiro presidente eleito por voto direto após a ditadura; caiu no primeiro impeachment da história do país por corrupção.",
    feitos: [
      "Primeiro presidente eleito por voto direto após a ditadura militar.",
      "Promoveu a abertura comercial e iniciou o programa de privatizações.",
    ],
    escandalos: [
      "O Plano Collor confiscou a poupança e os recursos da população.",
      "Esquema de corrupção comandado por PC Farias; sofreu impeachment e renunciou em 1992.",
    ],
    vices: [
      { nome: "Itamar Franco", wiki: "Itamar Franco", periodo: "1990–1992" },
    ],
  },
  {
    id: "itamar-franco",
    ordem: 35,
    nome: "Itamar Franco",
    partido: "—",
    era: "Nova República (1985–presente)",
    inicio: "1992-12-29",
    fim: "1995-01-01",
    wiki: "Itamar Franco",
    obs: "Vice que assumiu após o impeachment de Collor.",
    resumo:
      "Vice mineiro que assumiu após a queda de Collor; seu governo é lembrado por estabilizar a economia com o Plano Real.",
    feitos: [
      "Lançou o Plano Real (1994), que estabilizou a moeda e debelou a hiperinflação.",
      "Recuperou a estabilidade institucional após o impeachment.",
    ],
    escandalos: [
      "Episódio de repercussão na imprensa envolvendo uma modelo sem roupa íntima ao seu lado no carnaval.",
    ],
    vices: [],
  },
  {
    id: "fhc",
    ordem: 36,
    nome: "Fernando Henrique Cardoso",
    partido: "PSDB",
    era: "Nova República (1985–presente)",
    inicio: "1995-01-01",
    fim: "2003-01-01",
    wiki: "Fernando Henrique Cardoso",
    resumo:
      "Sociólogo e ministro do Plano Real, governou oito anos consolidando a estabilidade econômica e as privatizações.",
    feitos: [
      "Consolidou o Plano Real e o controle da inflação.",
      "Privatizações (telecomunicações, siderurgia) e a Lei de Responsabilidade Fiscal (2000).",
      "Programas sociais como o Bolsa Escola.",
    ],
    escandalos: [
      "Acusações de compra de votos para aprovar a emenda da reeleição.",
      "Crise cambial de 1999, com desvalorização do real e aumento do desemprego.",
    ],
    vices: [
      { nome: "Marco Maciel", wiki: "Marco Maciel", periodo: "1995–2003" },
    ],
  },
  {
    id: "lula-1",
    ordem: 37,
    nome: "Luiz Inácio Lula da Silva",
    partido: "PT",
    era: "Nova República (1985–presente)",
    inicio: "2003-01-01",
    fim: "2011-01-01",
    wiki: "Luiz Inácio Lula da Silva",
    resumo:
      "Ex-metalúrgico e sindicalista, foi o primeiro presidente operário; seus dois mandatos combinaram programas sociais e crescimento econômico, marcados também por escândalos de corrupção.",
    feitos: [
      "Bolsa Família, ProUni e forte expansão de universidades e institutos federais.",
      "Crescimento econômico, queda da pobreza e valorização do salário mínimo.",
      "Descoberta do pré-sal; Brasil deixou o Mapa da Fome da ONU.",
    ],
    escandalos: [
      "Escândalo do Mensalão (2005), esquema de compra de apoio parlamentar.",
      "Posteriormente, condenações e prisão na Lava Jato — anuladas pelo STF em 2021.",
    ],
    vices: [
      {
        nome: "José Alencar",
        wiki: "José Alencar Gomes da Silva",
        periodo: "2003–2011",
      },
    ],
  },
  {
    id: "dilma",
    ordem: 38,
    nome: "Dilma Rousseff",
    partido: "PT",
    era: "Nova República (1985–presente)",
    inicio: "2011-01-01",
    fim: "2016-08-31",
    wiki: "Dilma Rousseff",
    obs: "Primeira mulher presidente; afastada por impeachment.",
    resumo:
      "Primeira mulher a presidir o Brasil; reeleita em 2014, sofreu impeachment em 2016 em meio à recessão e à crise política.",
    feitos: [
      "Programas Minha Casa Minha Vida e Mais Médicos.",
      "Manteve e ampliou programas sociais herdados do governo anterior.",
    ],
    escandalos: [
      "As \"pedaladas fiscais\" embasaram o processo de impeachment que a afastou em 2016.",
      "Operação Lava Jato e forte recessão econômica durante o mandato.",
    ],
    vices: [
      { nome: "Michel Temer", wiki: "Michel Temer", periodo: "2011–2016" },
    ],
  },
  {
    id: "temer",
    ordem: 39,
    nome: "Michel Temer",
    partido: "MDB",
    era: "Nova República (1985–presente)",
    inicio: "2016-08-31",
    fim: "2019-01-01",
    wiki: "Michel Temer",
    obs: "Vice que assumiu após o impeachment de Dilma Rousseff.",
    resumo:
      "Vice que assumiu após o impeachment de Dilma; governou com agenda de reformas econômicas e baixa popularidade.",
    feitos: [
      "Aprovou a reforma trabalhista e o teto de gastos públicos (EC 95).",
    ],
    escandalos: [
      "Gravação com o empresário Joesley Batista (JBS) e denúncias de corrupção.",
      "Chegou a ser preso preventivamente após o fim do mandato, no âmbito da Lava Jato.",
    ],
    vices: [],
  },
  {
    id: "bolsonaro",
    ordem: 40,
    nome: "Jair Bolsonaro",
    partido: "PSL / PL",
    era: "Nova República (1985–presente)",
    inicio: "2019-01-01",
    fim: "2023-01-01",
    wiki: "Jair Bolsonaro",
    resumo:
      "Ex-capitão e deputado de longa data, elegeu-se com discurso de direita; seu governo foi marcado pela pandemia de COVID-19 e por tensões institucionais.",
    feitos: [
      "Aprovou a reforma da Previdência (2019) e pagou o Auxílio Emergencial na pandemia.",
      "Marco legal do saneamento e autonomia do Banco Central.",
    ],
    escandalos: [
      "Gestão da pandemia de COVID-19 alvo da CPI da Covid.",
      "Ataques recorrentes ao sistema eleitoral; alvo de diversas investigações.",
      "Caso das joias sauditas recebidas como presente oficial.",
    ],
    vices: [
      { nome: "Hamilton Mourão", wiki: "Hamilton Mourão", periodo: "2019–2023" },
    ],
  },
  {
    id: "lula-2",
    ordem: 41,
    nome: "Luiz Inácio Lula da Silva",
    partido: "PT",
    era: "Nova República (1985–presente)",
    inicio: "2023-01-01",
    fim: null,
    wiki: "Luiz Inácio Lula da Silva",
    obs: "Terceiro mandato (em exercício).",
    resumo:
      "Terceiro mandato de Lula, iniciado em 2023, com retomada de programas sociais e da agenda ambiental.",
    feitos: [
      "Retomou o Bolsa Família e programas sociais.",
      "Recriou ministérios e reforçou políticas ambientais e de combate ao desmatamento.",
    ],
    escandalos: ["Mandato em curso."],
    vices: [
      { nome: "Geraldo Alckmin", wiki: "Geraldo Alckmin", periodo: "2023–presente" },
    ],
  },
];

// Posição/espectro político geralmente ATRIBUÍDO a cada um (classificação
// usual em fontes históricas — não é um juízo definitivo). Para a República
// Velha, os rótulos esquerda/direita são anacrônicos, por isso usamos termos
// como "oligárquico"/"liberal-conservador".
const ESPECTRO = {
  "deodoro-da-fonseca": "Militar / positivista",
  "floriano-peixoto": "Militar / nacionalista",
  "prudente-de-morais": "Liberal-oligárquico",
  "manuel-vitorino": "Liberal-oligárquico",
  "campos-sales": "Liberal-conservador (oligárquico)",
  "rodrigues-alves": "Conservador (oligárquico)",
  "afonso-pena": "Liberal-oligárquico",
  "nilo-pecanha": "Liberal-oligárquico",
  "hermes-da-fonseca": "Militar",
  "venceslau-bras": "Oligárquico",
  "delfim-moreira": "Oligárquico",
  "epitacio-pessoa": "Oligárquico",
  "artur-bernardes": "Conservador (oligárquico)",
  "washington-luis": "Liberal-conservador (oligárquico)",
  "junta-1930": "Militar (provisório)",
  "getulio-vargas-1": "Nacionalista / autoritário (getulismo)",
  "jose-linhares": "Sem filiação (interino do Judiciário)",
  "gaspar-dutra": "Conservador / direita",
  "getulio-vargas-2": "Trabalhista / centro-esquerda (nacionalista)",
  "cafe-filho": "Direita liberal",
  "carlos-luz": "Centro-direita",
  "nereu-ramos": "Centro",
  "juscelino-kubitschek": "Centro / desenvolvimentista",
  "janio-quadros": "Direita populista (conservador)",
  "ranieri-mazzilli-1": "Centro",
  "joao-goulart": "Trabalhista / esquerda",
  "ranieri-mazzilli-2": "Centro",
  "castelo-branco": "Militar / direita",
  "costa-e-silva": "Militar / direita",
  "junta-1969": "Militar / direita",
  medici: "Militar / direita",
  geisel: "Militar / direita",
  figueiredo: "Militar / direita",
  sarney: "Centro-direita",
  collor: "Direita liberal",
  "itamar-franco": "Centro",
  fhc: "Centro / centro-direita (social-democracia)",
  "lula-1": "Esquerda",
  dilma: "Esquerda",
  temer: "Centro-direita",
  bolsonaro: "Direita",
  "lula-2": "Esquerda",
};

PRESIDENTES.forEach((p) => {
  p.espectro = ESPECTRO[p.id] || "";
});

module.exports = { PRESIDENTES };
