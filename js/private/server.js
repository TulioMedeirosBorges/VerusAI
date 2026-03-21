const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
const db = new Database("usuarios.db");

app.use(cors());
app.use(express.json());

// Cria a tabela se não existir
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Rota de cadastro
app.post("/register", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  }

  try {
    // Criptografa a senha antes de salvar
    const senhaCriptografada = await bcrypt.hash(senha, 10);

    const inserir = db.prepare(
      "INSERT INTO usuarios (email, senha) VALUES (?, ?)",
    );
    inserir.run(email, senhaCriptografada);

    res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!" });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ erro: "E-mail já cadastrado." });
    }
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

app.listen(3000, () =>
  console.log("Servidor rodando em http://localhost:3000"),
);
