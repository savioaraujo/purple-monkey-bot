const tmi = require("tmi.js");

const ComandoAudio = require("../../model/comandos/comando-audio.model.js");
const ComandoTTS = require("../../model/comandos/comando-tts.model");
const ComandoChatTTS = require("../../model/comandos/comando-chat-tts.model");
const ComandoTextoSimples = require("../../model/comandos/comando-texto-simples.model.js");
const ComandoTexto = require("../../model/comandos/comando-texto.model.js");
const TTSService = require("./tts.service.js");
const TwitchChattersService = require("./twitch-chatters.service.js");
const FormatterUtils = require("../utils/formatter.utils.js");
const MacroUtils = require("../utils/macro.utils.js");

class PurpleMonkeyChatBot {
  constructor(username, password, canais, twitchConfig) {
    this.username = username;
    this.password = this.formatarTokenChat(password);
    this.canais = canais;
    this.ttsService = new TTSService();
    this.twitchChattersService = new TwitchChattersService({
      ...(twitchConfig || {}),
      botUsername: username,
      userAccessToken:
        (twitchConfig && twitchConfig.userAccessToken) || this.password,
    });
    this.formatterUtils = new FormatterUtils();
  }

  start(servidor) {
    this.listCanais = this.canais.map((canal) => canal.nome);

    this.client = new tmi.Client({
      options: { debug: true },
      identity: {
        username: this.username,
        password: this.password,
      },
      channels: this.listCanais,
    });

    this.client.on("message", async (channel, tags, message, self) => {
      if (self) return;

      this.canais.forEach((canal) => {
        if (canal.nome === channel) {
          canal.comandos.forEach(async (comando) => {
            console.log("testando comando : " + comando.comando);

            if (comando.match(message)) {
              console.log("Executando comando : " + comando.comando);
              try {
                await this.executarComando(comando, channel, tags, message, servidor);
              } catch (error) {
                console.error("Erro ao executar comando:", error);
              }
            }
          });
        }
      });
    });

    this.client.connect();
  }

  async atualizarTokenChat(userAccessToken, servidor) {
    const novoPassword = this.formatarTokenChat(userAccessToken);

    if (!novoPassword || novoPassword === this.password) {
      return;
    }

    this.password = novoPassword;

    if (this.client) {
      await this.client.disconnect();
      this.start(servidor);
    }
  }

  atualizarCanais(canais) {
    const canaisAtuais = new Set(this.listCanais || []);
    const canaisNovos = canais.map((canal) => canal.nome);

    this.canais = canais;
    this.listCanais = canaisNovos;

    if (!this.client) {
      return;
    }

    canaisNovos.forEach((canal) => {
      if (!canaisAtuais.has(canal)) {
        this.client.join(canal).catch((error) => console.error(error));
      }
    });

    canaisAtuais.forEach((canal) => {
      if (!canaisNovos.includes(canal)) {
        this.client.part(canal).catch((error) => console.error(error));
      }
    });
  }

  atualizarConfigTwitch(twitchConfig) {
    this.twitchChattersService.atualizarConfig({
      ...(twitchConfig || {}),
      botUsername: this.username,
      userAccessToken:
        (twitchConfig && twitchConfig.userAccessToken) || this.password,
    });
  }

  async executarComando(comando, channel, tags, message, servidor) {
    if (comando instanceof ComandoTexto) {
      let mensagemResposta = await this.formatarMensagemResposta(
        comando.resposta.mensagem,
        await this.criarMacrosContexto(channel, tags, message)
      );
      mensagemResposta = await this.formatarMensagemResposta(
        mensagemResposta,
        comando.getMacros(message)
      );
      this.client.say(channel, mensagemResposta);
    } else if (comando instanceof ComandoTextoSimples) {
      const mensagemResposta = await this.formatarMensagemResposta(
        comando.resposta.mensagem,
        await this.criarMacrosContexto(channel, tags, message)
      );
      this.client.say(channel, mensagemResposta);
    } else if (comando instanceof ComandoTTS) {
      const mensagemResposta = await this.formatarMensagemResposta(
        comando.resposta.mensagem,
        await this.criarMacrosContexto(channel, tags, message)
      );
      // Envia para a UI/layer via socket para que o app TTS gere a fala com voz de IA
      if (servidor && typeof servidor.notificarSockets === "function") {
        servidor.notificarSockets("alert", {
          tipo: "tts",
          comando: comando.comando,
          texto: mensagemResposta,
          options: comando.options || {},
          usuario: tags.username || "",
          channel,
        });
      } else {
        // Fallback: ainda tenta gerar localmente caso não haja servidor
        const opts = comando.options || {};
        this.ttsService.gerarAudio(mensagemResposta, opts.voice, opts.language);
      }
      // Se o comando tiver uma resposta de chat, envie para o canal
      if (comando.resposta && comando.resposta.mensagem) {
        const respostaChat = await this.formatarMensagemResposta(
          comando.resposta.mensagem,
          await this.criarMacrosContexto(channel, tags, message)
        );
        this.client.say(channel, respostaChat);
      }
    } else if (comando instanceof ComandoChatTTS) {
      const mensagemResposta = comando.resposta ? comando.resposta.mensagem : "";
      const mensagemFormatada = await this.formatarMensagemResposta(
        mensagemResposta,
        await this.criarMacrosContexto(channel, tags, message)
      );
      if (servidor && typeof servidor.notificarSockets === "function") {
        servidor.notificarSockets("alert", {
          tipo: "tts",
          comando: comando.comando,
          texto: mensagemFormatada,
          options: comando.options || {},
          usuario: tags.username || "",
          channel,
        });
      } else {
        const opts = comando.options || {};
        this.ttsService.gerarAudio(mensagemFormatada, opts.voice, opts.language);
      }
      // Opcional: enviar uma confirmação no chat
      if (comando.resposta && comando.resposta.mensagem) {
        this.client.say(channel, mensagemFormatada);
      }
    } else if (comando instanceof ComandoAudio && servidor != null) {
      servidor.notificarSockets("alert", {
        tipo: "audio",
        comando: comando.comando,
        audio: comando.audio,
        usuario: tags.username || "",
        channel,
      });
      console.error("Enviado a mensagem para socket");
    }
  }

  async criarMacrosContexto(channel, tags, message) {
    const macroUtils = new MacroUtils();
    macroUtils.addMacro("{{username}}", tags.username || "");
    macroUtils.addMacro("{{displayName}}", tags["display-name"] || tags.username || "");
    macroUtils.addMacro("{{channel}}", channel.replace("#", ""));
    macroUtils.addMacro("{{message}}", message);
    macroUtils.addMacro("{{random_viewer}}", await this.getRandomViewer(channel, tags));
    macroUtils.addMacro("{{random_follow}}", await this.getRandomFollower(channel, tags));
    return macroUtils.getMacros();
  }

  async getRandomViewer(channel, tags) {
    try {
      return await this.twitchChattersService.getRandomViewer(channel, [
        tags.username,
        this.username,
      ]);
    } catch (error) {
      console.error("Erro ao resolver macro {{random_viewer}}:", error);
      return "";
    }
  }

  async getRandomFollower(channel, tags) {
    try {
      return await this.twitchChattersService.getRandomFollower(channel, [
        tags.username,
        this.username,
      ]);
    } catch (error) {
      console.error("Erro ao resolver macro {{random_viewer}}:", error);
      return "";
    }
  }


  async formatarMensagemResposta(mensagem, macros) {
    return this.formatterUtils.formatarTags(mensagem, macros);
  }

  formatarTokenChat(token) {
    if (!token) {
      return "";
    }

    return token.startsWith("oauth:") ? token : "oauth:" + token;
  }
}

module.exports = PurpleMonkeyChatBot;
