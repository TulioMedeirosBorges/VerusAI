import { Icons } from "./icon.js";

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
    window.location.href = "./popup.html";
  });
});

let value = 50;
const min = 12,
  max = 24;
let emailUsuario = "";

chrome.storage.local.get("email", (resultado) => {
  emailUsuario = resultado.email;
  const nomeUsuario = resultado.email.split("@")[0];
  document.getElementById("nomeUsuario").textContent = nomeUsuario;
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

    if (btn.dataset.id === "contraste") {
      ativarAltoContraste(ativo);
    }

    if (btn.dataset.id === "tema") {
      ativarTemaEscuro(ativo);
    }

    salvarConfigs();
  });
});

function ativarAltoContraste(ativo) {
  if (ativo) {
    document.documentElement.classList.add("alto-contraste");
  } else {
    document.documentElement.classList.remove("alto-contraste");
  }
}

function ativarTemaEscuro(ativo) {
  if (ativo) {
    document.documentElement.classList.add("tema");
  } else {
    document.documentElement.classList.remove("tema");
  }
}

async function salvarConfigs() {
  const toggles = {};
  document.querySelectorAll(".retangle").forEach((btn) => {
    toggles[btn.dataset.id] = btn.classList.contains("ativo");
  });

  const configs = { fontSize: value, toggles };

  // ✅ Salva no chrome.storage para o content.js ter acesso
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

    const { fontSize, toggles } = dados.configs;

    if (fontSize !== undefined) {
      value = fontSize;
      updateBar();
    }

    if (toggles) {
      document.querySelectorAll(".retangle").forEach((btn) => {
        if (toggles[btn.dataset.id]) {
          btn.classList.add("ativo");

          if (btn.dataset.id === "contraste") {
            ativarAltoContraste(true);
          }

          if (btn.dataset.id === "tema") {
            ativarTemaEscuro(true);
          }
        }
      });
    }
  } catch (err) {
    console.error("Erro ao carregar configs:", err);
    updateBar();
  }
}
