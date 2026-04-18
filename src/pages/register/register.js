import { Icons } from "../../shared/icons.js";

["PasswordConfirmRegister"].forEach((id) => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      botao.click();
    }
  });
});

document.getElementById("checkIcon").innerHTML = Icons("check");

const botao = document.getElementById("confirmRegister");

function emailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

botao.addEventListener("click", async () => {
  const emailInput = document.getElementById("E-mailRegister");
  const senhaInput = document.getElementById("PasswordRegister");
  const senhaConfirmInput = document.getElementById("PasswordConfirmRegister");
  const nomeInput = document.getElementById("userName");

  const email = emailInput.value.trim();
  const senha = senhaInput.value;
  const senhaConfirm = senhaConfirmInput.value;
  const nome = nomeInput.value.trim();

  limparErros();

  let temErro = false;
  const temEspecial = /[!@#$%&*()_+\-=?/]/.test(senha);

  if (!email) {
    mostrarErro(
      emailInput,
      "erroEmail",
      `${Icons("warning")}Preencha o e-mail.`,
    );
    temErro = true;
  } else if (!emailValido(email)) {
    mostrarErro(
      emailInput,
      "erroEmail",
      `${Icons("warning")}Digite um e-mail válido.`,
    );
    temErro = true;
  }

  if (!senha) {
    mostrarErro(
      senhaInput,
      "erroSenha",
      `${Icons("warning")}Preencha a senha.`,
    );
    temErro = true;
  } else if (senha.length < 6) {
    mostrarErro(
      senhaInput,
      "erroSenha",
      `${Icons("warning")}A senha deve ter 6 caracteres e pelo menos um especial`,
    );
    temErro = true;
  } else if (!temEspecial) {
    mostrarErro(
      senhaInput,
      "erroSenha",
      `${Icons("warning")}A senha deve conter pelo menos um caractere especial.`,
    );
    temErro = true;
  }

  if (!senhaConfirm) {
    mostrarErro(
      senhaConfirmInput,
      "erroSenhaConfirm",
      `${Icons("warning")}Confirme sua senha.`,
    );
    temErro = true;
  } else if (senha !== senhaConfirm) {
    mostrarErro(
      senhaConfirmInput,
      "erroSenhaConfirm",
      `${Icons("warning")}As senhas não coincidem.`,
    );
    temErro = true;
  }

  if (temErro) return;

  try {
    const resposta = await fetch("http://localhost:3000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha, nome }),
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      mostrarSucesso();
    } else {
      mostrarErro(emailInput, "erroEmail", `${Icons("warning")} ${dados.erro}`);
    }
  } catch (err) {
    mostrarErro(
      emailInput,
      "erroEmail",
      `${Icons("warning")} Erro ao conectar com o servidor.`,
    );
  }
});

function mostrarSucesso() {
  const tela = document.getElementById("telaSuccesso");
  tela.classList.add("ativo");

  const barra = document.createElement("div");
  barra.classList.add("barra-loading");
  tela.querySelector(".sucesso-conteudo").appendChild(barra);

  setTimeout(() => {
    barra.style.width = "100%";
  }, 100);

  setTimeout(() => {
    window.location.href = "../login/login.html";
  }, 2200);
}

function mostrarErro(input, idSpan, mensagem) {
  input.classList.add("input-erro");
  document.getElementById(idSpan).innerHTML = mensagem;
}

function limparErros() {
  document.querySelectorAll(".erro").forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll(".input-erro")
    .forEach((el) => el.classList.remove("input-erro"));
}
