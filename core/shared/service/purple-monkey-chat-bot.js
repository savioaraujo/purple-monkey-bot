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
const { resolverSenhaBot } = require("./bot-auth.utils.js");

class PurpleMonkeyChatBot {
  constructor(username, password, canais, twitchConfig) {
    this.username = username;
    this.password = this.formatarTokenChat(resolverSenhaBot(twitchConfig) || password);
    this.canais = canais;
    this.ttsService = new TTSService();
    this.twitchChattersService = new TwitchChattersService({
      ...(twitchConfig || {}),
      botUsername: username,
      userAccessToken: this.password,
    });
    this.formatterUtils = new FormatterUtils();
    this.listCanais = [];
    this.client = null;
    this.status = "inicializando";
    this.ultimoErro = "";
    this.conectado = false;
    this.primeirasMensagensPorDia = new Map();
  }

  setStatus(status, erro) {
    this.status = status;
    this.ultimoErro = erro || "";
    this.conectado = status === "conectado";
  }

  getStatusResumo() {
    return {
      conectado: this.conectado,
      status: this.status,
      ultimoErro: this.ultimoErro || null,
      username: this.username,
      canais: this.listCanais || [],
    };
  }

  start(servidor) {
    this.listCanais = this.canais.map((canal) => canal.nome);
    this.setStatus("tentando-conectar");

    if (this.client && typeof this.client.disconnect === "function") {
      this.client.disconnect().catch(() => {});
    }

    this.client = new tmi.Client({
      options: { debug: true },
      connection: { reconnect: true, secure: true },
      identity: {
        username: this.username,
        password: this.password,
      },
      channels: this.listCanais,
    });

    this.client.on("connected", () => {
      this.setStatus("conectado");
      console.log("Conectado ao chat da Twitch.");
    });

    this.client.on("disconnected", (reason) => {
      this.setStatus("desconectado", reason || "conexão encerrada");
      console.warn("Desconectado do chat da Twitch:", reason);
    });

    this.client.on("reconnect", () => {
      this.setStatus("reconectando");
      console.log("Reconectando ao chat da Twitch...");
    });

    this.client.on("error", (error) => {
      const message = error && error.message ? error.message : String(error);
      this.setStatus("erro", message);
      console.error("Erro no cliente Twitch:", error);
    });

    this.client.on("message", async (channel, tags, message, self) => {
      if (self) return;

      const username = String(tags && (tags.username || tags.user) || "").trim();
      const canalNome = String(channel || "").replace(/^#/, "").toLowerCase();
      const dataHoje = new Date().toISOString().slice(0, 10);
      const chaveUsuarioDia = `${canalNome}:${username.toLowerCase()}:${dataHoje}`;
      const primeiraMensagemDoDia = !this.primeirasMensagensPorDia.has(chaveUsuarioDia);

      if (primeiraMensagemDoDia) {
        console.log(`[trigger] Usuário ${username} enviou a primeira mensagem do dia no canal #${canalNome} (${dataHoje}).`);
      } else {
        console.log(`[trigger] Usuário ${username} já enviou mensagem hoje no canal #${canalNome} (${dataHoje}).`);
      }

      this.primeirasMensagensPorDia.set(chaveUsuarioDia, true);

      this.canais.forEach((canal) => {
        if (canal.nome === channel) {
          canal.comandos.forEach(async (comando) => {
            const nomeComando = comando.comando || comando.matcher || "comando";
            console.log("testando comando : " + nomeComando);

            const deveExecutar = this.deveExecutarComando(comando, message, tags, {
              primeiraMensagemDoDia,
            });

            if (!deveExecutar) {
              console.log("Comando não elegível para execução: " + nomeComando);
              return;
            }

            console.log("Executando comando : " + nomeComando);
            try {
              await this.executarComando(comando, channel, tags, message, servidor);
            } catch (error) {
              console.error("Erro ao executar comando:", error);
            }
          });
        }
      });
    });

    this.client.connect().catch((error) => {
      const message = error && error.message ? error.message : String(error);
      this.setStatus("erro", message);
      console.error("Erro ao conectar ao chat da Twitch:", error);
    });
  }

  async atualizarTokenChat(userAccessToken, servidor) {
    const novoPassword = this.formatarTokenChat(userAccessToken);

    if (!novoPassword) {
      this.setStatus("erro", "Token de acesso não informado.");
      return;
    }

    const mudouSenha = novoPassword !== this.password;
    this.password = novoPassword;

    if (this.client && (mudouSenha || this.status !== "conectado")) {
      await this.client.disconnect().catch(() => {});
      this.start(servidor);
    } else if (!this.client) {
      this.start(servidor);
    }
  }

  async reconectar(servidor, userAccessToken) {
    if (userAccessToken) {
      this.password = this.formatarTokenChat(userAccessToken);
    }

    if (this.client) {
      await this.client.disconnect().catch(() => {});
    }

    this.start(servidor);
    return this.getStatusResumo();
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
    const canalContexto = this.obterCanalContexto(channel);

    if (comando instanceof ComandoTexto) {
      const macrosContexto = await this.criarMacrosContexto(
        channel,
        tags,
        message,
        comando.resposta.mensagem,
        canalContexto
      );
      let mensagemResposta = await this.formatarMensagemResposta(
        comando.resposta.mensagem,
        macrosContexto
      );
      mensagemResposta = await this.formatarMensagemResposta(
        mensagemResposta,
        comando.getMacros(message)
      );
      this.client.say(channel, mensagemResposta);
    } else if (comando instanceof ComandoTextoSimples) {
      const mensagemResposta = await this.formatarMensagemResposta(
        comando.resposta.mensagem,
        await this.criarMacrosContexto(channel, tags, message, comando.resposta.mensagem, canalContexto)
      );
      this.client.say(channel, mensagemResposta);
    } else if (comando instanceof ComandoTTS) {
      const mensagemResposta = await this.formatarMensagemResposta(
        comando.resposta.mensagem,
        await this.criarMacrosContexto(channel, tags, message, comando.resposta.mensagem, canalContexto)
      );
      const opts = comando.options || {};
      const payloadTts = {
        tipo: "tts",
        comando: comando.comando,
        texto: mensagemResposta,
        options: opts,
        usuario: tags.username || "",
        channel,
      };

      if (servidor && typeof servidor.notificarProcessadorTts === "function") {
        console.log("[tts-bot] comando TTS recebido. comando=", comando.comando, "usuario=", tags.username || "");
        const processado = servidor.notificarProcessadorTts(payloadTts);
        if (!processado && servidor && typeof servidor.notificarSockets === "function") {
          console.log("[tts-bot] processador indisponível; enviando ao overlay diretamente.");
          servidor.notificarSockets("alert", payloadTts);
        }
      } else if (servidor && typeof servidor.notificarSockets === "function") {
        console.log("[tts-bot] servidor sem processador; enviando ao overlay diretamente.");
        servidor.notificarSockets("alert", payloadTts);
      }
      // Se o comando tiver uma resposta de chat, envie para o canal
      if (comando.resposta && comando.resposta.mensagem) {
        const respostaChat = await this.formatarMensagemResposta(
          comando.resposta.mensagem,
          await this.criarMacrosContexto(channel, tags, message, comando.resposta.mensagem, canalContexto)
        );
        this.client.say(channel, respostaChat);
      }
    } else if (comando instanceof ComandoChatTTS) {
      const mensagemResposta = comando.resposta ? comando.resposta.mensagem : "";
      const mensagemFormatada = await this.formatarMensagemResposta(
        mensagemResposta,
        await this.criarMacrosContexto(channel, tags, message, mensagemResposta, canalContexto)
      );
      const opts = comando.options || {};
      const payloadTts = {
        tipo: "tts",
        comando: comando.comando,
        texto: mensagemFormatada,
        options: opts,
        usuario: tags.username || "",
        channel,
      };

      if (servidor && typeof servidor.notificarProcessadorTts === "function") {
        console.log("[tts-bot] comando TTS recebido. comando=", comando.comando, "usuario=", tags.username || "");
        const processado = servidor.notificarProcessadorTts(payloadTts);
        if (!processado && servidor && typeof servidor.notificarSockets === "function") {
          console.log("[tts-bot] processador indisponível; enviando ao overlay diretamente.");
          servidor.notificarSockets("alert", payloadTts);
        }
      } else if (servidor && typeof servidor.notificarSockets === "function") {
        console.log("[tts-bot] servidor sem processador; enviando ao overlay diretamente.");
        servidor.notificarSockets("alert", payloadTts);
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

  isPrimeiraMensagemDoDia(channel, username) {
    const canalNome = String(channel || "").replace(/^#/, "").toLowerCase();
    const usuarioNome = String(username || "").trim().toLowerCase();
    const dataHoje = new Date().toISOString().slice(0, 10);
    const chaveUsuarioDia = `${canalNome}:${usuarioNome}:${dataHoje}`;
    const primeiraMensagemDoDia = !this.primeirasMensagensPorDia.has(chaveUsuarioDia);

    if (primeiraMensagemDoDia) {
      this.primeirasMensagensPorDia.set(chaveUsuarioDia, true);
    }

    return primeiraMensagemDoDia;
  }

  deveExecutarComando(comando, message, tags, evento = {}) {
    const hasTrigger = Boolean(comando && comando.trigger && comando.trigger.tipo);
    const triggerAtivo = hasTrigger && typeof comando.temTriggerAtivo === "function"
      ? comando.temTriggerAtivo(tags || {}, evento)
      : false;

    if (triggerAtivo) {
      const autorizado = typeof comando.podeExecutar !== "function" || comando.podeExecutar(tags || {});
      console.log(
        `[trigger] comando=${comando && (comando.comando || comando.matcher || "comando")} ` +
        `usuario=${tags && (tags.username || tags.user || "")} ` +
        `triggerAtivo=${triggerAtivo} autorizado=${autorizado}`
      );
      return autorizado;
    }

    if (typeof comando.match !== "function") {
      return false;
    }

    if (!comando.match(message)) {
      return false;
    }

    if (typeof comando.podeExecutar === "function" && !comando.podeExecutar(tags || {})) {
      return false;
    }

    return true;
  }

  async criarMacrosContexto(channel, tags, message, textoBase = "", canalContexto = null) {
    const macroUtils = new MacroUtils();
    const textoParaResolver = textoBase || message || "";

    macroUtils.addMacro("{{username}}", tags.username || "");
    macroUtils.addMacro("{{displayName}}", tags["display-name"] || tags.username || "");
    macroUtils.addMacro("{{channel}}", channel.replace("#", ""));
    macroUtils.addMacro("{{message}}", message);

    if (textoParaResolver.includes("{{random_viewer}}")) {
      macroUtils.addMacro("{{random_viewer}}", await this.getRandomViewer(channel, tags));
    }

    if (textoParaResolver.includes("{{random_follow}}")) {
      macroUtils.addMacro("{{random_follow}}", await this.getRandomFollower(channel, tags));
    }

    return this.adicionarMacrosAleatorias(macroUtils, textoParaResolver, canalContexto);
  }

  adicionarMacrosAleatorias(macroUtils, textoBase, canalContexto = null) {
    const regexIntervalo = /\{\{random_(\d+)_(\d+)\}\}/gi;
    const regexLista = /\{\{random_pick_([^}]+)\}\}/gi;
    let match;

    while ((match = regexIntervalo.exec(textoBase || "")) !== null) {
      const inicio = Number.parseInt(match[1], 10);
      const fim = Number.parseInt(match[2], 10);
      const valor = this.getValorAleatorioIntervalo(inicio, fim);
      macroUtils.addMacro(match[0], String(valor));
    }

    while ((match = regexLista.exec(textoBase || "")) !== null) {
      const valor = this.getValorAleatorioLista(canalContexto, match[1]);
      macroUtils.addMacro(match[0], String(valor));
    }

    return macroUtils.getMacros();
  }

  getValorAleatorioIntervalo(inicio, fim) {
    const inicioNum = Number.parseInt(inicio, 10);
    const fimNum = Number.parseInt(fim, 10);
    if (Number.isNaN(inicioNum) || Number.isNaN(fimNum)) {
      return "";
    }
    const min = Math.min(inicioNum, fimNum);
    const max = Math.max(inicioNum, fimNum);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getValorAleatorioLista(canalContexto, nomeLista) {
    const nomeNormalizado = this.normalizarNomeLista(nomeLista);
    if (!nomeNormalizado || !canalContexto || !Array.isArray(canalContexto.listas)) {
      return "";
    }

    const lista = canalContexto.listas.find((item) => this.normalizarNomeLista(item && item.nome) === nomeNormalizado);
    if (!lista || !Array.isArray(lista.valores) || lista.valores.length === 0) {
      return "";
    }

    const valor = lista.valores[Math.floor(Math.random() * lista.valores.length)];
    return valor == null ? "" : String(valor);
  }

  normalizarNomeLista(nome) {
    return String(nome || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  obterCanalContexto(channel) {
    const nomeCanal = String(channel || "").replace(/^#/, "").toLowerCase();
    return (this.canais || []).find((canal) => {
      const nomeCanalContexto = String(canal && canal.nome ? canal.nome : "")
        .replace(/^#/, "")
        .toLowerCase();
      return nomeCanalContexto === nomeCanal;
    });
  }

  async getRandomViewer(channel, tags) {
    try {
      return await this.twitchChattersService.getRandomViewer(channel, [
        tags.username,
        this.username,
        'StreamElements'
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
        'StreamElements'
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
