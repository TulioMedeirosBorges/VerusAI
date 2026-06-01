// services/api.js
var API_BASE = "http://localhost:3000";

async function apiPost(path, body) {
  var res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  var contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Resposta não-JSON de " + path);
  }

  var data = await res.json();
  return { ok: res.ok, status: res.status, data: data };
}

var VerusAPI = {
  login: function(email, senha) { return apiPost("/login", { email: email, senha: senha }); },
  loginGoogle: function(email, nome) { return apiPost("/login-google", { email: email, nome: nome }); },
  register: function(email, senha, nome) { return apiPost("/register", { email: email, senha: senha, nome: nome }); },
  recuperarSenha: function(email) { return apiPost("/recuperar-senha", { email: email }); },
  redefinirSenha: function(token, novaSenha) { return apiPost("/redefinir-senha", { token: token, novaSenha: novaSenha }); },
  salvarConfigs: function(email, configs) { return apiPost("/salvar-configs", { email: email, configs: configs }); },
  carregarConfigs: function(email) { return apiPost("/carregar-configs", { email: email }); },
};
