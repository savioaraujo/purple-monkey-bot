const MacroUtils = require("../../shared/utils/macro.utils");
const Matcher = require("../../shared/utils/matcher.utils");

/**
 * Comandos de textos simples são usados apenas para receber e emitir uma resposta no próprio chat
 * de forma direta. Ex :
 * chat : !teste
 * response : Retornando um texto de teste.
 */
class ComandoTexto {
  constructor(matcher, resposta) {
    this.matcher = new Matcher(matcher);
    this.resposta = resposta;
  }

  match(mensagem) {
    return this.matcher.match(mensagem);
  }
  // Retorna valores vindos da macro
  getMacros(mensagem) {
    let groups = this.matcher.getGroups(mensagem);
    let macros = new MacroUtils();
    let i = 0;
    groups.forEach((value) => {
      macros.addMacro("{{g" + i++ + "}}", value);
    });
    return macros.getMacros();
  }
}

module.exports = ComandoTexto;
