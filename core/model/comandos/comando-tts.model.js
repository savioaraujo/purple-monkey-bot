const ComandoBase = require("./comando-base.model");

class ComandoTTS extends ComandoBase {
  constructor(comando, resposta, options, config = {}) {
    super(config);
    this.comando = comando;
    this.resposta = resposta;
    this.options = Object.assign(
      {
        provider: "puter",
        voice: "Vitoria",
        language: "pt-BR",
        model: null,
        instructions: null,
      },
      options || {}
    );
  }

  match(mensagem) {
    const mensagemNormalizada = mensagem.toLowerCase();
    return (
      mensagemNormalizada === this.comando ||
      mensagemNormalizada.startsWith(this.comando + " ")
    );
  }
}

module.exports = ComandoTTS;
