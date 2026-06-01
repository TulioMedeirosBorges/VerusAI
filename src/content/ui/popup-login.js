// ui/popup-login.js
function criarPopupLoginInterno(shadow, onLoginSuccess) {
  if (shadow.getElementById("login_popup_interno")) return;

  var _logo = chrome.runtime.getURL("/assets/images/VerusIAAtivo 1.svg");
  var _iconGoogle = chrome.runtime.getURL("assets/icons/google.svg");
  var aside = shadow.querySelector("aside");

  var mask = document.createElement("div");
  mask.id = "login_mask";
  aside.appendChild(mask);

  var popup = document.createElement("div");
  popup.id = "login_popup_interno";
  popup.innerHTML =
    // TELA 1: LOGIN
    '<div class="login_popup_tela ativa" id="tela_login">' +
      '<div class="login_popup_logo"><img src="' + _logo + '" alt="logo" /></div>' +
      '<div class="login_gap">' +
        '<div><p class="login_popup_label">E-mail</p><input type="email" class="login_popup_input" id="popup_email_login" placeholder="Digite seu e-mail" /><span class="erro" id="erroEmailLogin"></span></div>' +
        '<div><p class="login_popup_label">Senha</p><input type="password" class="login_popup_input" id="popup_senha_login" placeholder="Digite sua senha" /><span class="erro" id="erroPasswordLogin"></span></div>' +
        '<p class="login_popup_esqueceu"><a id="popup_esqueceu_senha">Esqueceu a senha?</a></p>' +
        '<button class="login_popup_btn_confirmar" id="popup_confirmar_login">Confirmar</button>' +
        '<button class="login_popup_btn_google" id="popup_google_login"><img src="' + _iconGoogle + '" class="icon_googlelo_login"/> Continue with Google</button>' +
        '<p class="login_popup_cadastro">Don\'t have an account? <a id="popup_cadastro_login">Log up</a></p>' +
      '</div>' +
    '</div>' +
    // TELA 2: SOLICITAR RECUPERAÇÃO
    '<div class="login_popup_tela" id="tela_solicitar">' +
      '<p class="login_popup_voltar" id="voltar_login">← Voltar</p>' +
      '<div class="recuperar_popup_logo"><img src="' + _logo + '" alt="logo" /><span>Recuperar Senha<small>Digite seu e-mail cadastrado</small></span></div>' +
      '<div class="recuperar_popup_input"><p class="login_popup_label">E-mail</p><input type="email" class="login_popup_input" id="popup_email_recuperar" placeholder="Digite seu e-mail" /><span class="erro" id="erro_recuperacao"></span></div>' +
      '<button class="login_popup_btn_confirmar" id="popup_enviar_token"><p>Enviar Código</p></button>' +
    '</div>' +
    // TELA 3: REDEFINIR SENHA
    '<div class="login_popup_tela" id="tela_redefinir">' +
      '<p class="login_popup_voltar" id="voltar_solicitar">← Voltar</p>' +
      '<div class="redefinir_popup_logo"><img src="' + _logo + '" alt="logo" /><span>Nova Senha<small>Digite o código recebido no e-mail</small></span></div>' +
      '<div id="mensagem_sucesso_email" class="login_popup_info" style="display:none;"></div>' +
      '<div class="redefinir_popup_input"><p class="login_popup_label">Código de Verificação</p><input type="text" class="login_popup_input" id="popup_token" placeholder="Digite o código de 6 dígitos" maxlength="6" /><span class="erro" id="erroToken"></span></div>' +
      '<div class="redefinir_popup_input"><p class="login_popup_label">Nova Senha</p><input type="password" class="login_popup_input" id="popup_nova_senha" placeholder="Digite a nova senha" />' +
        '<div class="senha-forca" id="senha_forca_redefinir"><div class="senha-forca-barra"></div><div class="senha-forca-barra"></div><div class="senha-forca-barra"></div></div>' +
        '<p class="senha-forca-texto" id="senha_forca_texto_redefinir"></p><span class="erro" id="erroNovaSenha"></span></div>' +
      '<div class="redefinir_popup_input"><p class="login_popup_label">Confirmar Senha</p><input type="password" class="login_popup_input" id="popup_confirmar_senha" placeholder="Digite novamente" /><span class="erro" id="erroConfirmarSenha"></span></div>' +
      '<button class="login_popup_btn_confirmar" id="popup_redefinir_senha"><p>Redefinir Senha</p></button>' +
    '</div>' +
    // TELA 4: SUCESSO REDEFINIÇÃO
    '<div class="login_popup_tela" id="tela_sucesso_redefinicao">' +
      '<div class="sucesso_redefinicao"><div class="sucesso_icone">✅</div><h2>Senha redefinida!</h2><p>Sua senha foi alterada com sucesso.</p><button class="login_popup_btn_confirmar" id="btn_voltar_login_sucesso"><p>Fazer login</p></button></div>' +
    '</div>' +
    // TELA 5: REGISTRO
    '<div class="login_popup_tela" id="tela_registro">' +
      '<p class="login_popup_voltar" id="voltar_registro">← Voltar</p>' +
      '<div class="registro_popup_logo"><img src="' + _logo + '" alt="logo" /><span>Criar Conta<small>Preencha os dados para se cadastrar</small></span></div>' +
      '<div class="registro_popup_input"><p class="login_popup_label">Nome (opcional)</p><input type="text" class="login_popup_input" id="popup_nome_registro" placeholder="Digite seu nome" /></div>' +
      '<div class="registro_popup_input"><p class="login_popup_label">E-mail</p><input type="email" class="login_popup_input" id="popup_email_registro" placeholder="Digite seu e-mail" /><span class="erro" id="erroEmailRegistro"></span></div>' +
      '<div class="registro_popup_input"><p class="login_popup_label">Senha</p><input type="password" class="login_popup_input" id="popup_senha_registro" placeholder="Mínimo 6 caracteres" />' +
        '<div class="senha-forca" id="senha_forca_registro"><div class="senha-forca-barra"></div><div class="senha-forca-barra"></div><div class="senha-forca-barra"></div></div>' +
        '<p class="senha-forca-texto" id="senha_forca_texto"></p><span class="erro" id="erroSenhaRegistro"></span></div>' +
      '<div class="registro_popup_input"><p class="login_popup_label">Confirmar Senha</p><input type="password" class="login_popup_input" id="popup_confirmar_senha_registro" placeholder="Digite a senha novamente" /><span class="erro" id="erroConfirmarSenhaRegistro"></span></div>' +
      '<button class="login_popup_btn_confirmar" id="popup_confirmar_registro"><p>Criar Conta</p></button>' +
      '<p class="login_popup_cadastro">Already have an account? <a id="popup_ja_tem_conta">Sign in</a></p>' +
    '</div>' +
    // TELA 6: SUCESSO CADASTRO
    '<div class="login_popup_tela" id="tela_sucesso_cadastro">' +
      '<div class="sucesso_redefinicao"><div class="sucesso_icone">🎉</div><h2>Bem-vindo!</h2><p>Sua conta foi criada com sucesso.</p><button class="login_popup_btn_confirmar" id="btn_comecar_cadastro"><p>Começar a usar</p></button></div>' +
    '</div>';

  aside.appendChild(popup);
  popup.classList.add("tela-login-ativa");

  // --- Helpers ---
  var mapaClasses = {
    tela_login: "tela-login-ativa",
    tela_solicitar: "tela-solicitar-ativa",
    tela_redefinir: "tela-redefinir-ativa",
    tela_sucesso_redefinicao: "tela-sucesso-redefinicao-ativa",
    tela_registro: "tela-registro-ativa",
    tela_sucesso_cadastro: "tela-sucesso-cadastro-ativa",
  };

  function mudarTela(telaId) {
    shadow.querySelectorAll(".login_popup_tela").forEach(function(t) { t.classList.remove("ativa"); });
    shadow.getElementById(telaId).classList.add("ativa");
    popup.className = "";
    popup.id = "login_popup_interno";
    if (mapaClasses[telaId]) popup.classList.add(mapaClasses[telaId]);
  }

  function fecharPopupEMascara() {
    popup.remove();
    mask.remove();
  }

  function setErro(inputId, spanId, msg) {
    var input = shadow.getElementById(inputId);
    var span = shadow.getElementById(spanId);
    if (input) input.classList.add("input-erro");
    if (span) span.textContent = msg;
  }

  function limparErro(inputId, spanId) {
    var input = shadow.getElementById(inputId);
    var span = shadow.getElementById(spanId);
    if (input) input.classList.remove("input-erro");
    if (span) span.textContent = "";
  }

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Stoppers de teclado nos inputs + navegação por Enter
  var inputIds = [
    "popup_email_login", "popup_senha_login", "popup_email_recuperar",
    "popup_token", "popup_nova_senha", "popup_confirmar_senha",
    "popup_nome_registro", "popup_email_registro",
    "popup_senha_registro", "popup_confirmar_senha_registro",
  ];
  setTimeout(function() {
    inputIds.forEach(function(id) {
      var input = shadow.getElementById(id);
      if (!input) return;
      input.addEventListener("keydown", function(e) { e.stopPropagation(); });
      input.addEventListener("keyup", function(e) { e.stopPropagation(); });
    });

    // Login: email → senha → confirmar
    shadow.getElementById("popup_email_login").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_senha_login").focus();
    });
    shadow.getElementById("popup_senha_login").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_confirmar_login").click();
    });

    // Recuperação: email → enviar
    shadow.getElementById("popup_email_recuperar").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_enviar_token").click();
    });

    // Redefinir: token → nova senha → confirmar → redefinir
    shadow.getElementById("popup_token").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_nova_senha").focus();
    });
    shadow.getElementById("popup_nova_senha").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_confirmar_senha").focus();
    });
    shadow.getElementById("popup_confirmar_senha").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_redefinir_senha").click();
    });

    // Registro: nome → email → senha → confirmar → criar conta
    shadow.getElementById("popup_nome_registro").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_email_registro").focus();
    });
    shadow.getElementById("popup_email_registro").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_senha_registro").focus();
    });
    shadow.getElementById("popup_senha_registro").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_confirmar_senha_registro").focus();
    });
    shadow.getElementById("popup_confirmar_senha_registro").addEventListener("keydown", function(e) {
      if (e.key === "Enter") shadow.getElementById("popup_confirmar_registro").click();
    });
  }, 0);

  // Indicador de força da senha
  setTimeout(function() {
    function aplicarForca(inputEl, barrasSelector, textoId) {
      inputEl.addEventListener("input", function() {
        var senha = inputEl.value;
        var barras = shadow.querySelectorAll(barrasSelector);
        var textoForca = shadow.getElementById(textoId);
        barras.forEach(function(b) { b.classList.remove("ativa-fraca", "ativa-media", "ativa-forte"); });
        if (!senha.length) { textoForca.textContent = ""; return; }
        var forca = 0;
        if (senha.length >= 6) forca++;
        if (senha.length >= 10) forca++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) forca++;
        if (/\d/.test(senha)) forca++;
        if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(senha)) forca++;
        if (forca <= 2) {
          barras[0].classList.add("ativa-fraca");
          textoForca.textContent = "Fraca"; textoForca.style.color = "#dc3545";
        } else if (forca <= 3) {
          barras[0].classList.add("ativa-media"); barras[1].classList.add("ativa-media");
          textoForca.textContent = "Média"; textoForca.style.color = "#ffc107";
        } else {
          barras.forEach(function(b) { b.classList.add("ativa-forte"); });
          textoForca.textContent = "Forte"; textoForca.style.color = "#28a745";
        }
      });
    }

    var senhaRegistro = shadow.getElementById("popup_senha_registro");
    if (senhaRegistro) aplicarForca(senhaRegistro, "#senha_forca_registro .senha-forca-barra", "senha_forca_texto");

    var senhaRedefinir = shadow.getElementById("popup_nova_senha");
    if (senhaRedefinir) aplicarForca(senhaRedefinir, "#senha_forca_redefinir .senha-forca-barra", "senha_forca_texto_redefinir");
  }, 0);

  // Navegação entre telas
  shadow.getElementById("popup_esqueceu_senha").addEventListener("click", function() { mudarTela("tela_solicitar"); });
  shadow.getElementById("voltar_login").addEventListener("click", function() { mudarTela("tela_login"); });
  shadow.getElementById("voltar_solicitar").addEventListener("click", function() { mudarTela("tela_solicitar"); });
  shadow.getElementById("popup_cadastro_login").addEventListener("click", function() { mudarTela("tela_registro"); });
  shadow.getElementById("popup_ja_tem_conta").addEventListener("click", function() { mudarTela("tela_login"); });

  shadow.getElementById("voltar_registro").addEventListener("click", function() {
    mudarTela("tela_login");
    ["popup_nome_registro", "popup_email_registro", "popup_senha_registro", "popup_confirmar_senha_registro"]
      .forEach(function(id) { var el = shadow.getElementById(id); if (el) el.value = ""; });
    limparErro("popup_email_registro", "erroEmailRegistro");
    limparErro("popup_senha_registro", "erroSenhaRegistro");
    limparErro("popup_confirmar_senha_registro", "erroConfirmarSenhaRegistro");
  });

  shadow.getElementById("btn_voltar_login_sucesso").addEventListener("click", function() {
    mudarTela("tela_login");
    shadow.getElementById("popup_email_login").value = "";
    shadow.getElementById("popup_senha_login").value = "";
  });

  shadow.getElementById("btn_comecar_cadastro").addEventListener("click", fecharPopupEMascara);

  // Login normal
  shadow.getElementById("popup_confirmar_login").addEventListener("click", async function() {
    var email = shadow.getElementById("popup_email_login").value.trim();
    var senha = shadow.getElementById("popup_senha_login").value;
    limparErro("popup_email_login", "erroEmailLogin");
    limparErro("popup_senha_login", "erroPasswordLogin");
    var temErro = false;
    if (!email) { setErro("popup_email_login", "erroEmailLogin", "E-mail é obrigatório"); temErro = true; }
    else if (!emailRegex.test(email)) { setErro("popup_email_login", "erroEmailLogin", "E-mail inválido"); temErro = true; }
    if (!senha) { setErro("popup_senha_login", "erroPasswordLogin", "Senha é obrigatória"); temErro = true; }
    if (temErro) return;
    try {
      var res = await VerusAPI.login(email, senha);
      if (res.ok) {
        await storageSet({
          logado: true,
          email: res.data.email,
          nome: res.data.nome,
          authToken: res.data.authToken,
        });
        VerusState.cachedEmail = res.data.email;
        VerusState.cachedNome = res.data.nome;
        fecharPopupEMascara();
        onLoginSuccess(res.data.email, res.data.nome);
      } else {
        var campo = res.data.campo === "senha" ? "popup_senha_login" : "popup_email_login";
        var span = res.data.campo === "senha" ? "erroPasswordLogin" : "erroEmailLogin";
        setErro(campo, span, res.data.erro);
      }
    } catch(e) { alert("Erro ao conectar com o servidor."); }
  });

  // Login com Google
  shadow.getElementById("popup_google_login").addEventListener("click", function() {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      alert("Login com Google não disponível. Use email e senha.");
      return;
    }
    chrome.identity.getAuthToken({ interactive: true }, async function(token) {
      if (chrome.runtime.lastError || !token) { alert("Erro ao fazer login com Google."); return; }
      try {
        var res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: "Bearer " + token } });
        if (!res.ok) throw new Error("API retornou " + res.status);
        var user = await res.json();
        var login = await VerusAPI.loginGoogle(user.email, user.name);
        if (!login.ok) throw new Error(login.data?.erro || "Erro no login Google");
        await storageSet({
          logado: true,
          email: login.data.email,
          nome: login.data.nome,
          authToken: login.data.authToken,
        });
        VerusState.cachedEmail = login.data.email;
        VerusState.cachedNome = login.data.nome;
        fecharPopupEMascara();
        onLoginSuccess(login.data.email, login.data.nome);
      } catch(e) { console.error("[VerusAI] Erro login Google:", e); alert("Erro ao processar login."); }
    });
  });

  // Registro
  shadow.getElementById("popup_confirmar_registro").addEventListener("click", async function() {
    limparErro("popup_email_registro", "erroEmailRegistro");
    limparErro("popup_senha_registro", "erroSenhaRegistro");
    limparErro("popup_confirmar_senha_registro", "erroConfirmarSenhaRegistro");
    var nome = shadow.getElementById("popup_nome_registro").value.trim();
    var email = shadow.getElementById("popup_email_registro").value.trim();
    var senha = shadow.getElementById("popup_senha_registro").value;
    var confirmar = shadow.getElementById("popup_confirmar_senha_registro").value;
    var temErro = false;
    if (!email) { setErro("popup_email_registro", "erroEmailRegistro", "E-mail é obrigatório"); temErro = true; }
    else if (!emailRegex.test(email)) { setErro("popup_email_registro", "erroEmailRegistro", "E-mail inválido"); temErro = true; }
    if (!senha) { setErro("popup_senha_registro", "erroSenhaRegistro", "Senha é obrigatória"); temErro = true; }
    else if (senha.length < 6) { setErro("popup_senha_registro", "erroSenhaRegistro", "Mínimo 6 caracteres"); temErro = true; }
    else if (!/[A-Z]/.test(senha)) { setErro("popup_senha_registro", "erroSenhaRegistro", "Deve ter letra maiúscula"); temErro = true; }
    else if (!/[a-z]/.test(senha)) { setErro("popup_senha_registro", "erroSenhaRegistro", "Deve ter letra minúscula"); temErro = true; }
    else if (!/\d/.test(senha)) { setErro("popup_senha_registro", "erroSenhaRegistro", "Deve ter um número"); temErro = true; }
    else if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(senha)) { setErro("popup_senha_registro", "erroSenhaRegistro", "Deve ter caractere especial"); temErro = true; }
    if (!confirmar) { setErro("popup_confirmar_senha_registro", "erroConfirmarSenhaRegistro", "Confirme a senha"); temErro = true; }
    else if (senha !== confirmar) { setErro("popup_confirmar_senha_registro", "erroConfirmarSenhaRegistro", "As senhas não coincidem"); temErro = true; }
    if (temErro) return;
    var btn = shadow.getElementById("popup_confirmar_registro");
    btn.disabled = true;
    btn.querySelector("p").textContent = "Criando conta...";
    try {
      var res = await VerusAPI.register(email, senha, nome);
      if (res.ok) {
        await storageSet({
          logado: true,
          email: res.data.email || email,
          nome: res.data.nome || nome,
          authToken: res.data.authToken,
        });
        VerusState.cachedEmail = res.data.email || email;
        VerusState.cachedNome = res.data.nome || nome;
        onLoginSuccess(res.data.email || email, res.data.nome || nome);
        mudarTela("tela_sucesso_cadastro");
      } else {
        setErro("popup_email_registro", "erroEmailRegistro", res.data.erro);
      }
    } catch(e) { alert("Erro ao conectar com o servidor."); }
    finally { btn.disabled = false; btn.querySelector("p").textContent = "Criar Conta"; }
  });

  // Recuperação de senha
  shadow.getElementById("popup_enviar_token").addEventListener("click", async function() {
    var email = shadow.getElementById("popup_email_recuperar").value.trim();
    limparErro("popup_email_recuperar", "erro_recuperacao");
    if (!email) { setErro("popup_email_recuperar", "erro_recuperacao", "E-mail é obrigatório"); return; }
    if (!emailRegex.test(email)) { setErro("popup_email_recuperar", "erro_recuperacao", "E-mail inválido"); return; }
    var btn = shadow.getElementById("popup_enviar_token");
    btn.disabled = true;
    btn.querySelector("p").textContent = "Enviando...";
    try {
      var res = await VerusAPI.recuperarSenha(email);
      if (res.ok) {
        var msgEl = shadow.getElementById("mensagem_sucesso_email");
        msgEl.textContent = "📧 Enviamos um código para " + email + ". Ele expira em 5 minutos. Verifique sua caixa de entrada e spam.";
        msgEl.style.display = "block";
        mudarTela("tela_redefinir");
        shadow.getElementById("popup_token").dataset.email = email;
      } else {
        setErro("popup_email_recuperar", "erro_recuperacao", res.data.erro || "Erro ao solicitar recuperação.");
      }
    } catch(e) {
      setErro("popup_email_recuperar", "erro_recuperacao", "Erro ao conectar com o servidor.");
    } finally {
      btn.disabled = false;
      btn.querySelector("p").textContent = "Enviar Código";
    }
  });

  // Redefinir senha
  shadow.getElementById("popup_redefinir_senha").addEventListener("click", async function() {
    var token = shadow.getElementById("popup_token").value.trim();
    var novaSenha = shadow.getElementById("popup_nova_senha").value;
    var confirmar = shadow.getElementById("popup_confirmar_senha").value;
    limparErro("popup_token", "erroToken");
    limparErro("popup_nova_senha", "erroNovaSenha");
    limparErro("popup_confirmar_senha", "erroConfirmarSenha");
    var temErro = false;
    if (!token) { setErro("popup_token", "erroToken", "Código obrigatório"); temErro = true; }
    if (!novaSenha) { setErro("popup_nova_senha", "erroNovaSenha", "Senha é obrigatória"); temErro = true; }
    else if (novaSenha.length < 6) { setErro("popup_nova_senha", "erroNovaSenha", "Mínimo 6 caracteres"); temErro = true; }
    if (!confirmar) { setErro("popup_confirmar_senha", "erroConfirmarSenha", "Confirme a senha"); temErro = true; }
    else if (novaSenha !== confirmar) { setErro("popup_confirmar_senha", "erroConfirmarSenha", "As senhas não coincidem"); temErro = true; }
    if (temErro) return;
    try {
      var res = await VerusAPI.redefinirSenha(token, novaSenha);
      if (res.ok) {
        mudarTela("tela_sucesso_redefinicao");
        shadow.getElementById("popup_token").value = "";
        shadow.getElementById("popup_nova_senha").value = "";
        shadow.getElementById("popup_confirmar_senha").value = "";
        shadow.getElementById("mensagem_sucesso_email").style.display = "none";
      } else {
        setErro("popup_token", "erroToken", res.data.erro || "Código inválido ou expirado.");
      }
    } catch(e) { setErro("popup_token", "erroToken", "Erro ao conectar com o servidor."); }
  });
}
