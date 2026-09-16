class Canal {
  constructor(nome, comandos, listas, triggers = []) {
    this.nome = "#" + nome;
    this.comandos = comandos;
    this.listas = listas;
    this.triggers = triggers;
  }
}

module.exports = Canal;
