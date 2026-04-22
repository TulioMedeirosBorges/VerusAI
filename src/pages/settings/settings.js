import { Icons } from "../../shared/icons.js";

document.getElementById("closeIcon").innerHTML = Icons("close");
document.getElementById("logoutbtn").innerHTML = Icons("logout");
document.getElementById("AaIcon").innerHTML = Icons("Aa");

const bar = document.getElementById("bar");
const less = document.getElementById("less");
const plus = document.getElementById("plus");

less.innerHTML = Icons("less");
plus.innerHTML = Icons("pluss");

document
  .getElementById("closeIcon")
  .addEventListener("click", () => window.close());

document.getElementById("logout").addEventListener("click", () => {
  chrome.storage.local.remove(["logado", "email"], () => {
    window.location.href = "../login/login.html";
  });
});

let value = 50;
const min = 12,
  max = 24;
let emailUsuario = "";

chrome.storage.local.get(["email", "nome"], (resultado) => {
  emailUsuario = resultado.email;
  document.getElementById("nomeUsuario").textContent =
    resultado.nome || resultado.email.split("@")[0];
  carregarConfigs();
});

function getFontSize() {
  return Math.round(min + (value / 100) * (max - min));
}

function updateBar() {
  bar.style.setProperty("--fill", value + "%");
  document.documentElement.style.setProperty(
    "--font-size",
    getFontSize() + "px",
  );
}

less.addEventListener("click", () => {
  value = Math.max(0, value - 10);
  updateBar();
  salvarConfigs();
});

plus.addEventListener("click", () => {
  value = Math.min(100, value + 10);
  updateBar();
  salvarConfigs();
});

document.querySelectorAll(".retangle").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("ativo");
    const ativo = btn.classList.contains("ativo");

    if (btn.dataset.id === "contraste") ativarAltoContraste(ativo);
    if (btn.dataset.id === "tema") ativarTemaEscuro(ativo);
    if (btn.dataset.id === "leitornoticias") {
      if (ativo) {
        ativarLeitorConfig();
      } else {
        speechSynthesis.cancel();
        document.removeEventListener("mouseup", lerTextoConfig);
      }
    }

    salvarConfigs();
  });
});

function ativarAltoContraste(ativo) {
  document.documentElement.classList.toggle("alto-contraste", ativo);
}

function ativarTemaEscuro(ativo) {
  document.documentElement.classList.toggle("tema", ativo);
}

function lerTextoConfig() {
  const texto = window.getSelection().toString().trim();
  if (texto) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
}

function ativarLeitorConfig() {
  document.addEventListener("mouseup", lerTextoConfig);
}

async function salvarConfigs() {
  const toggles = {};
  document.querySelectorAll(".retangle").forEach((btn) => {
    toggles[btn.dataset.id] = btn.classList.contains("ativo");
  });

  const configs = { fontSize: value, toggles };
  chrome.storage.local.set({ configs });

  try {
    await fetch("http://localhost:3000/salvar-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailUsuario, configs }),
    });
  } catch (err) {
    console.error("Erro ao salvar configs:", err);
  }
}

async function carregarConfigs() {
  try {
    const resposta = await fetch("http://localhost:3000/carregar-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailUsuario }),
    });

    const dados = await resposta.json();

    if (!dados.configs || Object.keys(dados.configs).length === 0) {
      updateBar();
      return;
    }

    aplicarConfigs(dados.configs);
  } catch (err) {
    console.error("Erro ao carregar configs:", err);
    updateBar();
  }
}

function aplicarConfigs({ fontSize, toggles }) {
  if (fontSize !== undefined) {
    value = fontSize;
    updateBar();
  }

  if (toggles) {
    document.querySelectorAll(".retangle").forEach((btn) => {
      const ativo = !!toggles[btn.dataset.id];
      btn.classList.toggle("ativo", ativo);
      if (btn.dataset.id === "contraste") ativarAltoContraste(ativo);
      if (btn.dataset.id === "tema") ativarTemaEscuro(ativo);
      if (btn.dataset.id === "leitornoticias") {
        document.removeEventListener("mouseup", lerTextoConfig);
        if (ativo) ativarLeitorConfig();
        else speechSynthesis.cancel();
      }
    });
  }
}

// Sincroniza quando o sidebar alterar as configs
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CONFIGS_UPDATED") {
    aplicarConfigs(message.configs);
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.configs?.newValue) {
    aplicarConfigs(changes.configs.newValue);
  }
});
