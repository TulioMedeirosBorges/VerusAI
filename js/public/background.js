chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== "FETCH") return;

  fetch(request.url, {
    method: request.method || "GET",
    headers: request.headers || {},
    body: request.body ? JSON.stringify(request.body) : undefined,
  })
    .then(async (res) => {
      const data = await res.json();
      sendResponse({ ok: res.ok, status: res.status, data });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: err.message });
    });

  return true; // mantém o canal aberto para resposta assíncrona
});
