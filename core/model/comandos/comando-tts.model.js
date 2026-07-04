class ComandoTTS {
  constructor(comando, resposta, options) {
    this.comando = comando;
    this.resposta = resposta;
    this.options = Object.assign(
      {
        provider: "xai",
        voice: "eve",
        language: "pt-br",
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
