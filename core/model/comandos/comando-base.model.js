class ComandoBase {
  constructor(config = {}) {
    this.config = config || {};
    this.tipo = this.config.tipo || null;
    this.comando = this.config.comando || null;
    this.restricoes = this.config.restricoes || {};
    this.trigger = this.config.trigger || null;
    this.usuariosPermitidos = this.normalizarLista(
      this.restricoes.usuarios || this.restricoes.usuario
    );
    this.cargosPermitidos = this.normalizarLista(
      this.restricoes.cargos || this.restricoes.cargo
    );
  }

  normalizarLista(valor) {
    if (valor === undefined || valor === null || valor === "") {
      return [];
    }

    const lista = Array.isArray(valor) ? valor : [valor];
    return lista
      .filter((item) => item !== undefined && item !== null && item !== "")
      .map((item) => this.normalizarTexto(item));
  }

  normalizarTexto(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  getUsuariosTrigger() {
    if (!this.trigger) {
      return [];
    }

    return this.normalizarLista(
      this.trigger.usuarios || this.trigger.usuario || []
    );
  }

  temRestricao() {
    return this.usuariosPermitidos.length > 0 || this.cargosPermitidos.length > 0;
  }

  usuarioEhPermitido(username = "") {
    const usuario = this.normalizarTexto(username);
    return Boolean(usuario && this.usuariosPermitidos.includes(usuario));
  }

  cargoEhPermitido(tags = {}) {
    if (this.cargosPermitidos.length === 0) {
      return false;
    }

    const badges = tags && tags.badges ? tags.badges : {};
    const badgesKeys = Object.keys(badges).map((badge) => this.normalizarTexto(badge));
    const flags = {
      moderator: Boolean(tags && tags.mod),
      broadcaster: Boolean(tags && tags.badges && tags.badges.broadcaster),
      vip: Boolean(tags && tags.badges && tags.badges.vip),
      subscriber: Boolean(tags && tags.badges && tags.badges.subscriber),
      staff: Boolean(tags && tags.badges && tags.badges.staff),
    };

    return this.cargosPermitidos.some((cargo) => {
      if (["moderador", "moderator", "mod"].includes(cargo)) {
        return flags.moderator || badgesKeys.includes("moderator");
      }

      if (["broadcaster", "streamer", "dono"].includes(cargo)) {
        return flags.broadcaster || badgesKeys.includes("broadcaster");
      }

      if (["vip"].includes(cargo)) {
        return flags.vip || badgesKeys.includes("vip");
      }

      if (["subscriber", "sub", "assinante"].includes(cargo)) {
        return flags.subscriber || badgesKeys.includes("subscriber");
      }

      if (["staff", "admin"].includes(cargo)) {
        return flags.staff || badgesKeys.includes("staff");
      }

      return badgesKeys.includes(cargo) || this.normalizarTexto(tags["user-type"] || "") === cargo;
    });
  }

  podeExecutar(tags = {}) {
    if (!this.temRestricao()) {
      return true;
    }

    const username = tags && (tags.username || tags.user || tags["display-name"]);
    if (this.usuarioEhPermitido(username)) {
      return true;
    }

    return this.cargoEhPermitido(tags);
  }

  temTriggerAtivo(tags = {}, evento = {}) {
    if (!this.trigger || !this.trigger.tipo) {
      return true;
    }

    if (this.trigger.tipo === "primeira-mensagem") {
      const usuariosAlvo = this.getUsuariosTrigger();
      const usuarioAtual = this.normalizarTexto(tags.username || tags.user || "");
      const usuarioEmTrigger = usuariosAlvo.length === 0 || usuariosAlvo.includes(usuarioAtual);
      const eventoPrimeiraMensagem = Boolean(
        (evento && (evento.primeiraMensagemDoDia || evento.primeiraMensagem))
      );
      return eventoPrimeiraMensagem && usuarioEmTrigger;
    }

    return true;
  }

  match() {}

  format(tags, mensagem) {}
}

module.exports = ComandoBase;
