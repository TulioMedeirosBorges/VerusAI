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

  // ✅ Linha que estava faltando
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

  if (!senhaCorreta) {
    return res.status(401).json({ erro: "Senha incorreta.", campo: "senha" });
  }

  res
    .status(200)
    .json({ mensagem: "Login realizado com sucesso!", email: usuario.email });
});

app.listen(3000, () =>
  console.log("Servidor rodando em http://localhost:3000"),
);
app.post("/login-google", async (req, res) => {
  const { email, nome } = req.body;

  if (!email) {
    return res.status(400).json({ erro: "E-mail não recebido." });
  }

  // Verifica se já existe, se não existir cria
  let usuario = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email);

  if (!usuario) {
    db.prepare("INSERT INTO usuarios (email, senha) VALUES (?, ?)").run(
      email,
      "google-oauth",
    );
  }

  res.status(200).json({ mensagem: "Login com Google realizado!", email });
});
