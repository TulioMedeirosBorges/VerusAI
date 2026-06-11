// ui/button.js
var _buttonStyle = document.createElement("style");
_buttonStyle.textContent =
  "#btn_wrapper { --verus-ink:#171715; --verus-cream:#f4ecdf; --verus-red:#d3392d; --verus-blue:#02519b; position:fixed; right:16px; bottom:24px; z-index:2147483647; display:flex; flex-direction:row; align-items:center; gap:8px; font-family:'Space Mono','Courier New',monospace; }" +
  "#btn_id, #btn_chat_id { min-height:44px; border:2px solid var(--verus-ink); border-radius:4px; box-sizing:border-box; color:var(--verus-cream); cursor:pointer; transition:background 0.2s ease,border-color 0.2s ease,transform 0.2s ease,color 0.2s ease; white-space:nowrap; }" +
  "#btn_id { padding:0 16px; background:var(--verus-red); border-color:var(--verus-red); font-family:'Space Mono','Courier New',monospace; font-size:12px; font-weight:700; letter-spacing:0.06em; line-height:1; text-transform:uppercase; }" +
  "#btn_chat_id { width:44px; padding:0; display:inline-flex; align-items:center; justify-content:center; background:var(--verus-ink); border-color:var(--verus-cream); font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; font-size:18px; line-height:1; }" +
  "#btn_chat_id svg { width:20px; height:20px; display:block; }" +
  "#btn_id:hover { background:var(--verus-ink); border-color:var(--verus-ink); transform:translateY(-2px); }" +
  "#btn_chat_id:hover { background:var(--verus-blue); border-color:var(--verus-blue); transform:translateY(-2px); }" +
  "#btn_id:active, #btn_chat_id:active { transform:translateY(0); }" +
  "#btn_id:focus-visible, #btn_chat_id:focus-visible { outline:2px solid var(--verus-red); outline-offset:3px; }" +
  "#btn_id:disabled, #btn_chat_id:disabled { opacity:0.65; cursor:wait; transform:none; }" +
  "#sidebar_overlay { position:fixed; top:0; left:0; width:100%; height:100%; z-index:41235122; background:transparent; }" +
  "@keyframes verusProgressIn { from { opacity:0; transform:translateY(12px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }" +
  "@keyframes verusProgressPulse { 0%,100% { transform:scale(1); opacity:0.55; } 50% { transform:scale(1.45); opacity:1; } }" +
  "@keyframes verusProgressSweep { from { transform:translateX(-120%); } to { transform:translateX(220%); } }" +
  "@keyframes verusProgressSpin { to { transform:rotate(360deg); } }" +
  ".verus-progress-popup { --verus-ink:#171715; --verus-cream:#f4ecdf; --verus-paper:#f9f4eb; --verus-red:#d3392d; --verus-blue:#02519b; position:fixed; right:16px; bottom:84px; z-index:2147483646; width:min(330px,calc(100vw - 24px)); border:2px solid var(--verus-ink); border-top:5px solid var(--verus-red); border-radius:4px; background:var(--verus-cream); color:var(--verus-ink); font-family:'Space Mono','Courier New',monospace; box-shadow:4px 4px 0 rgba(23,23,21,0.16),0 18px 42px rgba(23,23,21,0.28); animation:verusProgressIn 0.25s ease-out both; overflow:hidden; }" +
  ".verus-progress-popup.is-finished { border-top-color:#1a7a3c; }" +
  ".verus-progress-popup.is-error { border-top-color:var(--verus-red); }" +
  ".vp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 13px 9px; background:var(--verus-ink); color:var(--verus-cream); }" +
  ".vp-title { display:flex; flex-direction:column; gap:3px; min-width:0; }" +
  ".vp-eyebrow { font-size:9px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7; }" +
  ".vp-title strong { font-size:13px; line-height:1.2; letter-spacing:0.02em; }" +
  ".vp-head-right { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex:0 0 auto; }" +
  ".vp-percent { min-width:48px; text-align:right; font-size:18px; line-height:1; font-weight:800; color:var(--verus-cream); }" +
  ".vp-timer { display:inline-flex; align-items:center; gap:5px; font-family:'Courier New',monospace; font-size:13px; font-weight:700; letter-spacing:0.06em; color:var(--verus-cream); opacity:0.92; }" +
  ".vp-timer::before { content:''; width:6px; height:6px; border-radius:50%; background:var(--verus-red); animation:verusProgressPulse 1.2s ease-in-out infinite; }" +
  ".verus-progress-popup.is-finished .vp-timer::before { background:#1a7a3c; animation:none; }" +
  ".verus-progress-popup.is-error .vp-timer::before { background:var(--verus-red); animation:none; }" +
  ".vp-body { padding:12px 13px 13px; display:flex; flex-direction:column; gap:10px; }" +
  ".vp-stage-row { display:grid; grid-template-columns:28px 1fr; gap:9px; align-items:center; }" +
  ".vp-orbit { width:28px; height:28px; border:2px solid rgba(23,23,21,0.18); border-top-color:var(--verus-red); border-radius:50%; position:relative; animation:verusProgressSpin 1.3s linear infinite; }" +
  ".vp-orbit::after { content:''; position:absolute; inset:8px; border-radius:50%; background:var(--verus-blue); animation:verusProgressPulse 1.35s ease-in-out infinite; }" +
  ".verus-progress-popup.is-finished .vp-orbit { animation:none; border-color:#1a7a3c; }" +
  ".verus-progress-popup.is-finished .vp-orbit::after { background:#1a7a3c; animation:none; }" +
  ".vp-stage-copy { min-width:0; display:flex; flex-direction:column; gap:3px; }" +
  ".vp-step { color:rgba(23,23,21,0.55); font-size:9px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; }" +
  ".vp-label { color:var(--verus-ink); font-size:12px; line-height:1.25; font-weight:800; white-space:normal; }" +
  ".vp-detail { color:rgba(23,23,21,0.62); font-family:'Courier New',monospace; font-size:11px; line-height:1.35; }" +
  ".vp-bar { position:relative; height:9px; overflow:hidden; border:1.5px solid var(--verus-ink); border-radius:2px; background:rgba(23,23,21,0.08); }" +
  ".vp-fill { position:absolute; inset:0 auto 0 0; width:0%; background:linear-gradient(90deg,var(--verus-red),var(--verus-blue)); transition:width 0.45s cubic-bezier(0.22,1,0.36,1); overflow:hidden; }" +
  ".vp-fill::after { content:''; position:absolute; inset:0; width:40%; background:linear-gradient(90deg,transparent,rgba(244,236,223,0.65),transparent); animation:verusProgressSweep 1.6s ease-in-out infinite; }" +
  ".vp-segments { display:grid; grid-template-columns:repeat(var(--vp-total),1fr); gap:3px; }" +
  ".vp-segment { height:4px; border-radius:1px; background:rgba(23,23,21,0.16); transition:background 0.25s ease,transform 0.25s ease; }" +
  ".vp-segment.done { background:var(--verus-red); }" +
  ".vp-segment.active { background:var(--verus-blue); transform:scaleY(1.45); }" +
  ".vp-footer { display:flex; justify-content:space-between; gap:10px; color:rgba(23,23,21,0.56); font-size:9px; line-height:1.3; text-transform:uppercase; letter-spacing:0.06em; }" +
  "@media (max-width:480px) { #btn_wrapper { right:12px; bottom:16px; gap:6px; } #btn_id { padding:0 12px; font-size:11px; } #btn_chat_id { width:42px; min-height:42px; } .verus-progress-popup { right:12px; bottom:72px; width:calc(100vw - 24px); } }";
document.head.appendChild(_buttonStyle);

function _chatIconSvg() {
  return (
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20">' +
    '<path d="M5 6.5h14v8.2H9.7L5 18.2V6.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M8 10h8M8 13h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    "</svg>"
  );
}

var _ETAPAS = [
  {
    label: "Capturando conteúdo da página",
    detail: "Lendo texto, título, links e metadados no navegador.",
    duration: 1800,
  },
  {
    label: "Classificando a página",
    detail: "Confirmando se o conteúdo principal é uma notícia analisável.",
    duration: 4200,
  },
  {
    label: "Extraindo afirmações verificáveis",
    detail: "Separando as claims que precisam de checagem.",
    duration: 5600,
  },
  {
    label: "Detectando o tipo das claims",
    detail: "Identificando datas, nomes, locais, números e prioridade.",
    duration: 5200,
  },
  {
    label: "Gerando consultas de busca",
    detail: "Preparando pesquisas específicas para cada afirmação.",
    duration: 5600,
  },
  {
    label: "Selecionando fontes candidatas",
    detail: "Filtrando resultados que parecem úteis para a verificação.",
    duration: 6200,
  },
  {
    label: "Verificando links encontrados",
    detail: "Comparando candidatos com o texto das claims.",
    duration: 6200,
  },
  {
    label: "Roteando evidências",
    detail: "Separando o que exige fonte oficial, API ou só contexto.",
    duration: 4200,
  },
  {
    label: "Consultando fontes oficiais",
    detail: "Conferindo dados em fontes institucionais quando necessário.",
    duration: 7600,
  },
  {
    label: "Revisando a análise final",
    detail: "Consolidando veredito, confiança e alertas.",
    duration: 6200,
  },
  {
    label: "Auditando claims",
    detail: "Revisando fontes, contexto e risco do veredito.",
    duration: 5200,
  },
  {
    label: "Montando resposta visual",
    detail: "Preparando o JSON final para o painel.",
    duration: 3600,
  },
];

function _criarPopupProgresso() {
  var popup = document.createElement("div");
  popup.id = "verus_progress_popup";
  popup.className = "verus-progress-popup";
  popup.style.setProperty("--vp-total", _ETAPAS.length);
  popup.innerHTML =
    '<div class="vp-head">' +
    '<div class="vp-title">' +
    '<span class="vp-eyebrow">VerusIA</span>' +
    "<strong>Analisando notícia</strong>" +
    "</div>" +
    '<div class="vp-head-right">' +
    '<div class="vp-percent">0%</div>' +
    '<div class="vp-timer" title="Tempo decorrido">00:00</div>' +
    "</div>" +
    "</div>" +
    '<div class="vp-body">' +
    '<div class="vp-stage-row">' +
    '<div class="vp-orbit"></div>' +
    '<div class="vp-stage-copy">' +
    '<span class="vp-step"></span>' +
    '<span class="vp-label"></span>' +
    '<span class="vp-detail"></span>' +
    "</div>" +
    "</div>" +
    '<div class="vp-bar"><div class="vp-fill"></div></div>' +
    '<div class="vp-segments"></div>' +
    '<div class="vp-footer"><span>Pipeline em andamento</span><span class="vp-clock">estimando</span></div>' +
    "</div>";
  document.body.appendChild(popup);

  var pct = popup.querySelector(".vp-percent");
  var fill = popup.querySelector(".vp-fill");
  var step = popup.querySelector(".vp-step");
  var label = popup.querySelector(".vp-label");
  var detail = popup.querySelector(".vp-detail");
  var clock = popup.querySelector(".vp-clock");
  var timerEl = popup.querySelector(".vp-timer");
  var segments = popup.querySelector(".vp-segments");
  var segmentEls = [];
  var etapaAtual = 0;
  var progressoAtual = 0;
  var concluido = false;
  var falhou = false;
  var erroMensagem = "";
  var progressoServidor = null;
  var inicioMs = Date.now();
  var fimMs = null;

  function formatarTempo(ms) {
    var totalSeg = Math.max(0, Math.floor(ms / 1000));
    var min = Math.floor(totalSeg / 60);
    var seg = totalSeg % 60;
    return (
      (min < 10 ? "0" : "") + min + ":" + (seg < 10 ? "0" : "") + seg
    );
  }

  _ETAPAS.forEach(function () {
    var seg = document.createElement("span");
    seg.className = "vp-segment";
    segments.appendChild(seg);
    segmentEls.push(seg);
  });

  function calcularProgresso() {
    if (concluido) return 100;
    if (falhou) return progressoAtual;
    return Math.min(96, (etapaAtual / _ETAPAS.length) * 100);
  }

  function renderizar() {
    var etapa = _ETAPAS[etapaAtual] || _ETAPAS[_ETAPAS.length - 1];
    var alvo = calcularProgresso();

    if (!concluido && !falhou) {
      progressoAtual += (alvo - progressoAtual) * 0.24;
    } else {
      progressoAtual = alvo;
    }

    var inteiro = Math.round(progressoAtual);
    pct.textContent = inteiro + "%";
    fill.style.width = inteiro + "%";
    step.textContent =
      progressoServidor && progressoServidor.stage
        ? "Pipeline etapa " +
          progressoServidor.stage +
          " de " +
          (progressoServidor.totalStages || 11)
        : "Etapa " + (etapaAtual + 1) + " de " + _ETAPAS.length;
    label.textContent = falhou
      ? "Não foi possível concluir a análise"
      : progressoServidor?.label || etapa.label;
    detail.textContent = falhou
      ? erroMensagem || "O servidor retornou um erro."
      : progressoServidor?.detail || etapa.detail;
    clock.textContent = concluido
      ? "concluído"
      : falhou
        ? "interrompido"
        : "aguardando etapa real";

    if (timerEl) {
      timerEl.textContent = formatarTempo((fimMs || Date.now()) - inicioMs);
    }

    segmentEls.forEach(function (seg, index) {
      seg.classList.toggle("done", index < etapaAtual || concluido);
      seg.classList.toggle("active", index === etapaAtual && !concluido);
    });
  }

  function setStage(index, serverProgress) {
    var novoIndice = Math.max(0, Math.min(index, _ETAPAS.length - 1));
    if (novoIndice < etapaAtual && !falhou) return;
    etapaAtual = novoIndice;
    progressoServidor = serverProgress || null;
    renderizar();
  }

  var intervalo = setInterval(function () {
    renderizar();
  }, 180);

  renderizar();

  return {
    setStage: setStage,
    syncPipeline: function (serverProgress) {
      if (!serverProgress || !serverProgress.stage) return;
      setStage(serverProgress.stage, serverProgress);
    },
    finish: function () {
      concluido = true;
      fimMs = Date.now();
      etapaAtual = _ETAPAS.length - 1;
      popup.classList.add("is-finished");
      renderizar();
    },
    fail: function (mensagem) {
      falhou = true;
      fimMs = Date.now();
      erroMensagem = mensagem || "O servidor retornou um erro.";
      popup.classList.add("is-error");
      renderizar();
    },
    remove: function () {
      clearInterval(intervalo);
      popup.remove();
    },
  };
}

function _esperar(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function _fetchBackground(url, method, body) {
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

function _erroResposta(res, fallback) {
  return (
    res?.data?.erro ||
    res?.data?.error ||
    res?.error ||
    fallback ||
    "Erro no servidor"
  );
}

async function _iniciarAnaliseIA(payload, authToken) {
  var res = await _fetchBackground(
    "http://localhost:3000/analisar/start",
    "POST",
    Object.assign({}, payload, { authToken: authToken }),
  );

  if (res && res.ok && res.data && res.data.jobId) {
    return res.data;
  }

  throw new Error(_erroResposta(res, "Nao foi possivel iniciar a analise."));
}

async function _obterSessaoAnalise() {
  var dados = await storageGet(["logado", "authToken", "email", "nome"]);
  return {
    logado: dados.logado === true && Boolean(dados.authToken),
    authToken: dados.authToken || "",
    email: dados.email || "",
    nome: dados.nome || "",
  };
}

async function _aguardarAnaliseIA(jobId, progresso) {
  var inicio = Date.now();
  var limiteMs = 20 * 60 * 1000;
  var falhasSeguidas = 0;

  while (Date.now() - inicio < limiteMs) {
    await _esperar(5000);

    var res = await _fetchBackground(
      "http://localhost:3000/analisar/status/" + encodeURIComponent(jobId),
      "GET",
    );
    var data = res?.data || {};
    if (data.progress && progresso?.syncPipeline) {
      progresso.syncPipeline(data.progress);
    }

    if (data.status === "done") {
      return data.resultado || data.result || data.data;
    }

    if (data.status === "error") {
      throw new Error(data.erro || data.error || "Erro ao concluir a analise.");
    }

    if (!res || !res.ok) {
      falhasSeguidas += 1;
      if (falhasSeguidas >= 3) {
        throw new Error(_erroResposta(res, "Servidor indisponivel."));
      }
      continue;
    }

    falhasSeguidas = 0;
  }

  throw new Error("A analise ultrapassou o tempo limite de 20 minutos.");
}

function CreateButton() {
  if (document.getElementById(BTN_ID)) return;

  var wrapper = document.createElement("div");
  wrapper.id = "btn_wrapper";

  var button = document.createElement("button");
  button.id = BTN_ID;
  button.type = "button";
  button.textContent = "Analisar";
  button.setAttribute("aria-label", "Abrir painel de Análise");

  var buttonChat = document.createElement("button");
  buttonChat.id = BTN_CHAT_ID;
  buttonChat.type = "button";
  buttonChat.innerHTML = _chatIconSvg();
  buttonChat.setAttribute("aria-label", "Abrir chat de noticias");

  button.addEventListener("click", async function () {
    if (document.getElementById(SIDEBAR_ID)) {
      fecharSidebar();
      return;
    }

    var sessao = await _obterSessaoAnalise();
    if (!sessao.logado) {
      buttonChat.style.display = "none";
      button.textContent = "Fechar";
      criarSidebar(null, true);
      return;
    }

    button.textContent = "Analisando...";
    button.disabled = true;
    buttonChat.style.display = "none";

    var progresso = _criarPopupProgresso();
    var payload = {};
    var resultado = null;

    try {
      payload = await PageExtractor.extract();
      progresso.setStage(1);

      var job = await _iniciarAnaliseIA(payload, sessao.authToken);
      if (job.progress) progresso.syncPipeline(job.progress);
      resultado = await _aguardarAnaliseIA(job.jobId, progresso);
      progresso.finish();

      await _esperar(650);
      progresso.remove();
      criarSidebar({ _payload: payload, _resultado: resultado }, false);
      button.textContent = "Fechar";

      // Destaque das claims direto na pagina (estilo Grammarly anti-fake)
      try {
        var buildFinal =
          resultado &&
          (resultado.etapa11_buildFinal ||
            resultado.etapa10_buildFinal ||
            resultado.buildFinal ||
            (resultado.etapa === "buildFinal" ? resultado : null));
        if (
          buildFinal &&
          window.VerusClaimHighlight &&
          typeof window.VerusClaimHighlight.aplicar === "function"
        ) {
          window.VerusClaimHighlight.aplicar(buildFinal);
        }
        // Marca tambem os links da pagina que apontam para noticias que o
        // VerusAI ja analisou (veredito + score no tooltip).
        if (
          window.VerusClaimHighlight &&
          typeof window.VerusClaimHighlight.marcarFontes === "function"
        ) {
          window.VerusClaimHighlight.marcarFontes();
        }
      } catch (err) {
        console.warn("[VerusAI] destaque de claims falhou:", err);
      }
    } catch (e) {
      progresso.fail(e.message);
      await _esperar(2600);
      progresso.remove();
      button.textContent = "Analisar";
      buttonChat.style.display = "";
    }

    button.disabled = false;
  });

  buttonChat.addEventListener("click", async function () {
    var logado = await storageGet("logado").then(function (r) {
      return r.logado === true;
    });
    if (document.getElementById(SIDEBAR_ID)) fecharSidebar();
    buttonChat.style.display = "none";
    button.textContent = "Fechar";
    criarSidebar(null, !logado);
  });

  wrapper.appendChild(buttonChat);
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);
}
