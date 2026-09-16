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
      const roletas = canal.roletas || [];
      const comandos = canal.comandos.map((comando) => {
        const definicao = { ...comando };
        // Compatibilidade: configurações antigas continuam funcionando, mas
        // o trigger deixa de fazer parte da definição do comando em memória.
        delete definicao.trigger;
        if (definicao.tipo === 'roleta' && definicao.roleta) {
          const r = roletas.find(item => item.nome === definicao.roleta);
          if (r) {
            definicao.roletaConfig = r;
            definicao.premios = [
              ...((((canal.listas || []).find(l => l.nome === r.lista) || {}).valores) || []),
              ...(r.premios || []),
            ];
          }
        }
        return this.comandoFactory.criar(definicao);
      });
      const porNome = new Map(comandos.map((comando) => [comando.comando || comando.matcher, comando]));
      roletas.forEach((roleta) => {
        if ((roleta.acionamento === 'comando' || roleta.acionamento === 'regex') && roleta.comando) {
          const premios = [
            ...((((canal.listas || []).find(l => l.nome === roleta.lista) || {}).valores) || []),
            ...(roleta.premios || []),
          ];
          const comandoRoleta = this.comandoFactory.criar({ tipo: 'roleta', comando: roleta.comando, premios, roletaConfig: roleta, restricoes: roleta.restricoes || { usuarios: roleta.usuarios, cargos: roleta.cargos } });
          comandos.push(comandoRoleta);
          porNome.set(roleta.comando, comandoRoleta);
        }
      });
      const triggers = (canal.triggers || []).map((trigger) => ({
        ...trigger,
        comando: porNome.get(trigger.comando) || porNome.get(trigger.command),
      })).filter((trigger) => trigger.comando);
      // Migração transparente das configurações antigas.
      canal.comandos.forEach((definicao) => {
        if (definicao.trigger) {
          const alvo = porNome.get(definicao.comando || definicao.matcher);
          if (alvo) triggers.push({ ...definicao.trigger, comando: alvo });
        }
      });
      roletas.forEach((roleta) => {
        if ((roleta.acionamento === 'regex' || (!roleta.acionamento && roleta.regex)) && roleta.regex && roleta.comando) {
          const alvo = porNome.get(roleta.comando);
          if (alvo) triggers.push({ tipo: 'texto-regex', regex: roleta.regex, comando: alvo, usuarios: roleta.usuarios, cargos: roleta.cargos });
        }
      });

      return new Canal(canal.nome, comandos, canal.listas, triggers);
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
      if (canal.triggers !== undefined && !Array.isArray(canal.triggers)) {
        throw new Error("Config invalida: 'triggers' precisa ser uma lista.");
      }
      if (canal.roletas !== undefined && !Array.isArray(canal.roletas)) throw new Error("Config invalida: 'roletas' precisa ser uma lista.");
      (canal.roletas || []).forEach((roleta) => {
        if (!roleta.nome) throw new Error("Config invalida: toda roleta precisa de 'nome'.");
        if ((!Array.isArray(roleta.premios) || !roleta.premios.length) && !roleta.lista) throw new Error("Config invalida: informe premios ou uma lista na roleta.");
      });
      (canal.triggers || []).forEach((trigger) => {
        if (!trigger.tipo || !trigger.comando) {
          throw new Error("Config invalida: todo trigger precisa de 'tipo' e 'comando'.");
        }
        if (!canal.comandos.some((comando) => (comando.comando || comando.matcher) === trigger.comando)) {
          throw new Error("Config invalida: trigger aponta para comando inexistente: " + trigger.comando);
        }
        if (["texto-regex", "padrao-texto", "padrão-texto"].includes(trigger.tipo) && !trigger.regex && !trigger.padrao) {
          throw new Error("Config invalida: trigger de texto precisa de 'regex'.");
        }
      });

      canal.comandos.forEach((comando) => this.comandoFactory.criar(comando));

      if (canal.recompensas !== undefined && !Array.isArray(canal.recompensas)) {
        throw new Error("Config invalida: 'recompensas' precisa ser uma lista.");
      }

      (canal.recompensas || []).forEach((recompensa) => {
        if (!recompensa.titulo) {
          throw new Error("Config invalida: toda recompensa precisa de titulo.");
        }
        if (!Number.isFinite(Number(recompensa.custo)) || Number(recompensa.custo) < 1) {
          throw new Error("Config invalida: o custo da recompensa precisa ser maior que zero.");
        }
      });
    });
  }
}

module.exports = CanalDatabase;
