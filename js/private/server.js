const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const db = new Database("usuarios.db");

app.use(cors());
app.use(express.json());

// ✅ Configuração do Nodemailer (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "tuliobmedeiros@gmail.com", // ← COLOQUE SEU EMAIL AQUI
    pass: "zmlu nuve iqks rjgm", // ← COLOQUE SUA SENHA DE APP AQUI
  },
});

// Tabela de usuários
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabela de tokens de recuperação
db.exec(`
  CREATE TABLE IF NOT EXISTS tokens_recuperacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expira_em DATETIME NOT NULL,
    usado INTEGER DEFAULT 0,
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

// ✅ RECUPERAR SENHA - Gera token de 6 dígitos e envia por email
app.post("/recuperar-senha", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: "E-mail é obrigatório." });
  }

  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(email);

  if (!usuario) {
    return res.status(404).json({ erro: "E-mail não encontrado." });
  }

  // Gera token de 6 dígitos numéricos
  const token = Math.floor(100000 + Math.random() * 900000).toString();

  // Token expira em 15 minutos
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Salva token no banco
  db.prepare(
    "INSERT INTO tokens_recuperacao (email, token, expira_em) VALUES (?, ?, ?)",
  ).run(email, token, expiraEm);

  // Envia email
  try {
    await transporter.sendMail({
      from: '"AosFatos" <seuemail@gmail.com>',
      to: email,
      subject: "🔐 Código de Recuperação de Senha",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Recuperação de Senha</h2>
          <p>Você solicitou a recuperação de senha da sua conta AosFatos.</p>
          <div style="background: #f1ae2b; color: #000; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">
            ${token}
          </div>
          <p><strong>Este código expira em 15 minutos.</strong></p>
          <p>Se você não solicitou essa recuperação, ignore este e-mail.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #888; font-size: 12px;">AosFatos - Verificador de Notícias</p>
        </div>
      `,
    });

    console.log(`✅ Token enviado para ${email}: ${token}`);
    res.status(200).json({ mensagem: "Código enviado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao enviar email:", error);
    res.status(500).json({ erro: "Erro ao enviar email. Tente novamente." });
  }
});

// ✅ REDEFINIR SENHA com token
app.post("/redefinir-senha", async (req, res) => {
  const { token, novaSenha } = req.body;

  if (!token || !novaSenha) {
    return res
      .status(400)
      .json({ erro: "Token e nova senha são obrigatórios." });
  }

  // Busca token válido
  const tokenData = db
    .prepare(
      "SELECT * FROM tokens_recuperacao WHERE token = ? AND usado = 0 AND expira_em > datetime('now')",
    )
    .get(token);

  if (!tokenData) {
    return res.status(400).json({ erro: "Código inválido ou expirado." });
  }

  try {
    // Atualiza a senha
    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
    db.prepare("UPDATE usuarios SET senha = ? WHERE email = ?").run(
      senhaCriptografada,
      tokenData.email,
    );

    // Marca token como usado
    db.prepare("UPDATE tokens_recuperacao SET usado = 1 WHERE token = ?").run(
      token,
    );

    res.status(200).json({ mensagem: "Senha redefinida com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao redefinir senha." });
  }
});

app.listen(3000, () =>
  console.log("Servidor rodando em http://localhost:3000"),
);
