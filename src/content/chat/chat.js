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

  // Converte uma resposta da IA (que pode conter HTML, ex.: <a>, <strong>)
  // em texto puro, para usar no preview do historico sem mostrar as tags.
  function textoSimples(valor) {
    var div = document.createElement("div");
    div.innerHTML = String(valor == null ? "" : valor);
    return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
  }

  // ── Comandos do chat (acionados com "@") ─────────────────────────
  // "analise" dispara o pipeline completo da pagina atual; os demais
  // viram uma pergunta especifica enviada para a IA do chat.
  var COMANDOS = [
    {
      nome: "analise",
      icone: "🔍",
      descricao: "Verificação completa da notícia desta página",
      precisaTexto: false,
    },
    {
      nome: "resumo",
      icone: "📝",
      descricao: "Resumir uma notícia — escreva ou cole o conteúdo",
      precisaTexto: true,
      dica:
        "Escreva a notícia ou o tema após @resumo. Ex.: @resumo cole aqui o texto da matéria.",
      montarPergunta: function (arg) {
        return (
          "Faça um resumo claro e objetivo da seguinte notícia, destacando os " +
          "pontos principais em poucos parágrafos:\n\n" +
          arg
        );
      },
    },
    {
      nome: "fontes",
      icone: "📚",
      descricao: "Avaliar a credibilidade das fontes de uma notícia",
      precisaTexto: true,
      dica: "Escreva a notícia ou as fontes que deseja avaliar após @fontes.",
      montarPergunta: function (arg) {
        return (
          "Avalie a credibilidade e a confiabilidade das fontes relacionadas à " +
          "notícia a seguir. Indique quais são confiáveis, quais merecem cautela " +
          "e explique o porquê:\n\n" +
          arg
        );
      },
    },
    {
      nome: "verificar",
      icone: "✅",
      descricao: "Checar se uma afirmação específica é verdadeira",
      precisaTexto: true,
      dica: "Escreva a afirmação que deseja checar após @verificar.",
      montarPergunta: function (arg) {
        return (
          "Verifique se a afirmação a seguir é verdadeira, falsa ou imprecisa. " +
          "Explique o porquê com base em fatos e diga que tipo de fonte " +
          "confirmaria ou refutaria:\n\n" +
          arg
        );
      },
    },
  ];

  function acharComando(nome) {
    var alvo = String(nome || "").toLowerCase();
    for (var i = 0; i < COMANDOS.length; i++) {
      if (COMANDOS[i].nome === alvo) return COMANDOS[i];
    }
    return null;
  }

  function comandosFiltrados(filtro) {
    var alvo = String(filtro || "").toLowerCase();
    return COMANDOS.filter(function (cmd) {
      return cmd.nome.indexOf(alvo) === 0;
    });
  }

  // Texto enviado -> comando + argumento (ou null se nao for comando).
  function detectarComando(texto) {
    var m = String(texto || "").match(/^@([a-zA-Z]+)(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    var cmd = acharComando(m[1]);
    if (!cmd) return null;
    return { cmd: cmd, argumento: (m[2] || "").trim() };
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
          escapeHTML(recortar(textoSimples(item.resposta), 180)) +
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

  // Envia uma pergunta para a IA do chat. "exibir" e o texto mostrado como
  // mensagem do usuario; "pergunta" e o que de fato vai para a IA.
  async function enviarParaIA(state, opts) {
    var usuario = await obterUsuario();
    var exibir = opts.exibir;
    var pergunta = opts.pergunta;

    var pageData = await obterContextoPagina(state.analysis);
    var estavaNoFim = pertoDoFim(state.chatMensagens);
    adicionarMensagem(state.chatMensagens, "mensagemUsuario", exibir);
    rolarParaFim(state.chatMensagens, estavaNoFim);

    var msgIA = adicionarMensagem(state.chatMensagens, "mensagemIA", "");
    mostrarDigitando(msgIA);
    rolarParaFim(state.chatMensagens, estavaNoFim);

    try {
      var res = await enviarFetch("http://localhost:3000/chat/noticias", "POST", {
        pergunta: pergunta,
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
        pergunta: exibir,
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

  // Dispara o pipeline completo de analise da pagina atual (mesma logica do
  // botao "Analisar") e renderiza o resultado dentro do chat.
  async function executarAnalise(state) {
    adicionarMensagem(state.chatMensagens, "mensagemUsuario", "@analise");
    state.chatMensagens.scrollTop = state.chatMensagens.scrollHeight;

    var sessao =
      typeof _obterSessaoAnalise === "function"
        ? await _obterSessaoAnalise()
        : null;
    if (!sessao || !sessao.logado) {
      abrirLoginSeNecessario(state);
      return;
    }

    if (
      typeof PageExtractor === "undefined" ||
      typeof _iniciarAnaliseIA !== "function" ||
      typeof _aguardarAnaliseIA !== "function" ||
      typeof _renderAnalysis !== "function"
    ) {
      var msgInd = adicionarMensagem(state.chatMensagens, "mensagemIA", "");
      finalizarDigitando(
        msgInd,
        "Não foi possível iniciar a análise nesta página.",
      );
      return;
    }

    var msgIA = adicionarMensagem(state.chatMensagens, "mensagemIA", "");
    mostrarDigitando(msgIA);
    state.chatMensagens.scrollTop = state.chatMensagens.scrollHeight;

    var progresso =
      typeof _criarPopupProgresso === "function" ? _criarPopupProgresso() : null;

    try {
      var payload = await PageExtractor.extract();
      if (progresso) progresso.setStage(1);

      var job = await _iniciarAnaliseIA(payload, sessao.authToken);
      if (progresso && job.progress) progresso.syncPipeline(job.progress);

      var resultado = await _aguardarAnaliseIA(job.jobId, progresso);
      if (progresso) progresso.finish();

      msgIA.remove();
      _renderAnalysis(
        state.shadow,
        null,
        { _payload: payload, _resultado: resultado },
        state.chatMensagens,
      );

      var ultimo = state.chatMensagens.lastElementChild;
      if (ultimo && ultimo.scrollIntoView) {
        ultimo.scrollIntoView({ block: "start" });
      }

      if (progresso) {
        setTimeout(function () {
          progresso.remove();
        }, 650);
      }
    } catch (e) {
      if (progresso) {
        progresso.fail(e.message);
        setTimeout(function () {
          progresso.remove();
        }, 2600);
      }
      finalizarDigitando(msgIA, e.message || "Erro ao analisar a notícia.");
    }
  }

  function executarComando(state, deteccao) {
    var cmd = deteccao.cmd;
    var arg = deteccao.argumento;

    if (cmd.nome === "analise") {
      return executarAnalise(state);
    }

    if (cmd.precisaTexto && !arg) {
      var estavaNoFim = pertoDoFim(state.chatMensagens);
      adicionarMensagem(state.chatMensagens, "mensagemUsuario", "@" + cmd.nome);
      var aviso = adicionarMensagem(state.chatMensagens, "mensagemIA", "");
      finalizarDigitando(aviso, cmd.dica || "Escreva o conteúdo após o comando.");
      rolarParaFim(state.chatMensagens, estavaNoFim);
      return;
    }

    return enviarParaIA(state, {
      exibir: "@" + cmd.nome + (arg ? " " + arg : ""),
      pergunta: cmd.montarPergunta(arg),
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

    esconderMenu(state);
    state.chatInput.value = "";
    ajustarAlturaInput(state.chatInput);

    var deteccao = detectarComando(texto);
    if (deteccao) {
      return executarComando(state, deteccao);
    }

    return enviarParaIA(state, { exibir: texto, pergunta: texto });
  }

  // ── Menu de autocomplete dos comandos ────────────────────────────
  function menuAberto(state) {
    return (
      state.menuComandos &&
      !state.menuComandos.classList.contains("escondido")
    );
  }

  function esconderMenu(state) {
    if (state.menuComandos) state.menuComandos.classList.add("escondido");
    state.menuLista = [];
    state.menuItens = [];
    state.menuIndice = -1;
  }

  function destacarItem(state, indice) {
    state.menuIndice = indice;
    (state.menuItens || []).forEach(function (btn, i) {
      btn.classList.toggle("ativo", i === indice);
    });
  }

  function moverSelecao(state, delta) {
    if (!state.menuLista || !state.menuLista.length) return;
    var total = state.menuLista.length;
    var novo = (state.menuIndice + delta + total) % total;
    destacarItem(state, novo);
    var item = state.menuItens[novo];
    if (item && item.scrollIntoView) item.scrollIntoView({ block: "nearest" });
  }

  function selecionarComando(state, cmd) {
    if (!cmd) return;
    esconderMenu(state);
    if (!cmd.precisaTexto) {
      state.chatInput.value = "@" + cmd.nome;
      enviarMensagem(state);
      return;
    }
    state.chatInput.value = "@" + cmd.nome + " ";
    state.chatInput.focus();
    ajustarAlturaInput(state.chatInput);
  }

  function renderizarMenuComandos(state, lista) {
    state.menuComandos.innerHTML =
      '<div class="chatComandosTitulo">Comandos</div>' +
      lista
        .map(function (cmd, i) {
          return (
            '<button class="chatComandoItem' +
            (i === 0 ? " ativo" : "") +
            '" type="button" role="option" data-cmd="' +
            cmd.nome +
            '">' +
            '<span class="chatComandoIcone">' +
            cmd.icone +
            "</span>" +
            '<span class="chatComandoTexto">' +
            "<strong>@" +
            cmd.nome +
            "</strong>" +
            "<small>" +
            escapeHTML(cmd.descricao) +
            "</small>" +
            "</span>" +
            "</button>"
          );
        })
        .join("");

    state.menuLista = lista;
    state.menuIndice = lista.length ? 0 : -1;
    state.menuItens = Array.prototype.slice.call(
      state.menuComandos.querySelectorAll(".chatComandoItem"),
    );

    state.menuItens.forEach(function (btn, i) {
      // mousedown antes do blur: evita que o input perca o foco e feche o menu.
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      btn.addEventListener("click", function () {
        selecionarComando(state, lista[i]);
      });
      btn.addEventListener("mousemove", function () {
        destacarItem(state, i);
      });
    });
  }

  // Linha sutil no topo do chat lembrando os comandos disponiveis.
  function montarDicaComandos(state) {
    if (!state.comandosDica) return;
    state.comandosDica.innerHTML =
      '<span class="chatDicaLabel">Comandos</span>' +
      COMANDOS.map(function (cmd) {
        return (
          '<button type="button" class="chatDicaChip" data-cmd="' +
          cmd.nome +
          '" title="' +
          escapeHTML(cmd.descricao) +
          '">@' +
          cmd.nome +
          "</button>"
        );
      }).join("");

    state.comandosDica
      .querySelectorAll(".chatDicaChip")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          var cmd = acharComando(btn.dataset.cmd);
          if (!cmd) return;
          state.chatInput.value = "@" + cmd.nome + (cmd.precisaTexto ? " " : "");
          state.chatInput.focus();
          ajustarAlturaInput(state.chatInput);
        });
      });
  }

  function atualizarMenu(state) {
    if (!state.menuComandos) return;
    var m = state.chatInput.value.match(/^\s*@([a-zA-Z]*)$/);
    if (!m) {
      esconderMenu(state);
      return;
    }
    var lista = comandosFiltrados(m[1]);
    if (!lista.length) {
      esconderMenu(state);
      return;
    }
    renderizarMenuComandos(state, lista);
    state.menuComandos.classList.remove("escondido");
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
        menuLista: [],
        menuItens: [],
        menuIndice: -1,
      };

      // Painel de autocomplete dos comandos (digitar "@").
      var footer = options.shadow.querySelector(".chatFooter");
      state.menuComandos = document.createElement("div");
      state.menuComandos.id = "chatComandos";
      state.menuComandos.className = "chatComandos escondido";
      state.menuComandos.setAttribute("role", "listbox");
      if (footer) footer.appendChild(state.menuComandos);

      // Lembrete sutil dos comandos no topo do chat.
      state.comandosDica = options.shadow.getElementById("chatComandosDica");
      montarDicaComandos(state);

      state.chatInput.addEventListener("focus", async function () {
        if (state.shadow.getElementById("login_popup_interno")) return;
        var usuario = await obterUsuario();
        if (!usuario.logado) abrirLoginSeNecessario(state);
      });

      state.chatInput.addEventListener("keydown", function (e) {
        e.stopPropagation();

        if (menuAberto(state)) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            moverSelecao(state, 1);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            moverSelecao(state, -1);
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            selecionarComando(state, state.menuLista[state.menuIndice]);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            esconderMenu(state);
            return;
          }
        }

        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          enviarMensagem(state);
        }
      });
      state.chatInput.addEventListener("input", function (e) {
        e.stopPropagation();
        ajustarAlturaInput(state.chatInput);
        atualizarMenu(state);
      });
      state.chatInput.addEventListener("blur", function () {
        // pequeno atraso para permitir o clique em um item do menu.
        setTimeout(function () {
          esconderMenu(state);
        }, 150);
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
