import { Icons } from "./icon.js";
["Password"].forEach((id) => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      botao.click();
    }
  });
});

document.getElementById("closeIcon").innerHTML = Icons("close");
document.getElementById("googleIcon").innerHTML = Icons("google");

document.getElementById("closeIcon").addEventListener("click", () => {
  window.close();
});

chrome.storage.local.get("logado", (resultado) => {
  if (resultado.logado) {
    window.location.href = "./config.html"; // já está logado, pula o login
  }
});

const botao = document.getElementById("confirm");

function emailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

botao.addEventListener("click", async () => {
  const emailInput = document.getElementById("E-mail");
  const senhaInput = document.getElementById("Password");

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  limparErros();

  let temErro = false;

  if (!email) {
    mostrarErro(
      emailInput,
      "erroEmail",
      `${Icons("warning")} Preencha o e-mail.`,
    );
    temErro = true;
  } else if (!emailValido(email)) {
    mostrarErro(
      emailInput,
      "erroEmail",
      `${Icons("warning")} Digite um e-mail válido. Ex: nome@email.com`,
    );
    temErro = true;
  }

  if (!senha) {
    mostrarErro(
      senhaInput,
      "erroSenha",
      `${Icons("warning")} Preencha a senha.`,
    );
    temErro = true;
  }

  if (temErro) return;

  try {
    const resposta = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      chrome.storage.local.set({ logado: true, email: dados.email }, () => {
        window.location.href = "./config.html";
      });
    } else {
      if (dados.campo === "senha") {
        mostrarErro(
          senhaInput,
          "erroSenha",
          `${Icons("warning")} ${dados.erro}`,
        );
      } else {
        mostrarErro(
          emailInput,
          "erroEmail",
          `${Icons("warning")} ${dados.erro}`,
        );
      }
    }
  } catch (err) {
    mostrarErro(
      emailInput,
      "erroEmail",
      `${Icons("warning")} Erro ao conectar com o servidor.`,
    );
  }
});

function mostrarErro(input, idSpan, mensagem) {
  input.classList.add("input-erro");
  document.getElementById(idSpan).innerHTML = mensagem;
}

function limparErros() {
  document.querySelectorAll(".erro").forEach((el) => (el.innerHTML = ""));
  document
    .querySelectorAll(".input-erro")
    .forEach((el) => el.classList.remove("input-erro"));
}
document.getElementById("Google").addEventListener("click", () => {
  chrome.identity.getAuthToken({ interactive: true }, async (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error("Erro ao autenticar com Google:", chrome.runtime.lastError);
      return;
    }

    const respostaGoogle = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const usuarioGoogle = await respostaGoogle.json();

    // ✅ fetch do login-google DENTRO do callback
    await fetch("http://localhost:3000/login-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: usuarioGoogle.email,
        nome: usuarioGoogle.name,
      }),
    });

    // ✅ Salva e redireciona DENTRO do callback
    chrome.storage.local.set(
      { logado: true, email: usuarioGoogle.email, nome: usuarioGoogle.name },
      () => {
        window.location.href = "./config.html";
      },
    );
  }); // ← fecha o getAuthToken
}); // ← fecha o addEventListener
