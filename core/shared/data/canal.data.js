const Canal = require("../../model/canal.model");
const ComandoAudio = require("../../model/comandos/comando-audio.model.js");
const ComandoChatTTS = require("../../model/comandos/comando-chat-tts.model");
const ComandoTextoSimples = require("../../model/comandos/comando-texto-simples.model");
const ComandoTexto = require("../../model/comandos/comando-texto.model");
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
      new ComandoTexto(
        "^(bom dia|boa tarde|boa noite|boa madrugada|buenos dias|buenos tardes|buenos notches|buena madrugada|aloha)",
        new RespostaTexto("{{g1}} {{username}}, seja bem vindo(a).")
      ),
      new ComandoTexto(
        "!abraco\\s@(\\w+)",
        new RespostaTexto("{{username}} abraçou {{g1}} peepoLove")
      ),
    ];
    var canal = new Canal("balderking", comandos);
    var canais = [canal];
    return canais;
  }
}

module.exports = CanalDatabase;
