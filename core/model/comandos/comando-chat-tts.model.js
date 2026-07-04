const FormatterUtils = require("../../shared/utils/formatter.utils");
const RespostaTexto = require("./resposta-texto.model");

class ComandoChatTTS {
  constructor(options) {
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
    this.comando = "chat tts";
    this.resposta = undefined;
    this.defaultTTS = new RegExp("!tts-(\\w+)\\s(.*)");
    this.simpleTTS = new RegExp("!tts\\s(.*)");
    this.formatter = new FormatterUtils();
  }

  /*
   !tts-ricardo alguma coisa
   !tts-vitoria alguma coisa
   !tts-camila alguma coisa
  */
  match(mensagem) {
    const lower = "" + mensagem.toLowerCase();
    let groups = this.defaultTTS.exec(lower);
    if (groups) {
      this.options.voice = this.formatter.camelSentence(groups[1]);
      this.resposta = new RespostaTexto(groups[2]);
      return true;
    }

    groups = this.simpleTTS.exec(lower);
    if (groups) {
      this.options.voice = this.options.voice || "Vitoria";
      this.resposta = new RespostaTexto(groups[1]);
      return true;
    }

    return false;
  }
}

module.exports = ComandoChatTTS;
