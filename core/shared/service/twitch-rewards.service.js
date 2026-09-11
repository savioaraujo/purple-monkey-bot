const WebSocket = require("ws");

class TwitchRewardsService {
  constructor(canalDatabase, servidor, options) {
    this.canalDatabase = canalDatabase;
    this.servidor = servidor;
    this.WebSocket = (options && options.WebSocket) || WebSocket;
    this.fetch = (options && options.fetch) || global.fetch;
    this.socket = null;
    this.status = "parado";
    this.ultimoErro = "";
    this.reconnectTimer = null;
    this.reconnectUrl = "";
    this.logs = [];
  }

  iniciar() {
    this.parar();
    const twitch = this.getTwitch();
    if (!twitch.userAccessToken || !twitch.moderatorId) {
      this.status = "aguardando-token";
      this.registrarLog("aviso", "EventSub aguardando token e ID do broadcaster.");
      return;
    }
    this.registrarLog("info", "Iniciando conexão EventSub para o broadcaster " + twitch.moderatorId + ".");
    this.conectar("wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30");
  }

  reiniciar() {
    this.iniciar();
  }

  parar() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
  }

  conectar(url) {
    this.status = "conectando";
    const socket = new this.WebSocket(url);
    this.socket = socket;
    socket.on("message", (raw) => this.receberMensagem(raw));
    socket.on("error", (error) => {
      this.ultimoErro = error.message || String(error);
      this.status = "erro";
      this.registrarLog("erro", "Erro no WebSocket: " + this.ultimoErro);
    });
    socket.on("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.status = "desconectado";
      this.registrarLog("aviso", "WebSocket desconectado; nova tentativa em 5 segundos.");
      this.reconnectTimer = setTimeout(() => this.iniciar(), 5000);
    });
  }

  async receberMensagem(raw) {
    let mensagem;
    try {
      mensagem = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    const tipo = mensagem.metadata && mensagem.metadata.message_type;
    if (tipo === "session_welcome") {
      this.status = "conectado";
      this.ultimoErro = "";
      this.registrarLog("info", "WebSocket conectado. Criando assinatura de resgates.");
      await this.criarAssinatura(mensagem.payload.session.id).catch((error) => {
        this.status = "erro";
        this.ultimoErro = error.message;
        console.error("Erro ao assinar recompensas Twitch:", error);
        this.registrarLog("erro", error.message);
      });
    } else if (tipo === "session_reconnect") {
      const url = mensagem.payload.session.reconnect_url;
      const antigo = this.socket;
      this.socket = null;
      this.conectar(url);
      if (antigo) antigo.close();
    } else if (tipo === "notification") {
      const evento = mensagem.payload.event || {};
      this.registrarLog("resgate", "Resgate recebido: " + ((evento.reward && evento.reward.title) || "sem título") + " [" + ((evento.reward && evento.reward.id) || "sem ID") + "] por " + (evento.user_name || evento.user_login || "desconhecido") + ".");
      this.processarResgate(mensagem.payload.event);
    } else if (tipo === "revocation") {
      this.status = "revogado";
      this.ultimoErro = mensagem.payload.subscription.status || "Assinatura revogada";
    }
  }

  async criarAssinatura(sessionId) {
    const twitch = this.getTwitch();
    const response = await this.fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: this.headers(twitch),
      body: JSON.stringify({
        type: "channel.channel_points_custom_reward_redemption.add",
        version: "1",
        condition: { broadcaster_user_id: twitch.moderatorId },
        transport: { method: "websocket", session_id: sessionId },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error("EventSub: " + JSON.stringify(data));
    this.registrarLog("info", "Assinatura EventSub criada com sucesso.");
    return data;
  }

  processarResgate(evento) {
    if (!evento || !evento.reward) return false;
    const config = this.canalDatabase.getConfig();
    const canal = (config.canais || []).find((item) =>
      this.normalizarCanal(item.nome) === this.normalizarCanal(evento.broadcaster_user_login)
    );
    if (!canal) {
      this.registrarLog("aviso", "Resgate ignorado: canal " + evento.broadcaster_user_login + " não está configurado.");
      return false;
    }
    const recompensas = Array.isArray(canal.recompensas) ? canal.recompensas : [];
    const recompensa = recompensas.find((item) => item.ativo !== false && (
      (item.rewardId && item.rewardId === evento.reward.id) ||
      (!item.rewardId && String(item.titulo || "").toLowerCase() === String(evento.reward.title || "").toLowerCase())
    ));
    if (!recompensa) {
      this.registrarLog("aviso", "Resgate sem configuração correspondente. rewardId=" + evento.reward.id + ", título=" + evento.reward.title + ".");
      return false;
    }
    this.servidor.notificarSockets("alert", {
      tipo: "midia",
      origem: "pontos-do-canal",
      recompensa: evento.reward.title,
      usuario: evento.user_name || evento.user_login || "",
      texto: evento.user_input || "",
      midia: recompensa.midia || "",
      audio: recompensa.audio || "",
      duracao: Number(recompensa.duracao) || 8,
    });
    this.registrarLog("info", "Alerta enviado para a fila do overlay: " + evento.reward.title + ".");
    return true;
  }

  async criarRecompensa(definicao) {
    const twitch = this.getTwitch();
    if (!twitch.userAccessToken || !twitch.moderatorId) {
      throw new Error("Conecte a conta do broadcaster na Twitch primeiro.");
    }
    const response = await this.fetch(
      "https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=" + encodeURIComponent(twitch.moderatorId),
      {
        method: "POST",
        headers: this.headers(twitch),
        body: JSON.stringify({
          title: String(definicao.titulo || "").trim(),
          cost: Number(definicao.custo),
          prompt: String(definicao.descricao || "").trim(),
          is_enabled: definicao.ativo !== false,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error("Twitch: " + JSON.stringify(data));
    return data.data && data.data[0];
  }

  async atualizarRecompensa(rewardId, definicao) {
    const twitch = this.getTwitch();
    const response = await this.fetch("https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=" + encodeURIComponent(twitch.moderatorId) + "&id=" + encodeURIComponent(rewardId), {
      method: "PATCH",
      headers: this.headers(twitch),
      body: JSON.stringify({ title: String(definicao.titulo || "").trim(), cost: Number(definicao.custo), prompt: String(definicao.descricao || "").trim(), is_enabled: definicao.ativo !== false }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Twitch: " + JSON.stringify(data));
    return data.data && data.data[0];
  }

  async salvarRecompensa(definicao) {
    const recompensa = definicao.rewardId
      ? await this.atualizarRecompensa(definicao.rewardId, definicao)
      : await this.criarRecompensa(definicao);
    this.registrarLog("info", (definicao.rewardId ? "Recompensa atualizada" : "Recompensa criada") + " na Twitch: " + recompensa.title + " [" + recompensa.id + "].");
    return recompensa;
  }

  async excluirRecompensa(rewardId) {
    if (!rewardId) return;
    const twitch = this.getTwitch();
    const response = await this.fetch("https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=" + encodeURIComponent(twitch.moderatorId) + "&id=" + encodeURIComponent(rewardId), { method: "DELETE", headers: this.headers(twitch) });
    if (!response.ok) {
      const texto = await response.text();
      throw new Error("Twitch: " + texto);
    }
    this.registrarLog("info", "Recompensa excluída da Twitch: " + rewardId + ".");
  }

  registrarLog(nivel, mensagem) {
    const item = { data: new Date().toISOString(), nivel, mensagem };
    this.logs.push(item);
    if (this.logs.length > 100) this.logs.shift();
    console.log("[Twitch Rewards][" + nivel.toUpperCase() + "] " + mensagem);
  }

  getLogs() {
    return this.logs.slice().reverse();
  }

  headers(twitch) {
    return {
      Authorization: "Bearer " + String(twitch.userAccessToken || "").replace(/^oauth:/, ""),
      "Client-Id": twitch.clientId || process.env.TWITCH_CLIENT_ID || "",
      "Content-Type": "application/json",
    };
  }

  getTwitch() {
    return this.canalDatabase.getConfig().twitch || {};
  }

  getStatus() {
    return { status: this.status, conectado: this.status === "conectado", ultimoErro: this.ultimoErro || null };
  }

  normalizarCanal(nome) {
    return String(nome || "").replace(/^#/, "").toLowerCase();
  }
}

module.exports = TwitchRewardsService;
