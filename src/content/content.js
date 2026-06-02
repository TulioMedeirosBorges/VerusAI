// content.js — entry point da extensão
// Responsabilidade: guard de inicialização, init, observer com debounce, listener global de configs

(() => {
  const GUARD = "verus_guard";
  if (window[GUARD]) return;
  window[GUARD] = true;

  function init() {
    CreateButton();
    CriarSeloFonte();
  }

  init();

  const AUTH_BRIDGE_ORIGINS = new Set([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
  ]);

  function paginaPodeReceberAuthVerus() {
    return AUTH_BRIDGE_ORIGINS.has(window.location.origin);
  }

  function enviarEstadoLoginParaPagina() {
    if (!paginaPodeReceberAuthVerus()) return;
    storageGet(["logado", "email", "nome", "authToken"]).then((dados) => {
      window.postMessage(
        {
          source: "VerusAIExtension",
          type: "VERUS_AUTH_STATE",
          payload: {
            logado: dados.logado === true && Boolean(dados.authToken),
            email: dados.email || "",
            nome: dados.nome || "",
            authToken: dados.authToken || "",
          },
        },
        window.location.origin,
      );
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!paginaPodeReceberAuthVerus()) return;
    if (event.data?.source !== "VerusSite") return;
    if (event.data?.type !== "VERUS_AUTH_REQUEST") return;
    enviarEstadoLoginParaPagina();
  });

  // Observer com debounce — evita disparar centenas de vezes por segundo no Instagram
  let _observerTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(_observerTimer);
    _observerTimer = setTimeout(() => {
      if (!document.getElementById(BTN_ID)) init();
    }, 300);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Leitor persistente: ativa se estava ligado antes de abrir a sidebar
  storageGet("configs").then((r) => {
    if (r.configs?.toggles?.leitornoticias) ativarLeitor();
  });

  // Listener unificado de configs — única fonte de verdade para mudanças externas
  if (isContextValid()) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.configs?.newValue) aplicarConfigsGlobal(changes.configs.newValue);
      if (
        changes.logado ||
        changes.email ||
        changes.nome ||
        changes.authToken
      ) {
        enviarEstadoLoginParaPagina();
      }
    });
  }
})();
