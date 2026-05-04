const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();

const app = express();
const db = new Database("usuarios.db");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tokens_recuperacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expira_em DATETIME NOT NULL,
  usado INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS cache_analises (
  url TEXT PRIMARY KEY,
  titulo TEXT,
  veredicto TEXT,
  score INTEGER,
  resultado TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN titulo TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN veredicto TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN score INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN configs TEXT DEFAULT '{}'");
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN nome TEXT DEFAULT ''");
} catch (e) {}

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────

app.post("/register", async (req, res) => {
  const { email, senha, nome } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  try {
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    db.prepare(
      "INSERT INTO usuarios (email, senha, nome) VALUES (?, ?, ?)",
    ).run(email, senhaCriptografada, nome || "");
    res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!" });
  } catch (err) {
    if (err.message.includes("UNIQUE"))
      return res
        .status(409)
        .json({ erro: "E-mail já cadastrado.", campo: "email" });
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });
  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(email);
  if (!usuario)
    return res
      .status(401)
      .json({ erro: "E-mail não encontrado.", campo: "email" });
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  if (!senhaCorreta)
    return res.status(401).json({ erro: "Senha incorreta.", campo: "senha" });
  res.status(200).json({
    mensagem: "Login realizado com sucesso!",
    email: usuario.email,
    nome: usuario.nome || usuario.email.split("@")[0],
  });
});

app.post("/login-google", async (req, res) => {
  const { email, nome } = req.body;
  if (!email) return res.status(400).json({ erro: "E-mail não recebido." });
  if (!db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email)) {
    db.prepare("INSERT INTO usuarios (email, senha) VALUES (?, ?)").run(
      email,
      "google-oauth",
    );
  }
  res.status(200).json({
    mensagem: "Login com Google realizado!",
    email,
    nome: nome || email.split("@")[0],
  });
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
  if (!usuario)
    return res.status(404).json({ erro: "Usuário não encontrado." });
  res.status(200).json({ configs: JSON.parse(usuario.configs || "{}") });
});

app.post("/recuperar-senha", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erro: "E-mail é obrigatório." });
  if (!db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email))
    return res.status(404).json({ erro: "E-mail não encontrado." });

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO tokens_recuperacao (email, token, expira_em) VALUES (?, ?, ?)",
  ).run(email, token, expiraEm);

  try {
    await transporter.sendMail({
      from: '"VerusAI" <seuemail@gmail.com>',
      to: email,
      subject: "🔐 Código de Recuperação de Senha",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Recuperação de Senha</h2>
        <div style="background:#f1ae2b;color:#000;padding:20px;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:4px;margin:20px 0">${token}</div>
        <p><strong>Este código expira em 15 minutos.</strong></p>
      </div>`,
    });
    res.status(200).json({ mensagem: "Código enviado com sucesso!" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao enviar email. Tente novamente." });
  }
});

app.post("/redefinir-senha", async (req, res) => {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha)
    return res
      .status(400)
      .json({ erro: "Token e nova senha são obrigatórios." });
  const tokenData = db
    .prepare(
      "SELECT * FROM tokens_recuperacao WHERE token = ? AND usado = 0 AND expira_em > datetime('now')",
    )
    .get(token);
  if (!tokenData)
    return res.status(400).json({ erro: "Código inválido ou expirado." });
  try {
    db.prepare("UPDATE usuarios SET senha = ? WHERE email = ?").run(
      await bcrypt.hash(novaSenha, 10),
      tokenData.email,
    );
    db.prepare("UPDATE tokens_recuperacao SET usado = 1 WHERE token = ?").run(
      token,
    );
    res.status(200).json({ mensagem: "Senha redefinida com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao redefinir senha." });
  }
});

// ── PIPELINE DE ANÁLISE ──────────────────────────────────────────────────────

const { runPipeline } = require("./services/runPipeline.js");

app.post("/analisar", async (req, res) => {
  try {
    const pageData = req.body;

    if (!pageData || typeof pageData !== "object") {
      return res.status(400).json({
        ok: false,
        erro: "Dados da página ausentes.",
      });
    }

    if (!pageData.url) {
      return res.status(400).json({
        ok: false,
        erro: "URL da página é obrigatória.",
      });
    }

    const resultado = await runPipeline(pageData);

    return res.status(200).json(resultado);
  } catch (err) {
    console.error("[/analisar] erro:", err);

    return res.status(500).json({
      ok: false,
      erro: err.message || "Erro interno ao analisar a página.",
    });
  }
});

// ── SITE E API PÚBLICA ────────────────────────────────────────────────────────

app.use("/site", express.static(path.join(__dirname, "../../public")));

app.get("/api/analises", (req, res) => {
  const { pagina = 1, busca = "", veredicto = "" } = req.query;
  const limite = 12;
  const offset = (parseInt(pagina) - 1) * limite;
  let where = "WHERE 1=1";
  const params = [];
  if (busca) {
    where += " AND (url LIKE ? OR titulo LIKE ?)";
    params.push(`%${busca}%`, `%${busca}%`);
  }
  if (veredicto) {
    where += " AND veredicto = ?";
    params.push(veredicto);
  }
  const total = db
    .prepare(`SELECT COUNT(*) as n FROM cache_analises ${where}`)
    .get(...params).n;
  const rows = db
    .prepare(
      `SELECT url, titulo, veredicto, score, criado_em FROM cache_analises ${where} ORDER BY criado_em DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limite, offset);
  res.json({ total, paginas: Math.ceil(total / limite), analises: rows });
});

app.get("/api/analises/detalhe", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ erro: "URL obrigatória" });
  const row = db
    .prepare("SELECT resultado, criado_em FROM cache_analises WHERE url = ?")
    .get(url);
  if (!row) return res.status(404).json({ erro: "Não encontrada" });
  res.json({ resultado: JSON.parse(row.resultado), criado_em: row.criado_em });
});

app.delete("/api/analises", (req, res) => {
  const { url, adminKey } = req.body;
  if (adminKey !== process.env.ADMIN_KEY)
    return res.status(403).json({ erro: "Não autorizado" });
  db.prepare("DELETE FROM cache_analises WHERE url = ?").run(url);
  res.json({ mensagem: "Removida" });
});

app.listen(3000, () =>
  console.log(
    "Servidor rodando em http://localhost:3000 | Site: http://localhost:3000/site",
  ),
);
