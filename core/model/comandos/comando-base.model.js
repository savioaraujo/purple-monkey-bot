class ComandoBase {
  constructor(tipo, comando) {
    this.tipo = tipo;
    this.comando = comando;
  }
  match() {}

  format(tags, mensagem) {}
}

module.exports = ComandoBase;
