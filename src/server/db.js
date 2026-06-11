// Banco SQLite compartilhado por todo o servidor: criação das tabelas e
// migrações leves (ALTER TABLE ignorado quando a coluna já existe).
// O caminho "verusai.db" é relativo ao diretório onde o servidor é iniciado
// (raiz do projeto, via `npm start`).
const Database = require("better-sqlite3");

const db = new Database("verusai.db");

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

db.exec(`CREATE TABLE IF NOT EXISTS usuario_sessoes (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  nome TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS cache_analises (
  url TEXT PRIMARY KEY,
  titulo TEXT,
  veredicto TEXT,
  score INTEGER,
  fontes_consultadas TEXT DEFAULT '[]',
  entidades TEXT DEFAULT '[]',
  resultado TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS chat_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  url TEXT,
  titulo TEXT,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS noticia_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  titulo TEXT DEFAULT '',
  cliente_id TEXT NOT NULL,
  usuario_email TEXT DEFAULT '',
  usuario_nome TEXT DEFAULT '',
  reacao TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  editado INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(url, cliente_id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS fonte_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dominio TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  reacao TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dominio, usuario_email)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS fonte_denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dominio TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  usuario_nome TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dominio, usuario_email)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS comentario_votos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comentario_id INTEGER NOT NULL,
  usuario_email TEXT NOT NULL,
  reacao TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comentario_id, usuario_email)
)`);

// Denúncias de usuários (a partir de um comentário). Uma denúncia por
// (comentário, denunciante); reenviar atualiza o motivo.
db.exec(`CREATE TABLE IF NOT EXISTS usuario_denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comentario_id INTEGER,
  denunciado_email TEXT NOT NULL,
  denunciado_nome TEXT DEFAULT '',
  usuario_email TEXT NOT NULL,
  usuario_nome TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comentario_id, usuario_email)
)`);

// Registro de quem realizou cada análise (uma linha por análise feita),
// para o dashboard mostrar quantos usuários já analisaram e quem são.
db.exec(`CREATE TABLE IF NOT EXISTS analise_autores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  nome TEXT DEFAULT '',
  url TEXT DEFAULT '',
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
  db.exec("ALTER TABLE cache_analises ADD COLUMN fontes_consultadas TEXT DEFAULT '[]'");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN entidades TEXT DEFAULT '[]'");
} catch (e) {}
try {
  db.exec("ALTER TABLE cache_analises ADD COLUMN verificacoes INTEGER DEFAULT 1");
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN configs TEXT DEFAULT '{}'");
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN nome TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE noticia_feedback ADD COLUMN usuario_email TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE noticia_feedback ADD COLUMN usuario_nome TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE noticia_feedback ADD COLUMN editado INTEGER DEFAULT 0");
} catch (e) {}

module.exports = { db };
