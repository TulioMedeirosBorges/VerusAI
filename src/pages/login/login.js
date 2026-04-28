import { Icons } from "../../shared/icons.js";

document.getElementById("E-mail").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("Password").focus();
});
document.getElementById("Password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") botao.click();
});

document.getElementById("closeIcon").innerHTML = Icons("close");
document.getElementById("googleIcon").innerHTML = Icons("google");

document
  .getElementById("closeIcon")
  .addEventListener("click", () => window.close());

document.getElementById("logo").src = chrome.runtime.getURL(
  "/assets/images/VerusIAAtivo 1.svg",
);

chrome.storage.local.get("logado", (resultado) => {
  if (resultado.logado) window.location.href = "../settings/settings.html";
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
    mostrarErro(emailInput, "erroEmail", "Preencha o e-mail.");
    temErro = true;
  } else if (!emailValido(email)) {
    mostrarErro(emailInput, "erroEmail", "Digite um e-mail válido.");
    temErro = true;
  }

  if (!senha) {
    mostrarErro(senhaInput, "erroSenha", "Preencha a senha.");
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
      chrome.storage.local.set(
        { logado: true, email: dados.email, nome: dados.nome },
        () => {
          window.location.href = "../settings/settings.html";
        },
      );
    } else {
      if (dados.campo === "senha") {
        mostrarErro(senhaInput, "erroSenha", dados.erro);
      } else {
        mostrarErro(emailInput, "erroEmail", dados.erro);
      }
    }
  } catch (err) {
    mostrarErro(emailInput, "erroEmail", "Erro ao conectar com o servidor.");
  }
});

function mostrarErro(input, idSpan, mensagem) {
  input.classList.add("input-erro");
  document.getElementById(idSpan).textContent = mensagem;
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
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const usuarioGoogle = await respostaGoogle.json();

    await fetch("http://localhost:3000/login-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: usuarioGoogle.email,
        nome: usuarioGoogle.name,
      }),
    });

    chrome.storage.local.set(
      { logado: true, email: usuarioGoogle.email, nome: usuarioGoogle.name },
      () => {
        window.location.href = "../settings/settings.html";
      },
    );
  });
});

const linkEsqueciSenha = document.getElementById("linkEsqueciSenha");
linkEsqueciSenha.addEventListener("click", (e) => {
  e.preventDefault();
  mostrarTelaRecuperacao();
});

function mostrarTelaRecuperacao() {
  const main = document.querySelector(".main");
  main.innerHTML = `
    <div class="recuperacao">
      <h2>Recuperar senha</h2>
      <p class="subtitulo">Digite seu e-mail para receber o código</p>
      <div class="input">
        <div class="E-mail">
          <label>E-mail</label><br/>
          <input type="email" id="emailRecuperacao" placeholder="Digite seu e-mail" />
          <span class="erro" id="erroEmailRecuperacao"></span>
        </div>
      </div>
      <div class="button">
        <div class="buttonConfirm">
          <button id="btnEnviarCodigo"><p>Enviar código</p></button>
        </div>
      </div>
      <div class="logup" style="padding-top: 8px">
        <p><a id="voltarLogin" href="#">← Voltar ao login</a></p>
      </div>
    </div>
  `;

  document.getElementById("voltarLogin").addEventListener("click", (e) => {
    e.preventDefault();
    location.reload();
  });

  document.getElementById("emailRecuperacao").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnEnviarCodigo").click();
  });

  document
    .getElementById("btnEnviarCodigo")
    .addEventListener("click", async () => {
      const email = document.getElementById("emailRecuperacao").value.trim();
      const erroSpan = document.getElementById("erroEmailRecuperacao");
      erroSpan.innerHTML = "";

      if (!email) {
        erroSpan.textContent = "Preencha o e-mail.";
        return;
      }

      const btn = document.getElementById("btnEnviarCodigo");
      btn.disabled = true;
      btn.querySelector("p").textContent = "Enviando...";

      try {
        const resposta = await fetch("http://localhost:3000/recuperar-senha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const dados = await resposta.json();

        if (resposta.ok) {
          mostrarTelaCodigoESenha(email);
        } else {
          erroSpan.textContent = dados.erro;
          btn.disabled = false;
          btn.querySelector("p").textContent = "Enviar código";
        }
      } catch (err) {
        erroSpan.textContent = "Erro ao conectar com o servidor.";
        btn.disabled = false;
        btn.querySelector("p").textContent = "Enviar código";
      }
    });
}

function mostrarTelaCodigoESenha(email) {
  const main = document.querySelector(".main");
  main.innerHTML = `
    <div class="recuperacao" style="gap:4px">
      <h2>Redefinir senha</h2>
      <p class="subtitulo">Código enviado para <strong>${email}</strong></p>
      <div class="input" style="gap:4px">
        <div class="E-mail">
          <label>Código</label>
          <input type="text" id="codigoRecuperacao" placeholder="000000" maxlength="6" style="letter-spacing:2px;text-align:center;font-size:14px;padding:6px 10px" />
          <span class="erro" id="erroCodigo"></span>
        </div>
        <div class="Senha">
          <label>Nova senha</label>
          <input type="password" id="novaSenha" placeholder="Digite sua nova senha" style="padding:6px 10px" />
          <div class="senha-forca" id="senha_forca" style="margin-top:3px">
            <div class="senha-forca-barra"></div>
            <div class="senha-forca-barra"></div>
            <div class="senha-forca-barra"></div>
          </div>
          <p class="senha-forca-texto" id="senha_forca_texto"></p>
          <span class="erro" id="erroNovaSenha"></span>
        </div>
        <div class="Senha">
          <label>Confirme a nova senha</label>
          <input type="password" id="confirmarNovaSenha" placeholder="Confirme sua nova senha" style="padding:6px 10px" />
          <span class="erro" id="erroConfirmarSenha"></span>
        </div>
      </div>
      <div class="button" style="margin-top:2px">
        <div class="buttonConfirm">
          <button id="btnRedefinirSenha"><p>Redefinir senha</p></button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <a id="voltarLogin2" href="#" style="font-size:11px;color:#888;text-decoration:none">← Voltar</a>
        <a id="reenviarCodigo" href="#" style="font-size:11px;color:#f1ae2b;text-decoration:none">Reenviar código</a>
      </div>
    </div>
  `;

  document.getElementById("codigoRecuperacao").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("novaSenha").focus();
  });
  document.getElementById("novaSenha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("confirmarNovaSenha").focus();
  });
  document.getElementById("confirmarNovaSenha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnRedefinirSenha").click();
  });

  document.getElementById("novaSenha").addEventListener("input", () => {
    const senha = document.getElementById("novaSenha").value;
    const barras = document.querySelectorAll("#senha_forca .senha-forca-barra");
    const textoForca = document.getElementById("senha_forca_texto");

    barras.forEach((b) =>
      b.classList.remove("ativa-fraca", "ativa-media", "ativa-forte"),
    );

    if (senha.length === 0) {
      textoForca.textContent = "";
      return;
    }

    let forca = 0;
    if (senha.length >= 6) forca++;
    if (senha.length >= 10) forca++;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) forca++;
    if (/\d/.test(senha)) forca++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(senha)) forca++;

    if (forca <= 2) {
      barras[0].classList.add("ativa-fraca");
      textoForca.textContent = "Fraca";
      textoForca.style.color = "#dc3545";
    } else if (forca <= 3) {
      barras[0].classList.add("ativa-media");
      barras[1].classList.add("ativa-media");
      textoForca.textContent = "Média";
      textoForca.style.color = "#ffc107";
    } else {
      barras[0].classList.add("ativa-forte");
      barras[1].classList.add("ativa-forte");
      barras[2].classList.add("ativa-forte");
      textoForca.textContent = "Forte";
      textoForca.style.color = "#28a745";
    }
  });

  document.getElementById("voltarLogin2").addEventListener("click", (e) => {
    e.preventDefault();
    location.reload();
  });

  document
    .getElementById("reenviarCodigo")
    .addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetch("http://localhost:3000/recuperar-senha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        alert("Código reenviado!");
      } catch (err) {
        alert("Erro ao reenviar código.");
      }
    });

  document
    .getElementById("btnRedefinirSenha")
    .addEventListener("click", async () => {
      const codigo = document.getElementById("codigoRecuperacao").value.trim();
      const novaSenha = document.getElementById("novaSenha").value;
      const confirmarSenha =
        document.getElementById("confirmarNovaSenha").value;

      document.getElementById("erroCodigo").innerHTML = "";
      document.getElementById("erroNovaSenha").innerHTML = "";
      document.getElementById("erroConfirmarSenha").innerHTML = "";

      let temErro = false;

      if (!codigo || codigo.length !== 6) {
        document.getElementById("erroCodigo").textContent = "Digite o código de 6 dígitos.";
        temErro = true;
      }

      if (!novaSenha) {
        document.getElementById("erroNovaSenha").textContent = "Preencha a senha.";
        temErro = true;
      } else if (novaSenha.length < 6) {
        document.getElementById("erroNovaSenha").textContent = "A senha deve ter no mínimo 6 caracteres.";
        temErro = true;
      } else if (!/[A-Z]/.test(novaSenha)) {
        document.getElementById("erroNovaSenha").textContent = "A senha deve conter pelo menos uma letra maiúscula.";
        temErro = true;
      } else if (!/[a-z]/.test(novaSenha)) {
        document.getElementById("erroNovaSenha").textContent = "A senha deve conter pelo menos uma letra minúscula.";
        temErro = true;
      } else if (!/\d/.test(novaSenha)) {
        document.getElementById("erroNovaSenha").textContent = "A senha deve conter pelo menos um número.";
        temErro = true;
      } else if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(novaSenha)) {
        document.getElementById("erroNovaSenha").textContent = "A senha deve conter pelo menos um caractere especial.";
        temErro = true;
      }

      if (!confirmarSenha) {
        document.getElementById("erroConfirmarSenha").textContent = "Confirme sua senha.";
        temErro = true;
      } else if (novaSenha !== confirmarSenha) {
        document.getElementById("erroConfirmarSenha").textContent = "As senhas não coincidem.";
        temErro = true;
      }

      if (temErro) return;

      const btn = document.getElementById("btnRedefinirSenha");
      btn.disabled = true;
      btn.querySelector("p").textContent = "Redefinindo...";

      try {
        const resposta = await fetch("http://localhost:3000/redefinir-senha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: codigo, novaSenha }),
        });

        const dados = await resposta.json();

        if (resposta.ok) {
          mostrarSucessoRedefinicao();
        } else {
          document.getElementById("erroCodigo").textContent = dados.erro;
          btn.disabled = false;
          btn.querySelector("p").textContent = "Redefinir senha";
        }
      } catch (err) {
        document.getElementById("erroCodigo").textContent = "Erro ao conectar com o servidor.";
        btn.disabled = false;
        btn.querySelector("p").textContent = "Redefinir senha";
      }
    });
}

function mostrarSucessoRedefinicao() {
  const main = document.querySelector(".main");
  main.innerHTML = `
    <div class="recuperacao" style="text-align: center; padding: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
      <h2>Senha redefinida!</h2>
      <p class="subtitulo" style="margin: 8px 0 16px;">Sua senha foi alterada com sucesso.</p>
      <div class="button">
        <div class="buttonConfirm">
          <button id="btnVoltarLogin"><p>Fazer login</p></button>
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("btnVoltarLogin")
    .addEventListener("click", () => location.reload());
}
