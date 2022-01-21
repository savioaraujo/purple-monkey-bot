class MacroUtils {
  constructor() {
    this.macros = [];
  }

  addMacro(marcacao, valor) {
    this.macros.push({ marcacao: marcacao, valor: valor });
  }

  getMacros() {
    return this.macros;
  }
}

module.exports = MacroUtils;
