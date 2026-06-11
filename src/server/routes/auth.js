// Rotas de autenticação: registro, login (e-mail/senha e Google), configs do
// usuário e recuperação/redefinição de senha por código enviado por e-mail.
const bcrypt = require("bcrypt");
const { db } = require("../db.js");
const {
  normalizarEmailUsuario,
  normalizarNomeUsuario,
} = require("../lib/utils.js");
const { criarSessaoUsuario } = require("../services/sessoes.js");
const { transporter } = require("../lib/email.js");

const PASSWORD_RESET_TOKEN_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_TOKEN_CLEANUP_MS = 60 * 1000;

function criarExpiracaoTokenRecuperacao() {
  return new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();
}

function limparTokensRecuperacaoExpirados() {
  try {
    db.prepare(
      `DELETE FROM tokens_recuperacao
       WHERE usado = 1
          OR julianday(expira_em) <= julianday('now')
          OR julianday(criado_em, '+5 minutes') <= julianday('now')`,
    ).run();
  } catch (err) {
    console.warn("[tokens_recuperacao] limpeza ignorada:", err.message);
  }
}

limparTokensRecuperacaoExpirados();
const resetTokenCleanupTimer = setInterval(
  limparTokensRecuperacaoExpirados,
  PASSWORD_RESET_TOKEN_CLEANUP_MS,
);
if (typeof resetTokenCleanupTimer.unref === "function") {
  resetTokenCleanupTimer.unref();
}

module.exports = function registrarRotasAuth(app) {
  app.post("/register", async (req, res) => {
    const { email, senha, nome } = req.body;
    const emailNormalizado = normalizarEmailUsuario(email);
    const nomePublico = normalizarNomeUsuario(nome, emailNormalizado);
    if (!emailNormalizado || !senha)
      return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    try {
      const senhaCriptografada = await bcrypt.hash(senha, 10);
      db.prepare(
        "INSERT INTO usuarios (email, senha, nome) VALUES (?, ?, ?)",
      ).run(emailNormalizado, senhaCriptografada, nomePublico);
      const sessao = criarSessaoUsuario(emailNormalizado, nomePublico);
      res.status(201).json({
        mensagem: "Usuário cadastrado com sucesso!",
        email: sessao.email,
        nome: sessao.nome,
        authToken: sessao.token,
      });
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
    const emailNormalizado = normalizarEmailUsuario(email);
    if (!emailNormalizado || !senha)
      return res.status(400).json({ erro: "Preencha todos os campos." });
    const usuario = db
      .prepare("SELECT * FROM usuarios WHERE email = ?")
      .get(emailNormalizado);
    if (!usuario)
      return res
        .status(401)
        .json({ erro: "E-mail não encontrado.", campo: "email" });
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta)
      return res.status(401).json({ erro: "Senha incorreta.", campo: "senha" });
    const sessao = criarSessaoUsuario(
      usuario.email,
      usuario.nome || usuario.email.split("@")[0],
    );
    res.status(200).json({
      mensagem: "Login realizado com sucesso!",
      email: sessao.email,
      nome: sessao.nome,
      authToken: sessao.token,
    });
  });

  app.post("/login-google", async (req, res) => {
    const { email, nome } = req.body;
    const emailNormalizado = normalizarEmailUsuario(email);
    const nomePublico = normalizarNomeUsuario(nome, emailNormalizado);
    if (!emailNormalizado) {
      return res.status(400).json({ erro: "E-mail não recebido." });
    }

    const usuarioExistente = db
      .prepare("SELECT * FROM usuarios WHERE email = ?")
      .get(emailNormalizado);

    if (!usuarioExistente) {
      db.prepare("INSERT INTO usuarios (email, senha, nome) VALUES (?, ?, ?)").run(
        emailNormalizado,
        "google-oauth",
        nomePublico,
      );
    } else if (nomePublico && !usuarioExistente.nome) {
      db.prepare("UPDATE usuarios SET nome = ? WHERE email = ?").run(
        nomePublico,
        emailNormalizado,
      );
    }

    const sessao = criarSessaoUsuario(emailNormalizado, nomePublico);
    res.status(200).json({
      mensagem: "Login com Google realizado!",
      email: sessao.email,
      nome: sessao.nome,
      authToken: sessao.token,
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
    const emailNormalizado = normalizarEmailUsuario(email);
    if (!emailNormalizado) {
      return res.status(400).json({ erro: "E-mail é obrigatório." });
    }

    limparTokensRecuperacaoExpirados();

    if (!db.prepare("SELECT * FROM usuarios WHERE email = ?").get(emailNormalizado))
      return res.status(404).json({ erro: "E-mail não encontrado." });

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = criarExpiracaoTokenRecuperacao();
    db.prepare("DELETE FROM tokens_recuperacao WHERE email = ?").run(
      emailNormalizado,
    );
    db.prepare(
      "INSERT INTO tokens_recuperacao (email, token, expira_em) VALUES (?, ?, ?)",
    ).run(emailNormalizado, token, expiraEm);

    try {
      await transporter.sendMail({
        from: '"VerusAI" <seuemail@gmail.com>',
        to: emailNormalizado,
        subject: "🔐 Código de Recuperação de Senha",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>Recuperação de Senha</h2>
          <div style="background:#f1ae2b;color:#000;padding:20px;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:4px;margin:20px 0">${token}</div>
          <p><strong>Este código expira em 5 minutos.</strong></p>
        </div>`,
      });
      res.status(200).json({ mensagem: "Código enviado com sucesso!" });
    } catch (error) {
      db.prepare("DELETE FROM tokens_recuperacao WHERE token = ?").run(token);
      res.status(500).json({ erro: "Erro ao enviar email. Tente novamente." });
    }
  });

  app.post("/redefinir-senha", async (req, res) => {
    const { token, novaSenha } = req.body;
    const tokenLimpo = String(token || "").trim();
    if (!tokenLimpo || !novaSenha)
      return res
        .status(400)
        .json({ erro: "Token e nova senha são obrigatórios." });

    limparTokensRecuperacaoExpirados();

    const tokenData = db
      .prepare(
        `SELECT * FROM tokens_recuperacao
         WHERE token = ?
           AND usado = 0
           AND julianday(expira_em) > julianday('now')
           AND julianday(criado_em, '+5 minutes') > julianday('now')`,
      )
      .get(tokenLimpo);
    if (!tokenData)
      return res.status(400).json({ erro: "Código inválido ou expirado." });
    try {
      db.prepare("UPDATE usuarios SET senha = ? WHERE email = ?").run(
        await bcrypt.hash(novaSenha, 10),
        tokenData.email,
      );
      db.prepare("DELETE FROM tokens_recuperacao WHERE email = ?").run(
        tokenData.email,
      );
      res.status(200).json({ mensagem: "Senha redefinida com sucesso!" });
    } catch (err) {
      res.status(500).json({ erro: "Erro ao redefinir senha." });
    }
  });
};
