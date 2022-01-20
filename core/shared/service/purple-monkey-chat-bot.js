var tmi = require("tmi.js");

const ComandoAudio = require("../../model/comandos/comando-audio.model.js");
const ComandoTTS = require("../../model/comandos/comando-tts.model");
const ComandoChatTTS = require("../../model/comandos/comando-chat-tts.model");
const ComandoTextoSimples = require("../../model/comandos/comando-texto-simples.model.js");
const TTSService = require("./tts.service.js");

class PurpleMonkeyChatBot {
  constructor(username, passoword, canais) {
    this.username = username;
    this.passoword = passoword;
    this.canais = canais;
    this.ttsService = new TTSService();
  }

  start(servidor) {
    this.listCanais = [];
    this.canais.forEach((canal) => {
      this.listCanais.push(canal.nome);
    });

    this.client = new tmi.Client({
      options: { debug: true },
      identity: {
        username: this.username,
        password: this.passoword,
      },
      channels: this.listCanais,
    });

    this.client.on("message", (channel, tags, message, self) => {
      if (self) return;
      this.canais.forEach((canal) => {
        // Se for o chat do canal
        if (canal.nome == channel) {
          // percorre os comandos disponiveis do canal
          canal.comandos.forEach((comando) => {
            console.log("testando comando : " + comando.comando);
            // verifica se o comando deu match
            if (comando.match(message)) {
              // conforme o tipo de comando executa uma ação dife
              console.log("Executando comando : " + comando.comando);
              if (comando instanceof ComandoTextoSimples) {
                this.client.say(channel, comando.resposta.mensagem);
              } else if (comando instanceof ComandoTTS) {
                this.ttsService.gerarAudio(
                  comando.resposta.mensagem,
                  comando.voz
                );
              } else if (comando instanceof ComandoChatTTS) {
                this.ttsService.gerarAudio(
                  comando.resposta.mensagem,
                  comando.voz
                );
              } else if (comando instanceof ComandoAudio) {
                if (servidor != null) {
                  servidor.notificarSockets("alert", comando.audio);
                }
              }
            }
          });
        }
      });
    });

    this.client.connect();
  }
}

module.exports = PurpleMonkeyChatBot;
