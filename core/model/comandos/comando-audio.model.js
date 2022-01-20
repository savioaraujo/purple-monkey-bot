class ComandoAudio {
  constructor(comando, audio) {
    this.comando = comando;
    this.audio = audio;
  }
  match(mensagem){
    return mensagem.toLowerCase().startsWith(this.comando);
  }
}

module.exports = ComandoAudio;
