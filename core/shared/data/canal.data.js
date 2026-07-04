const fs = require("fs");
const path = require("path");
const Canal = require("../../model/canal.model");
const ComandoFactory = require("../factory/comando.factory");

class CanalDatabase {
  constructor(configPath) {
    this.configPath =
      configPath || path.join(__dirname, "../../config/canais.config.json");
    this.comandoFactory = new ComandoFactory();
  }

  getCanais() {
    const config = this.getConfig();

    return config.canais.map((canal) => {
      const comandos = canal.comandos.map((comando) =>
        this.comandoFactory.criar(comando)
      );

      return new Canal(canal.nome, comandos, canal.listas);
    });
  }

  getConfig() {
    const conteudo = fs.readFileSync(this.configPath, "utf8");
    return JSON.parse(conteudo);
  }

  salvarConfig(config) {
    this.validarConfig(config);
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
    return this.getConfig();
  }

  validarConfig(config) {
    if (!config || !Array.isArray(config.canais)) {
      throw new Error("Config invalida: informe uma lista 'canais'.");
    }

    config.canais.forEach((canal) => {
      if (!canal.nome) {
        throw new Error("Config invalida: todo canal precisa de 'nome'.");
      }

      if (!Array.isArray(canal.comandos)) {
        throw new Error(
          "Config invalida: o canal " + canal.nome + " precisa de 'comandos'."
        );
      }

      canal.comandos.forEach((comando) => this.comandoFactory.criar(comando));
    });
  }
}

module.exports = CanalDatabase;
