// services/storage.js
// Único ponto de acesso ao chrome.storage — trata contexto invalidado

function isContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function chromeStorage(method, ...args) {
  if (!isContextValid()) {
    console.warn("[VerusAI] Contexto invalidado, recarregue a página.");
    return method === "get" ? Promise.resolve({}) : Promise.resolve();
  }
  return new Promise((resolve) => chrome.storage.local[method](...args, resolve));
}

function storageGet(keys) {
  return chromeStorage("get", keys);
}

function storageSet(data) {
  return chromeStorage("set", data);
}

function storageRemove(keys) {
  return chromeStorage("remove", keys);
}
