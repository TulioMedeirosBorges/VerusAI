// content/chat/chat.js
// Logica isolada do chat de noticias usado pelo sidebar.

(function () {
  var HISTORICO_KEY = "verus_chat_historico_v1";
  var LIMITE_HISTORICO = 80;

  function escapeHTML(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function recortar(valor, limite) {
    var texto = String(valor || "");
    return texto.length > limite ? texto.slice(0, limite) : texto;
  }

  function enviarFetch(url, method, body) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(
        {
          type: "FETCH",
          url: url,
          method: method || "GET",
          headers: { "Content-Type": "application/json" },
          body: body,
        },
        resolve,
      );
    });
  }

  async function obterUsuario() {
    var dados = await storageGet(["logado", "email", "nome"]);
    return {
      logado: dados.logado === true,
      email: dados.email || "",
      nome: dados.nome || "",
    };
  }

  async function obterContextoPagina(analysis) {
    if (analysis && analysis._payload) return analysis._payload;

    if (window.PageExtractor && typeof PageExtractor.extract === "function") {
      try {
        return await PageExtractor.extract();
      } catch (err) {
        console.warn("[VerusChat] falha ao extrair pagina:", err);
      }
    }

    return {
      url: window.location.href,
      title: document.title,
      text: document.body?.innerText || "",
    };
  }

  async function carregarHistoricoLocal() {
    var dados = await storageGet(HISTORICO_KEY);
    var historico = dados[HISTORICO_KEY];
    return Array.isArray(historico) ? historico : [];
  }

  async function salvarHistoricoLocal(item) {
    var historico = await carregarHistoricoLocal();
    historico.unshift(item);
    historico = historico.slice(0, LIMITE_HISTORICO);
    var payload = {};
    payload[HISTORICO_KEY] = historico;
    await storageSet(payload);
    return historico;
  }

  async function limparHistoricoLocal() {
    var payload = {};
    payload[HISTORICO_KEY] = [];
    await storageSet(payload);
  }

  async function carregarHistoricoServidor(email) {
    if (!email) return [];
    var res = await enviarFetch(
      "http://localhost:3000/chat/historico?email=" +
        encodeURIComponent(email),
      "GET",
    );
    if (!res || !res.ok || !res.data) return [];
    return Array.isArray(res.data.historico) ? res.data.historico : [];
  }

  async function limparHistoricoServidor(email) {
    if (!email) return;
    await enviarFetch("http://localhost:3000/chat/historico", "DELETE", {
      email: email,
    });
  }

  function pertoDoFim(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  function rolarParaFim(el, deveRolar) {
    if (deveRolar) el.scrollTop = el.scrollHeight;
  }

  function ajustarAlturaInput(input) {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  function adicionarMensagem(chatMensagens, classe, texto) {
    var msg = document.createElement("div");
    msg.className = classe;
    msg.textContent = texto;
    chatMensagens.appendChild(msg);
    return msg;
  }

  function renderizarMensagemIA(msg, html) {
    msg.innerHTML = String(html || "");
  }

  function mostrarDigitando(msg) {
    msg.className = "mensagemIA mensagemIA-loading";
    msg.setAttribute("role", "status");
    msg.setAttribute("aria-live", "polite");
    msg.innerHTML =
      '<div class="webTypingLoader">' +
      '<div class="webTypingTrack" aria-hidden="true">' +
      '<span class="webPageParticle"></span>' +
      '<span class="webPageParticle"></span>' +
      '<span class="webPageParticle"></span>' +
      '<span class="webPageParticle"></span>' +
      '<span class="webPageParticle"></span>' +
      "</div>" +
      '<span class="webTypingText">Digitando</span>' +
      "</div>";
  }

  function finalizarDigitando(msg, texto) {
    msg.className = "mensagemIA";
    msg.removeAttribute("role");
    msg.removeAttribute("aria-live");
    renderizarMensagemIA(msg, texto);
  }

  function formatarData(valor) {
    try {
      var data = new Date(valor);
      if (Number.isNaN(data.getTime())) return "";
      return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return "";
    }
  }

  function renderizarHistorico(state, historico) {
    var lista = state.historicoLista;
    if (!lista) return;

    if (!historico.length) {
      lista.innerHTML =
        '<p class="chatHistoricoVazio">Nenhuma conversa salva ainda.</p>';
      return;
    }

    lista.innerHTML = historico
      .map(function (item, index) {
        return (
          '<button class="chatHistoricoItem" type="button" data-index="' +
          index +
          '">' +
          "<strong>" +
          escapeHTML(item.pergunta || "") +
          "</strong>" +
          "<small>" +
          escapeHTML(formatarData(item.criado_em || item.criadoEm)) +
          "</small>" +
          "<span>" +
          escapeHTML(recortar(item.resposta || "", 180)) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    lista.querySelectorAll(".chatHistoricoItem").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = historico[Number(btn.dataset.index)];
        if (!item) return;
        var estavaNoFim = pertoDoFim(state.chatMensagens);
        adicionarMensagem(state.chatMensagens, "mensagemUsuario", item.pergunta);
        var msgIA = adicionarMensagem(state.chatMensagens, "mensagemIA", "");
        renderizarMensagemIA(msgIA, item.resposta);
        state.historicoPanel.classList.add("escondido");
        rolarParaFim(state.chatMensagens, estavaNoFim);
      });
    });
  }

  async function abrirHistorico(state) {
    var usuario = await obterUsuario();
    var local = await carregarHistoricoLocal();
    var servidor = usuario.logado
      ? await carregarHistoricoServidor(usuario.email)
      : [];
    var combinado = servidor.length ? servidor : local;
    renderizarHistorico(state, combinado);
    state.historicoPanel.classList.toggle("escondido");
  }

  function abrirLoginSeNecessario(state) {
    if (state.shadow.getElementById("login_popup_interno")) return;
    state.chatInput.blur();
    criarPopupLoginInterno(state.shadow, function (email, nome) {
      if (state.menuNomeUsuario) {
        state.menuNomeUsuario.textContent = nome || email.split("@")[0];
      }
    });
  }

  async function enviarMensagem(state) {
    var usuario = await obterUsuario();
    if (!usuario.logado) {
      abrirLoginSeNecessario(state);
      return;
    }

    var texto = state.chatInput.value.trim();
    if (!texto) return;

    var pageData = await obterContextoPagina(state.analysis);
    var estavaNoFim = pertoDoFim(state.chatMensagens);
    adicionarMensagem(state.chatMensagens, "mensagemUsuario", texto);
    state.chatInput.value = "";
    ajustarAlturaInput(state.chatInput);
    rolarParaFim(state.chatMensagens, estavaNoFim);

    var msgIA = adicionarMensagem(state.chatMensagens, "mensagemIA", "");
    mostrarDigitando(msgIA);
    rolarParaFim(state.chatMensagens, estavaNoFim);

    try {
      var res = await enviarFetch("http://localhost:3000/chat/noticias", "POST", {
        pergunta: texto,
        email: usuario.email,
        page: {
          url: pageData.url || window.location.href,
          title: pageData.title || document.title,
          description: pageData.description || "",
          siteName: pageData.siteName || "",
          author: pageData.author || "",
          publishDate: pageData.publishDate || "",
          text: recortar(pageData.text || pageData.textContent || "", 9000),
        },
      });

      if (!res || !res.ok) {
        throw new Error(res?.data?.erro || res?.error || "Erro no servidor.");
      }

      var resposta = res.data?.resposta || "Nao consegui responder agora.";
      finalizarDigitando(msgIA, resposta);

      var itemHistorico = {
        id: res.data?.id || String(Date.now()),
        pergunta: texto,
        resposta: resposta,
        url: pageData.url || window.location.href,
        title: pageData.title || document.title,
        criadoEm: res.data?.criado_em || new Date().toISOString(),
      };
      await salvarHistoricoLocal(itemHistorico);
    } catch (err) {
      finalizarDigitando(
        msgIA,
        err.message || "Erro ao responder a pergunta sobre a noticia.",
      );
    }

    rolarParaFim(state.chatMensagens, estavaNoFim);
  }

  window.VerusChat = {
    inicializar: function (options) {
      var state = {
        shadow: options.shadow,
        analysis: options.analysis || null,
        chatInput: options.shadow.getElementById("chatInput"),
        chatEnviar: options.shadow.getElementById("chatEnviar"),
        chatMensagens: options.shadow.getElementById("chatMensagens"),
        historicoBtn: options.shadow.getElementById("chatHistoricoBtn"),
        historicoPanel: options.shadow.getElementById("chatHistoricoPanel"),
        historicoLista: options.shadow.getElementById("chatHistoricoLista"),
        historicoFechar: options.shadow.getElementById("chatHistoricoFechar"),
        historicoLimpar: options.shadow.getElementById("chatHistoricoLimpar"),
        menuNomeUsuario: options.menuNomeUsuario,
      };

      state.chatInput.addEventListener("focus", async function () {
        if (state.shadow.getElementById("login_popup_interno")) return;
        var usuario = await obterUsuario();
        if (!usuario.logado) abrirLoginSeNecessario(state);
      });

      state.chatInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          enviarMensagem(state);
        }
      });
      state.chatInput.addEventListener("input", function (e) {
        e.stopPropagation();
        ajustarAlturaInput(state.chatInput);
      });
      state.chatInput.addEventListener("keyup", function (e) {
        e.stopPropagation();
      });

      state.chatEnviar.addEventListener("click", function () {
        enviarMensagem(state);
      });

      state.historicoBtn.addEventListener("click", function () {
        abrirHistorico(state);
      });

      state.historicoFechar.addEventListener("click", function () {
        state.historicoPanel.classList.add("escondido");
      });

      state.historicoLimpar.addEventListener("click", async function () {
        var usuario = await obterUsuario();
        await limparHistoricoLocal();
        if (usuario.logado) await limparHistoricoServidor(usuario.email);
        renderizarHistorico(state, []);
      });
    },
  };
})();
