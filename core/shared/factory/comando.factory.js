const ComandoAudio = require("../../model/comandos/comando-audio.model.js");
const ComandoChatTTS = require("../../model/comandos/comando-chat-tts.model");
const ComandoCardSH = require("../../model/comandos/comando-card-sh.model");
const ComandoTextoSimples = require("../../model/comandos/comando-texto-simples.model");
const ComandoTexto = require("../../model/comandos/comando-texto.model");
const ComandoTTS = require("../../model/comandos/comando-tts.model");
const RespostaTexto = require("../../model/comandos/resposta-texto.model.js");

class ComandoFactory {
  criar(definicao) {
    if (!definicao || !definicao.tipo) {
      throw new Error("Definicao de comando invalida: campo 'tipo' e obrigatorio.");
    }

    switch (definicao.tipo) {
      case "audio":
        this.validarCampos(definicao, ["comando", "audio"]);
        return new ComandoAudio(definicao.comando, definicao.audio, definicao);
      case "texto-simples":
        this.validarCampos(definicao, ["comando", "resposta"]);
        return new ComandoTextoSimples(
          definicao.comando,
          new RespostaTexto(definicao.resposta || ""),
          null,
          definicao
        );
      case "texto-regex":
        this.validarCampos(definicao, ["matcher", "resposta"]);
        return new ComandoTexto(
          definicao.matcher,
          new RespostaTexto(definicao.resposta || ""),
          definicao
        );
      case "tts":
        this.validarCampos(definicao, ["comando", "resposta"]);
        return new ComandoTTS(
          definicao.comando,
          new RespostaTexto(definicao.resposta || ""),
          Object.assign(
            {
              provider: "puter",
              voice: "Vitoria",
              language: "pt-BR",
              model: null,
              instructions: null,
            },
            definicao.options || {},
            {
              voice: definicao.voice ?? definicao.voz ?? (definicao.options && definicao.options.voice) ?? "Vitoria",
              provider: definicao.provider ?? (definicao.options && definicao.options.provider) ?? "puter",
              language: definicao.language ?? (definicao.options && definicao.options.language) ?? "pt-BR",
              model: definicao.model ?? (definicao.options && definicao.options.model) ?? null,
              instructions: definicao.instructions ?? (definicao.options && definicao.options.instructions) ?? null,
            }
          ),
          definicao
        );
      case "chat-tts":
        return new ComandoChatTTS(
          Object.assign(
            {
              provider: "puter",
              voice: "Vitoria",
              language: "pt-BR",
              model: null,
              instructions: null,
            },
            definicao.options || {},
            {
              voice: definicao.voice ?? definicao.voz ?? (definicao.options && definicao.options.voice) ?? "Vitoria",
              provider: definicao.provider ?? (definicao.options && definicao.options.provider) ?? "puter",
              language: definicao.language ?? (definicao.options && definicao.options.language) ?? "pt-BR",
              model: definicao.model ?? (definicao.options && definicao.options.model) ?? null,
              instructions: definicao.instructions ?? (definicao.options && definicao.options.instructions) ?? null,
            }
          ),
          definicao
        );
      case "card-sh":
        this.validarCampos(definicao, ["comando"]);
        return new ComandoCardSH(definicao.comando, definicao);
      default:
        throw new Error("Tipo de comando nao suportado: " + definicao.tipo);
    }
  }

  validarCampos(definicao, campos) {
    campos.forEach((campo) => {
      if (!definicao[campo]) {
        throw new Error(
          "Definicao de comando invalida: campo '" + campo + "' e obrigatorio para o tipo '" + definicao.tipo + "'."
        );
      }
    });
  }
}

module.exports = ComandoFactory;
