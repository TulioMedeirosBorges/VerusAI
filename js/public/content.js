(() => {
  const BTN_ID = "btn_id";
  const BTN_CHAT_ID = "btn_chat_id";
  const SIDEBAR_ID = "sidebar_id";
  const OVERLAY_ID = "sidebar_overlay";
  const STYLE_GUARD = "secure_guard";
  const logo = chrome.runtime.getURL("/assets/image/VerusIAAtivo 1.svg");
  const iconDarkmode = chrome.runtime.getURL("assets/icons/dark_mode.svg");
  const iconSettings = chrome.runtime.getURL("assets/icons/settings.svg");
  const iconGoogle = chrome.runtime.getURL("assets/icons/google.svg");
  const iconLogout = chrome.runtime.getURL("assets/icons/logout.svg");

  if (window[STYLE_GUARD]) return;
  window[STYLE_GUARD] = true;

  let sidebarAberto = false;

  const buttonStyle = document.createElement("style");
  buttonStyle.textContent = `
    #btn_id {
      position: fixed;
      right: 16px;
      bottom: 24px;
      z-index: 2147483647;
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      background: #f1ae2b;
      color: #000000;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }

    #btn_chat_id {
      position: fixed;
      right: 110px;
      bottom: 24px;
      z-index: 2147483647;
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      background: #000000;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }

    #sidebar_overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 41235122;
      background: transparent;
    }
  `;
  document.head.appendChild(buttonStyle);

  function verificarLogin() {
    return new Promise((resolve) => {
      chrome.storage.local.get("logado", (resultado) => {
        resolve(resultado.logado === true);
      });
    });
  }

  function bloquearTeclado(e) {
    if (!sidebarAberto) return;
    const focoNoSidebar =
      document.activeElement?.id === SIDEBAR_ID ||
      document.activeElement?.shadowRoot !== undefined ||
      document.activeElement?.closest(`#${SIDEBAR_ID}`) !== null;
    if (focoNoSidebar) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  }

  function fecharSidebar() {
    sidebarAberto = false;
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (sidebar) sidebar.remove();
    if (overlay) overlay.remove();
    window.removeEventListener("keydown", bloquearTeclado, true);
    window.removeEventListener("keyup", bloquearTeclado, true);
    window.removeEventListener("keypress", bloquearTeclado, true);
    document.removeEventListener("keydown", bloquearTeclado, true);
    document.removeEventListener("keyup", bloquearTeclado, true);
    document.removeEventListener("keypress", bloquearTeclado, true);
  }

  function getVisibleArticle() {
    const selectors = [
      "article",
      "main",
      '[role="main"]',
      ".post-content",
      ".article-body",
      ".content",
      "#content",
      ".noticias",
      "#noticias",
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      let best = null;
      let bestVisibility = 0;

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(windowHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if (visibleHeight > bestVisibility) {
          bestVisibility = visibleHeight;
          best = el;
        }
      }

      if (best) return best;
    }

    return document.body;
  }

  function expandPost(article) {
    const moreSelectors = [
      'span[role="button"]',
      "button",
      'div[role="button"]',
    ];
    const keywords = ["ver mais", "more", "mais", "see more"];

    for (const selector of moreSelectors) {
      const elements = article.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.innerText?.toLowerCase().trim();
        if (keywords.some((kw) => text === kw)) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }

  function criarSidebar(analysis = null, mostrarLoginImediato = false) {
    sidebarAberto = true;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);

    window.addEventListener("keydown", bloquearTeclado, true);
    window.addEventListener("keyup", bloquearTeclado, true);
    window.addEventListener("keypress", bloquearTeclado, true);
    document.addEventListener("keydown", bloquearTeclado, true);
    document.addEventListener("keyup", bloquearTeclado, true);
    document.addEventListener("keypress", bloquearTeclado, true);

    const host = document.createElement("div");
    host.id = SIDEBAR_ID;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("style/styleSidebar.css");
    shadow.appendChild(style);

    const open = document.createElement("aside");
    open.innerHTML = `
      <header id="header">
        <div class="img">
          <img id="logo" src="${logo}" alt="" />
        </div>
        <div class="tm_stt">
          <div class="tema">
            <div class="retangleTema">
              <div class="circleTema">
                <img src="${iconDarkmode}" class="icon-darkmode" />
              </div>
            </div>
          </div>
          <div class="menu">
            <img id="settings" src="${iconSettings}" class="icon-settings" />
          </div>
        </div>
      </header>
      <div id="confiabilit">
        <div class="titleconf">
          <div class="conftext"><p>CONFIABILIDADE</p></div>
          <div class="porcentconf">
            <p>ALTA</p>
            <div id="porcent"><p>98%</p></div>
          </div>
        </div>
        <div class="confiabilitbar">
          <div id="confbar"></div>
        </div>
      </div>
      <div id="chatMensagens"></div>
      <footer class="chatFooter">
        <input type="text" id="chatInput" placeholder="Faça sua pergunta..." />
        <button id="chatEnviar">➤</button>
      </footer>

      <div id="menuConfig" class="menuConfig escondido">
        <div class="menuConfigHeader">
          <h2>Configurações</h2>
          <button id="fecharConfig">✕</button>
        </div>
        <div class="menuConfigUsuario">
          <p id="menuNomeUsuario"></p>
          <div id="menuLogout">
            <img src="${iconLogout}" class="icon-logout-menu" />
            <p>Sair</p>
          </div>
        </div>
        <div class="menuConfigSecao">
          <h3>Acessibilidade</h3>
          <div class="menuConfigItem">
            <p>Tamanho do texto</p>
            <div class="alttexto">
              <button id="menuLess">−</button>
              <div id="menuBar"></div>
              <button id="menuPlus">+</button>
            </div>
          </div>
          <div class="menuConfigItem">
            <p>Alto contraste</p>
            <div class="retangleConfig" data-config="contraste">
              <div class="circleConfig"></div>
            </div>
          </div>
          <div class="menuConfigItem">
            <p>Tema escuro</p>
            <div class="retangleConfig" data-config="tema">
              <div class="circleConfig"></div>
            </div>
          </div>
          <div class="menuConfigItem">
            <p>Leitor de Notícia</p>
            <div class="retangleConfig" data-config="leitornoticias">
              <div class="circleConfig"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    shadow.appendChild(open);

    const chatInput = shadow.getElementById("chatInput");
    const chatEnviar = shadow.getElementById("chatEnviar");
    const chatMensagens = shadow.getElementById("chatMensagens");
    const menuConfig = shadow.getElementById("menuConfig");
    const settingsBtn = shadow.getElementById("settings");
    const fecharConfigBtn = shadow.getElementById("fecharConfig");
    const menuLogout = shadow.getElementById("menuLogout");
    const menuNomeUsuario = shadow.getElementById("menuNomeUsuario");
    const menuBar = shadow.getElementById("menuBar");
    const menuLess = shadow.getElementById("menuLess");
    const menuPlus = shadow.getElementById("menuPlus");

    // Carrega nome do usuário
    chrome.storage.local.get("email", (resultado) => {
      if (resultado.email) {
        menuNomeUsuario.textContent = resultado.email.split("@")[0];
      }
    });

    // Abre/fecha menu de settings
    settingsBtn.addEventListener("click", () => {
      menuConfig.classList.toggle("escondido");
      if (!menuConfig.classList.contains("escondido")) {
        carregarConfigsMenu();
      }
    });

    fecharConfigBtn.addEventListener("click", () => {
      menuConfig.classList.add("escondido");
    });

    // Logout
    menuLogout.addEventListener("click", () => {
      chrome.storage.local.remove(["logado", "email", "configs"], () => {
        fecharSidebar();
      });
    });

    // Tamanho do texto
    let fontSize = 50;
    const minFont = 12;
    const maxFont = 24;

    function getSize() {
      return Math.round(minFont + (fontSize / 100) * (maxFont - minFont));
    }

    function updateFontBar() {
      menuBar.style.setProperty("--fill", fontSize + "%");
      // Aplica dentro do shadow DOM (não no documentElement)
      open.style.setProperty("--font-size", getSize() + "px");
    }

    menuLess.addEventListener("click", () => {
      fontSize = Math.max(0, fontSize - 10);
      updateFontBar();
      salvarConfigsMenu();
    });

    menuPlus.addEventListener("click", () => {
      fontSize = Math.min(100, fontSize + 10);
      updateFontBar();
      salvarConfigsMenu();
    });

    // Toggles
    shadow.querySelectorAll(".retangleConfig").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("ativo-config");
        const id = btn.dataset.config;
        const ativo = btn.classList.contains("ativo-config");

        if (id === "contraste") {
          // ✅ Aplica NO aside (elemento open), não no document.documentElement
          open.classList.toggle("alto-contraste", ativo);
        }
        if (id === "tema") {
          // ✅ Aplica NO aside (elemento open), não no document.documentElement
          open.classList.toggle("tema-escuro", ativo);
        }
        if (id === "leitornoticias") {
          document.removeEventListener("mouseup", lerTextoSelecionado);
          if (ativo) {
            document.addEventListener("mouseup", lerTextoSelecionado);
          } else {
            speechSynthesis.cancel();
          }
        }

        salvarConfigsMenu();
      });
    });

    // Salva configs no chrome.storage.local e no servidor
    async function salvarConfigsMenu() {
      const toggles = {};
      shadow.querySelectorAll(".retangleConfig").forEach((btn) => {
        toggles[btn.dataset.config] = btn.classList.contains("ativo-config");
      });

      const configs = { fontSize, toggles };
      chrome.storage.local.set({ configs });

      chrome.storage.local.get("email", async (resultado) => {
        if (!resultado.email) return;
        try {
          await fetch("http://localhost:3000/salvar-configs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resultado.email, configs }),
          });
        } catch (e) {
          console.warn(
            "[VerusAI] Falha ao salvar configs no servidor:",
            e.message,
          );
        }
      });
    }

    // Aplica configs no DOM
    function aplicarConfigs(configs) {
      const { fontSize: fs, toggles } = configs;

      if (fs !== undefined) {
        fontSize = fs;
        updateFontBar();
      }

      if (toggles) {
        shadow.querySelectorAll(".retangleConfig").forEach((btn) => {
          const id = btn.dataset.config;
          const ativo = !!toggles[id];

          btn.classList.toggle("ativo-config", ativo);

          if (id === "contraste") {
            // ✅ Aplica NO aside
            open.classList.toggle("alto-contraste", ativo);
          }
          if (id === "tema") {
            // ✅ Aplica NO aside
            open.classList.toggle("tema-escuro", ativo);
          }
          if (id === "leitornoticias") {
            document.removeEventListener("mouseup", lerTextoSelecionado);
            if (ativo) {
              document.addEventListener("mouseup", lerTextoSelecionado);
            } else {
              speechSynthesis.cancel();
            }
          }
        });
      }
    }

    // Carrega configs do servidor com fallback para chrome.storage.local
    async function carregarConfigsMenu() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["email", "configs"], async (resultado) => {
          let configs = resultado.configs || null;

          if (resultado.email) {
            try {
              const resposta = await fetch(
                "http://localhost:3000/carregar-configs",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: resultado.email }),
                },
              );

              if (resposta.ok) {
                const dados = await resposta.json();
                if (dados.configs && Object.keys(dados.configs).length > 0) {
                  configs = dados.configs;
                  chrome.storage.local.set({ configs });
                }
              }
            } catch (e) {
              console.warn(
                "[VerusAI] Usando configs locais (servidor indisponível)",
              );
            }
          }

          if (configs) aplicarConfigs(configs);
          resolve(configs);
        });
      });
    }

    // Carrega configs ao abrir a sidebar
    carregarConfigsMenu();

    // Primeira mensagem da IA
    if (analysis) {
      const msgIA = document.createElement("div");
      msgIA.className = "mensagemIAPrimeira";
      msgIA.innerHTML = `
        <h1 class="result">Resultado da Verificação</h1>
        <p id="textAnalysis">${analysis.texto}</p>
        <hr/>
        ${analysis.link ? `<div id="footerAnalysis">FONTES<br/>${analysis.link}</div>` : ""}
      `;
      chatMensagens.appendChild(msgIA);
      chatMensagens.scrollTop = chatMensagens.scrollHeight;
    }

    // Popup de login interno
    function criarPopupLoginInterno() {
      const existente = shadow.getElementById("login_popup_interno");
      if (existente) return;

      // Cria a máscara de bloqueio
      const mask = document.createElement("div");
      mask.id = "login_mask";
      shadow.querySelector("aside").appendChild(mask);

      const popup = document.createElement("div");
      popup.id = "login_popup_interno";
      popup.innerHTML = `
        <!-- TELA 1: LOGIN -->
        <div class="login_popup_tela ativa" id="tela_login">

          <div class="login_popup_logo">
            <img src="${logo}" alt="logo" />
          </div>

          <div class="login_gap">
            <div>
              <p class="login_popup_label">E-mail</p>
              <input type="email" class="login_popup_input" id="popup_email_login" placeholder="Digite seu e-mail" />
            </div>

            <div>
              <p class="login_popup_label">Senha</p>
              <input type="password" class="login_popup_input" id="popup_senha_login" placeholder="Digite sua senha" />
            </div>

            <p class="login_popup_esqueceu">
              <a id="popup_esqueceu_senha">Esqueceu a senha?</a>
            </p>

            <button class="login_popup_btn_confirmar" id="popup_confirmar_login">Confirmar</button>

            <button class="login_popup_btn_google" id="popup_google_login">
              <img src="${iconGoogle}" class="icon_googlelo_login"/> Continue with Google
            </button>

            <p class="login_popup_cadastro">Don't have an account? <a id="popup_cadastro_login">Log up</a></p>
          </div>
        </div>

        <!-- TELA 2: SOLICITAR RECUPERAÇÃO -->
        <div class="login_popup_tela" id="tela_solicitar">
          <p class="login_popup_voltar" id="voltar_login">← Voltar</p>
          <div class="recuperar_popup_logo">
            <img src="${logo}" alt="logo" />  
            <span>Recuperar Senha<small>Digite seu e-mail cadastrado</small></span>
          </div>
          <div class="recuperar_popup_input">
            <p class="login_popup_label">E-mail</p>
            <input type="email" class="login_popup_input" id="popup_email_recuperar" placeholder="Digite seu e-mail" />
          </div>
          <button class="login_popup_btn_confirmar" id="popup_enviar_token">Enviar Código</button>
        </div>

        <!-- TELA 3: REDEFINIR SENHA -->
        <div class="login_popup_tela" id="tela_redefinir">
          <p class="login_popup_voltar" id="voltar_solicitar">← Voltar</p>
          <div class="login_popup_logo">
            <img src="${logo}" alt="logo" />
            <span>Nova Senha<small>Digite o código recebido no e-mail</small></span>
          </div>
          <div id="mensagem_sucesso_email" class="login_popup_info" style="display: none;"></div>
          <div>
            <p class="login_popup_label">Código de Verificação</p>
            <input type="text" class="login_popup_input" id="popup_token" placeholder="Digite o código de 6 dígitos" maxlength="6" />
          </div>
          <div>
            <p class="login_popup_label">Nova Senha</p>
            <input type="password" class="login_popup_input" id="popup_nova_senha" placeholder="Digite a nova senha" />
          </div>
          <div>
            <p class="login_popup_label">Confirmar Senha</p>
            <input type="password" class="login_popup_input" id="popup_confirmar_senha" placeholder="Digite novamente" />
          </div>
          <button class="login_popup_btn_confirmar" id="popup_redefinir_senha">Redefinir Senha</button>
        </div>
      `;

      shadow.querySelector("aside").appendChild(popup);

      // Inputs para prevenir propagação de eventos
      setTimeout(() => {
        const inputs = [
          "popup_email_login",
          "popup_senha_login",
          "popup_email_recuperar",
          "popup_token",
          "popup_nova_senha",
          "popup_confirmar_senha",
        ];

        inputs.forEach((id) => {
          const input = shadow.getElementById(id);
          if (input) {
            input.addEventListener("keydown", (e) => e.stopPropagation());
            input.addEventListener("keyup", (e) => e.stopPropagation());
            input.addEventListener("keypress", (e) => e.stopPropagation());
          } else {
            console.warn(`Input não encontrado: ${id}`);
          }
        });
      }, 0);

      // Função para mudar de tela
      function mudarTela(telaId) {
        shadow
          .querySelectorAll(".login_popup_tela")
          .forEach((t) => t.classList.remove("ativa"));
        shadow.getElementById(telaId).classList.add("ativa");
      }

      // Função para remover popup e máscara
      function fecharPopupEMascara() {
        popup.remove();
        mask.remove();
      }
      // NAVEGAÇÃO ENTRE TELAS
      shadow
        .getElementById("popup_esqueceu_senha")
        .addEventListener("click", () => {
          mudarTela("tela_solicitar");
        });

      shadow.getElementById("voltar_login").addEventListener("click", () => {
        mudarTela("tela_login");
      });

      shadow
        .getElementById("voltar_solicitar")
        .addEventListener("click", () => {
          mudarTela("tela_solicitar");
        });

      // LOGIN NORMAL
      shadow
        .getElementById("popup_confirmar_login")
        .addEventListener("click", async () => {
          const email = shadow.getElementById("popup_email_login").value.trim();
          const senha = shadow.getElementById("popup_senha_login").value;

          if (!email || !senha) {
            alert("Preencha todos os campos.");
            return;
          }

          try {
            const resposta = await fetch("http://localhost:3000/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, senha }),
            });
            const dados = await resposta.json();

            if (resposta.ok) {
              chrome.storage.local.set(
                { logado: true, email: dados.email },
                () => {
                  fecharPopupEMascara();
                  menuNomeUsuario.textContent = dados.email.split("@")[0];
                },
              );
            } else {
              alert(dados.erro);
            }
          } catch (e) {
            alert("Erro ao conectar com o servidor.");
          }
        });

      // LOGIN COM GOOGLE
      shadow
        .getElementById("popup_google_login")
        .addEventListener("click", () => {
          if (!chrome.identity || !chrome.identity.getAuthToken) {
            alert("Login com Google não disponível. Use email e senha.");
            return;
          }

          chrome.identity.getAuthToken({ interactive: true }, async (token) => {
            if (chrome.runtime.lastError) {
              console.error("Erro OAuth:", chrome.runtime.lastError.message);
              alert("Erro ao fazer login com Google.");
              return;
            }

            if (!token) {
              alert("Não foi possível obter token.");
              return;
            }

            try {
              const res = await fetch(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              if (!res.ok) throw new Error(`API retornou status ${res.status}`);

              const user = await res.json();

              chrome.storage.local.set(
                { logado: true, email: user.email },
                () => {
                  fecharPopupEMascara();
                  menuNomeUsuario.textContent = user.email.split("@")[0];
                },
              );
            } catch (error) {
              console.error("Erro ao processar login Google:", error);
              alert("Erro ao processar login.");
            }
          });
        });

      // CADASTRO
      shadow
        .getElementById("popup_cadastro_login")
        .addEventListener("click", () => {
          chrome.runtime.sendMessage({ action: "abrirCadastro" });
        });

      // SOLICITAR RECUPERAÇÃO (ENVIAR TOKEN POR EMAIL)
      // SOLICITAR RECUPERAÇÃO (ENVIAR TOKEN POR EMAIL)
      shadow
        .getElementById("popup_enviar_token")
        .addEventListener("click", async () => {
          const email = shadow
            .getElementById("popup_email_recuperar")
            .value.trim();

          if (!email) {
            alert("Digite seu e-mail.");
            return;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            alert("Digite um e-mail válido.");
            return;
          }

          try {
            const resposta = await fetch(
              "http://localhost:3000/recuperar-senha",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              },
            );

            // ✅ Verifica se a resposta é JSON
            const contentType = resposta.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              console.error(
                "Servidor retornou HTML ao invés de JSON. Verifique se o servidor está rodando corretamente.",
              );
              alert(
                "Erro de comunicação com o servidor. Verifique se o servidor está rodando.",
              );
              return;
            }

            const dados = await resposta.json();

            if (resposta.ok) {
              const msgEl = shadow.getElementById("mensagem_sucesso_email");
              msgEl.textContent = `📧 Enviamos um código de 6 dígitos para ${email}. Verifique sua caixa de entrada e spam.`;
              msgEl.style.display = "block";

              mudarTela("tela_redefinir");
              shadow.getElementById("popup_token").dataset.email = email;
            } else {
              alert(dados.erro || "Erro ao solicitar recuperação.");
            }
          } catch (e) {
            console.error("Erro recuperação:", e);
            alert(
              "Erro ao conectar com o servidor. Verifique se ele está rodando em http://localhost:3000",
            );
          }
        });

      // REDEFINIR SENHA COM TOKEN
      shadow
        .getElementById("popup_redefinir_senha")
        .addEventListener("click", async () => {
          const token = shadow.getElementById("popup_token").value.trim();
          const novaSenha = shadow.getElementById("popup_nova_senha").value;
          const confirmarSenha = shadow.getElementById(
            "popup_confirmar_senha",
          ).value;

          if (!token || !novaSenha || !confirmarSenha) {
            alert("Preencha todos os campos.");
            return;
          }

          if (novaSenha !== confirmarSenha) {
            alert("As senhas não coincidem.");
            return;
          }

          if (novaSenha.length < 6) {
            alert("A senha deve ter no mínimo 6 caracteres.");
            return;
          }

          try {
            const resposta = await fetch(
              "http://localhost:3000/redefinir-senha",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, novaSenha }),
              },
            );

            const dados = await resposta.json();

            if (resposta.ok) {
              alert(
                "✅ Senha redefinida com sucesso! Faça login com sua nova senha.",
              );
              mudarTela("tela_login");
              // Limpa os campos
              shadow.getElementById("popup_token").value = "";
              shadow.getElementById("popup_nova_senha").value = "";
              shadow.getElementById("popup_confirmar_senha").value = "";
              shadow.getElementById("mensagem_sucesso_email").style.display =
                "none";
            } else {
              alert(dados.erro || "Erro ao redefinir senha.");
            }
          } catch (e) {
            alert("Erro ao conectar com o servidor.");
            console.error("Erro redefinir:", e);
          }
        });
    }

    if (mostrarLoginImediato) {
      setTimeout(() => criarPopupLoginInterno(), 100);
    } else {
      setTimeout(() => chatInput.focus(), 100);
    }

    chatInput.addEventListener("focus", async () => {
      if (shadow.getElementById("login_popup_interno")) return;
      const logado = await verificarLogin();
      if (!logado) {
        chatInput.blur();
        criarPopupLoginInterno();
      }
    });

    chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") enviarMensagem();
    });
    chatInput.addEventListener("keyup", (e) => e.stopPropagation());
    chatInput.addEventListener("keypress", (e) => e.stopPropagation());

    async function enviarMensagem() {
      const logado = await verificarLogin();
      if (!logado) {
        chatInput.blur();
        criarPopupLoginInterno();
        return;
      }

      const texto = chatInput.value.trim();
      if (!texto) return;

      const msgUsuario = document.createElement("div");
      msgUsuario.className = "mensagemUsuario";
      msgUsuario.textContent = texto;
      chatMensagens.appendChild(msgUsuario);
      chatInput.value = "";
      chatMensagens.scrollTop = chatMensagens.scrollHeight;

      const msgIA = document.createElement("div");
      msgIA.className = "mensagemIA";
      msgIA.textContent = "Digitando...";
      chatMensagens.appendChild(msgIA);
      chatMensagens.scrollTop = chatMensagens.scrollHeight;

      try {
        const resposta = await analyzeWithClaude(texto, [], null);
        msgIA.innerHTML = resposta.texto || resposta;
        if (resposta.link) msgIA.innerHTML += `<br/><br/>${resposta.link}`;
      } catch (e) {
        msgIA.textContent = "Erro ao obter resposta.";
      }

      chatMensagens.scrollTop = chatMensagens.scrollHeight;
    }

    chatEnviar.addEventListener("click", enviarMensagem);
  }

  function CreateButton() {
    if (document.getElementById(BTN_ID)) return;

    const button = document.createElement("button");
    button.id = BTN_ID;
    button.type = "button";
    button.textContent = "Analisar";
    button.setAttribute("aria-label", "Abrir painel de Analise");

    button.addEventListener("click", async () => {
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (sidebar) {
        fecharSidebar();
        button.textContent = "Analisar";
        return;
      }

      const article = getVisibleArticle();
      if (!article) {
        alert("Nenhum post visível encontrado.");
        return;
      }

      const expanded = expandPost(article);
      if (expanded) await new Promise((resolve) => setTimeout(resolve, 400));

      const text = article.innerText;
      const video = article.querySelector("video");
      const img = article.querySelector("img");

      button.textContent = "Analisando...";
      button.disabled = true;

      let analysis = { texto: "", link: "" };

      try {
        if (video) {
          const frames = await captureFrames(video);
          analysis = await analyzeWithClaude(text, frames);
        } else {
          const imageUrl = img ? img.src : null;
          analysis = await analyzeWithClaude(text, [], imageUrl);
        }
      } catch (e) {
        analysis = { texto: "Erro ao analisar o conteúdo.", link: "" };
      }

      criarSidebar(analysis);
      button.textContent = "Fechar";
      button.disabled = false;
    });

    const buttonChat = document.createElement("button");
    buttonChat.id = BTN_CHAT_ID;
    buttonChat.type = "button";
    buttonChat.textContent = "💬";
    buttonChat.setAttribute("aria-label", "Abrir chat");

    buttonChat.addEventListener("click", async () => {
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (sidebar) {
        fecharSidebar();
        return;
      }
      const logado = await verificarLogin();
      criarSidebar(null, !logado);
    });

    document.body.appendChild(button);
    document.body.appendChild(buttonChat);
  }

  function init() {
    CreateButton();
  }
  init();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) init();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  chrome.storage.local.get("configs", (resultado) => {
    if (resultado.configs?.toggles?.leitornoticias) ativarLeitor();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.configs) {
      if (changes.configs.newValue?.toggles?.leitornoticias) {
        ativarLeitor();
      } else {
        desativarLeitor();
      }
    }
  });

  function ativarLeitor() {
    document.addEventListener("mouseup", lerTextoSelecionado);
  }

  function desativarLeitor() {
    speechSynthesis.cancel();
    document.removeEventListener("mouseup", lerTextoSelecionado);
  }

  function lerTextoSelecionado() {
    const texto = window.getSelection().toString().trim();
    if (texto) falar(texto);
  }

  function falar(texto) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
})();
