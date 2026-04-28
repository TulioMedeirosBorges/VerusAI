// features/reader.js
// Leitor de texto por seleção — com guard para evitar múltiplos listeners

function lerTextoSelecionado() {
  const texto = window.getSelection().toString().trim();
  if (texto) _falar(texto);
}

function _falar(texto) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  speechSynthesis.speak(utterance);
}

function ativarLeitor() {
  if (VerusState.readerActive) return;
  document.addEventListener("mouseup", lerTextoSelecionado);
  VerusState.readerActive = true;
}

function desativarLeitor() {
  document.removeEventListener("mouseup", lerTextoSelecionado);
  speechSynthesis.cancel();
  VerusState.readerActive = false;
}
