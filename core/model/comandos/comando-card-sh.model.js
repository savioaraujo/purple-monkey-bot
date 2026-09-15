const ComandoBase = require("./comando-base.model");

class ComandoCardSH extends ComandoBase {
  constructor(comando, config = {}) {
    super(config);
    this.comando = comando;
    const nomeEscapado = String(comando).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.regex = new RegExp("^" + nomeEscapado + "\\s+@?([a-zA-Z0-9_]+)\\s*$", "i");
  }

  match(mensagem) {
    return this.regex.test(String(mensagem || ""));
  }

  getCanal(mensagem) {
    const match = this.regex.exec(String(mensagem || ""));
    return match ? match[1].toLowerCase() : "";
  }
}

module.exports = ComandoCardSH;