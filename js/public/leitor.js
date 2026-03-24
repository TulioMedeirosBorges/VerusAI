let leituraAtiva = false;
let utterance = null;

export function ativarLeitor() {
  leituraAtiva = true;
  document.addEventListener("mouseup", lerTextoSelecionado);
  document.addEventListener("mouseover", lerElementoHover);
}

export function desativarLeitor() {
  leituraAtiva = false;
  speechSynthesis.cancel();
  document.removeEventListener("mouseup", lerTextoSelecionado);
  document.removeEventListener("mouseover", lerElementoHover);
}

// Lê o texto selecionado com o mouse
function lerTextoSelecionado() {
  const textoSelecionado = window.getSelection().toString().trim();
  if (textoSelecionado) {
    falar(textoSelecionado);
  }
}

// Lê o texto quando passa o mouse por cima
function lerElementoHover(e) {
  const texto = e.target.innerText?.trim();
  if (texto && texto.length > 0) {
    falar(texto);
  }
}

function falar(texto) {
  speechSynthesis.cancel(); // para qualquer leitura anterior

  utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "pt-BR";
  utterance.rate = 1; // velocidade (0.5 a 2)
  utterance.pitch = 1; // tom (0 a 2)
  utterance.volume = 1; // volume (0 a 1)

  speechSynthesis.speak(utterance);
}
