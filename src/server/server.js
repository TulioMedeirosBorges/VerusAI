// Ponto de entrada do servidor VerusAI. A lógica está separada por domínio:
//   db.js        → banco SQLite, tabelas e migrações
//   lib/         → helpers genéricos (utils) e envio de e-mail
//   services/    → regras de negócio (sessões, análises, feedback, selos,
//                  fontes, Google News, link preview, cache da transparência)
//   routes/      → rotas Express agrupadas por domínio
// O dotenv precisa carregar antes de tudo (lib/email.js lê env ao ser requerido).
require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Cria as tabelas/migrações e roda o backfill de metadados ao subir.
require("./db.js");
require("./services/analises/salvarAnalise.js");

const registrarRotasAuth = require("./routes/auth.js");
const registrarRotasAnalisar = require("./routes/analisar.js");
const registrarRotasChat = require("./routes/chat.js");
const registrarRotasSite = require("./routes/site.js");
const registrarRotasFeedback = require("./routes/feedback.js");
const registrarRotasUsuarios = require("./routes/usuarios.js");
const registrarRotasFontes = require("./routes/fontes.js");
const registrarRotasAnalises = require("./routes/analises.js");
const registrarRotasNoticias = require("./routes/noticias.js");
const registrarRotasTransparencia = require("./routes/transparencia.js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

registrarRotasAuth(app);
registrarRotasAnalisar(app);
registrarRotasChat(app);
registrarRotasSite(app);
registrarRotasFeedback(app);
registrarRotasUsuarios(app);
registrarRotasFontes(app);
registrarRotasAnalises(app);
registrarRotasNoticias(app);
registrarRotasTransparencia(app);

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () =>
  console.log(
    `Servidor rodando em http://localhost:${PORT} | Site: http://localhost:${PORT}/site`,
  ),
);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Porta ${PORT} ja esta em uso. Feche o outro servidor ou use PORT=${PORT + 1}.`,
    );
  } else {
    console.error("Erro ao iniciar o servidor:", err);
  }
  process.exit(1);
});
