// Sessões de usuário (token opaco gerado no login/registro e validado em cada
// rota autenticada).
const crypto = require("crypto");
const { db } = require("../db.js");
const {
  normalizarEmailUsuario,
  normalizarNomeUsuario,
} = require("../lib/utils.js");

function criarSessaoUsuario(email, nome = "") {
  const emailNormalizado = normalizarEmailUsuario(email);
  const nomePublico = normalizarNomeUsuario(nome, emailNormalizado);
  const token = crypto.randomBytes(32).toString("hex");

  db.prepare(
    `INSERT INTO usuario_sessoes (token, email, nome)
     VALUES (?, ?, ?)`,
  ).run(token, emailNormalizado, nomePublico);

  return {
    token,
    email: emailNormalizado,
    nome: nomePublico,
  };
}

function obterSessaoUsuario(token) {
  const tokenLimpo = String(token || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(tokenLimpo)) return null;

  const row = db
    .prepare(
      `SELECT s.email,
              COALESCE(NULLIF(u.nome, ''), NULLIF(s.nome, ''), '') AS nome
       FROM usuario_sessoes s
       LEFT JOIN usuarios u ON lower(u.email) = lower(s.email)
       WHERE s.token = ?`,
    )
    .get(tokenLimpo);

  if (!row?.email) return null;
  const email = normalizarEmailUsuario(row.email);
  return {
    email,
    nome: normalizarNomeUsuario(row.nome, email),
  };
}

module.exports = { criarSessaoUsuario, obterSessaoUsuario };
