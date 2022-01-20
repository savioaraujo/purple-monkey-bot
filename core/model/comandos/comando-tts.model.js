class ComandoTTS {
  constructor(comando, resposta, voz) {
    this.comando = comando;
    this.resposta = resposta;
    this.voz = voz;
  }

  match(mensagem) {
    return mensagem.toLowerCase().startsWith(this.comando);
  }
}

module.exports = ComandoTTS;
