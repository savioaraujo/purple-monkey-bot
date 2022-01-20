const Canal = require("../../model/canal.model");
const ComandoAudio = require("../../model/comandos/comando-audio.model.js");
const ComandoChatTTS = require("../../model/comandos/comando-chat-tts.model");
const ComandoTextoSimples = require("../../model/comandos/comando-texto-simples.model");
const ComandoTTS = require("../../model/comandos/comando-tts.model");
const RespostaTexto = require("../../model/comandos/resposta-texto.model.js");

class CanalDatabase {
  constructor() {}

  getCanais() {
    var comandos = [
      new ComandoAudio("!bemtevi", "bem-tevi.mp3"),
      new ComandoAudio("!nanezinha", "nanezinha.mp3"),
      new ComandoTextoSimples(
        "!info",
        new RespostaTexto(
          "Eu sou um bot, meu criador balderking me chamou aqui. Obrigado por me aceitar peepoLove."
        )
      ),
      new ComandoTTS(
        "!cuequinha-tts",
        new RespostaTexto("Eu tô de cuequinha branca. cê vai amar. peepoHappy"),
        "Vitoria"
      ),
      new ComandoChatTTS(),
    ];
    var canal = new Canal("balderking", comandos);
    var canais = [canal];
    return canais;
  }
}

module.exports = CanalDatabase;
