const { readWebEvidence } = require("./src/server/services/readWebEvidence.js");

async function run() {
  const resultado = await readWebEvidence([
    {
      url: "https://g1.globo.com/politica/noticia/2026/05/15/pgr-denuncia-romeu-zema-por-calunia-contra-ministro-gilmar-mendes.ghtml",
    },
  ]);
  console.log(JSON.stringify(resultado, null, 2));
}

run().catch((err) => {
  console.error("Erro no teste readWebEvidence:", err);
  process.exit(1);
});
