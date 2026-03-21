const botao = document.getElementById("confirmRegister");

function emailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

botao.addEventListener("click", async () => {
  const emailInput = document.getElementById("E-mailRegister");
  const senhaInput = document.getElementById("PasswordRegister");
  const senhaConfirmInput = document.getElementById("PasswordConfirmRegister");

  const email = emailInput.value.trim();
  const senha = senhaInput.value;
  const senhaConfirm = senhaConfirmInput.value;

  // Limpa erros anteriores
  limparErros();

  let temErro = false;
  const temEspecial = /[!@#$%&*()_+\-=?/]/.test(senha);

  if (!email) {
    mostrarErro(emailInput, "erroEmail", "Preencha o e-mail.");
    temErro = true;
  } else if (!emailValido(email)) {
    mostrarErro(
      emailInput,
      "erroEmail",
      "Digite um e-mail válido. Ex: nome@email.com",
    );
    temErro = true;
  }

  if (!senha) {
    mostrarErro(senhaInput, "erroSenha", "Preencha a senha.");
    temErro = true;
  } else if (senha.length < 6) {
    mostrarErro(
      senhaInput,
      "erroSenha",
      "A senha deve ter 6 caracteres e pelo menos um especial",
    );
    temErro = true;
  } else if (!temEspecial) {
    mostrarErro(
      senhaInput,
      "erroSenha",
      "A senha deve conter pelo menos um caractere especial.",
    );
    temErro = true;
  }

  if (!senhaConfirm) {
    mostrarErro(senhaConfirmInput, "erroSenhaConfirm", "Confirme sua senha.");
    temErro = true;
  } else if (senha !== senhaConfirm) {
    mostrarErro(
      senhaConfirmInput,
      "erroSenhaConfirm",
      "As senhas não coincidem.",
    );
    temErro = true;
  }

  if (temErro) return;

  try {
    const resposta = await fetch("http://localhost:3000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      window.location.href = "./popup.html";
    } else {
      mostrarErro(emailInput, "erroEmail", dados.erro);
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
  document.querySelectorAll(".erro").forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll(".input-erro")
    .forEach((el) => el.classList.remove("input-erro"));
}
