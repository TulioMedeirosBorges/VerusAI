const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
const db = new Database("usuarios.db");

app.use(cors());
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Adiciona coluna configs se não existir
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN configs TEXT DEFAULT '{}'");
} catch (e) {}

app.post("/register", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  }

  try {
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const inserir = db.prepare(
      "INSERT INTO usuarios (email, senha) VALUES (?, ?)",
    );
    inserir.run(email, senhaCriptografada);
    res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!" });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res
        .status(409)
        .json({ erro: "E-mail já cadastrado.", campo: "email" });
    }
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Preencha todos os campos." });
  }

  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(email);

  if (!usuario) {
    return res
      .status(401)
      .json({ erro: "E-mail não encontrado.", campo: "email" });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

  if (!senhaCorreta) {
    return res.status(401).json({ erro: "Senha incorreta.", campo: "senha" });
  }

  res
    .status(200)
    .json({ mensagem: "Login realizado com sucesso!", email: usuario.email });
});

app.post("/login-google", async (req, res) => {
  const { email, nome } = req.body;

  if (!email) {
    return res.status(400).json({ erro: "E-mail não recebido." });
  }

  let usuario = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email);

  if (!usuario) {
    db.prepare("INSERT INTO usuarios (email, senha) VALUES (?, ?)").run(
      email,
      "google-oauth",
    );
  }

  res.status(200).json({ mensagem: "Login com Google realizado!", email });
});

app.post("/salvar-configs", (req, res) => {
  const { email, configs } = req.body;

  db.prepare("UPDATE usuarios SET configs = ? WHERE email = ?").run(
    JSON.stringify(configs),
    email,
  );

  res.status(200).json({ mensagem: "Configs salvas!" });
});
app.post("/carregar-configs", (req, res) => {
  const { email } = req.body;

  const usuario = db
    .prepare("SELECT configs FROM usuarios WHERE email = ?")
    .get(email);

  if (!usuario) {
    return res.status(404).json({ erro: "Usuário não encontrado." });
  }

  res.status(200).json({ configs: JSON.parse(usuario.configs || "{}") });
});

// ✅ app.listen apenas uma vez e no final
app.listen(3000, () =>
  console.log("Servidor rodando em http://localhost:3000"),
);
