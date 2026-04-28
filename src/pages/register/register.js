import { Icons } from "../../shared/icons.js";

document.getElementById("userName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("E-mailRegister").focus();
});
document.getElementById("E-mailRegister").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("PasswordRegister").focus();
});
document.getElementById("PasswordRegister").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("PasswordConfirmRegister").focus();
});
document.getElementById("PasswordConfirmRegister").addEventListener("keydown", (e) => {
  if (e.key === "Enter") botao.click();
});

document.getElementById("checkIcon").innerHTML = Icons("check");

const botao = document.getElementById("confirmRegister");

const senhaInputForca = document.getElementById("PasswordRegister");
senhaInputForca.addEventListener("input", () => {
  const senha = senhaInputForca.value;
  const barras = document.querySelectorAll("#senha-forca .senha-forca-barra");
  const texto = document.getElementById("senha-forca-texto");

  barras.forEach((b) => b.classList.remove("ativa-fraca", "ativa-media", "ativa-forte"));

  if (!senha) { texto.textContent = ""; return; }

  let forca = 0;
  if (senha.length >= 6) forca++;
  if (senha.length >= 10) forca++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) forca++;
  if (/\d/.test(senha)) forca++;
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(senha)) forca++;

  if (forca <= 2) {
    barras[0].classList.add("ativa-fraca");
    texto.textContent = "Fraca";
    texto.style.color = "#dc3545";
  } else if (forca <= 3) {
    barras[0].classList.add("ativa-media");
    barras[1].classList.add("ativa-media");
    texto.textContent = "Média";
    texto.style.color = "#ffc107";
  } else {
    barras[0].classList.add("ativa-forte");
    barras[1].classList.add("ativa-forte");
    barras[2].classList.add("ativa-forte");
    texto.textContent = "Forte";
    texto.style.color = "#28a745";
  }
});

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
    mostrarErro(emailInput, "erroEmail", "Preencha o e-mail.");
    temErro = true;
  } else if (!emailValido(email)) {
    mostrarErro(emailInput, "erroEmail", "Digite um e-mail válido.");
    temErro = true;
  }

  if (!senha) {
    mostrarErro(senhaInput, "erroSenha", "Preencha a senha.");
    temErro = true;
  } else if (senha.length < 6) {
    mostrarErro(senhaInput, "erroSenha", "A senha deve ter 6 caracteres e pelo menos um especial");
    temErro = true;
  } else if (!temEspecial) {
    mostrarErro(senhaInput, "erroSenha", "A senha deve conter pelo menos um caractere especial.");
    temErro = true;
  }

  if (!senhaConfirm) {
    mostrarErro(senhaConfirmInput, "erroSenhaConfirm", "Confirme sua senha.");
    temErro = true;
  } else if (senha !== senhaConfirm) {
    mostrarErro(senhaConfirmInput, "erroSenhaConfirm", "As senhas não coincidem.");
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
      mostrarErro(emailInput, "erroEmail", dados.erro);
    }
  } catch (err) {
    mostrarErro(emailInput, "erroEmail", "Erro ao conectar com o servidor.");
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
  document.getElementById(idSpan).textContent = mensagem;
}

function limparErros() {
  document.querySelectorAll(".erro").forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll(".input-erro")
    .forEach((el) => el.classList.remove("input-erro"));
}
