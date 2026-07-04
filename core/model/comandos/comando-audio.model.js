class ComandoAudio {
  constructor(comando, audio) {
    this.comando = comando;
    this.audio = audio;
  }
  match(mensagem) {
    const mensagemNormalizada = mensagem.toLowerCase();
    return (
      mensagemNormalizada === this.comando ||
      mensagemNormalizada.startsWith(this.comando + " ")
    );
  }
}

module.exports = ComandoAudio;
