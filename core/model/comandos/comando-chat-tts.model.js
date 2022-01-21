const FormatterUtils = require("../../shared/utils/formatter.utils");
const RespostaTexto = require("./resposta-texto.model");

class ComandoChatTTS {
  constructor() {
    this.voz = "Vitoria";
    this.comando = "chat tts"
    this.resposta = undefined;
    this.defaultTTS = new RegExp('!tts-(\\w+)\\s(.*)');
    this.formatter = new FormatterUtils();
  }

  /*
   !tts-ricardo alguma coisa
   !tts-vitoria alguma coisa
   !tts-camila alguma coisa
  */
  match(mensagem) {
    let matchs = mensagem.toLowerCase().match(this.defaultTTS);
    if (matchs) {
      let groups = this.defaultTTS.exec("" + mensagem.toLowerCase());
      this.voz = this.formatter.camelSentence(groups[1]);
      this.resposta = new RespostaTexto(groups[2]);
      // TODO: Validar se a voz é valida.
      return true;
    }
  }
}

module.exports = ComandoChatTTS;
