// content.js — entry point da extensão
// Responsabilidade: guard de inicialização, init, observer com debounce, listener global de configs

(() => {
  const GUARD = "verus_guard";
  if (window[GUARD]) return;
  window[GUARD] = true;

  function init() {
    CreateButton();
  }

  init();

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
      if (!changes.configs?.newValue) return;
      aplicarConfigsGlobal(changes.configs.newValue);
    });
  }
})();
