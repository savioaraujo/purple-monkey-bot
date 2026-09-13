const ComandoBase = require("./comando-base.model");

class ComandoAudio extends ComandoBase {
  constructor(comando, audio, config = {}) {
    super(config);
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
