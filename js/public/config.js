document.getElementById("logoutBtn").addEventListener("click", () => {
  chrome.storage.local.remove(["logado", "email"], () => {
    window.location.href = "./popup.html";
  });
});
