chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH") {
    console.log("[VerusAI background] FETCH:", request.url);
    fetch(request.url, {
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body ? JSON.stringify(request.body) : undefined,
    })
      .then(async (res) => {
        console.log("[VerusAI background] resposta:", res.status, res.headers.get("content-type"));
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          sendResponse({ ok: res.ok, status: res.status, data });
        } else {
          const data = await res.text();
          sendResponse({ ok: res.ok, status: res.status, data });
        }
      })
      .catch((err) => {
        console.log("[VerusAI background] erro:", err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (request.type === "CONFIGS_UPDATED") {
    chrome.runtime.sendMessage({ type: "CONFIGS_UPDATED", configs: request.configs });
  }
});
