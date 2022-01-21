class FormatterUtils {
  camalize(str) {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, function (match, chr) {
        return chr.toUpperCase();
      });
  }
  camelSentence(str) {
    return (" " + str)
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, function (match, chr) {
        return chr.toUpperCase();
      });
  }

  formatarTags(mensagem, macros) {
    // TODO : verificar se possui tags default
    // caso posuir, adicionar na lista de macros.
    // EX : {{random_1_100}}, {{random_list_classe}}
    macros.forEach((macro) => {
      mensagem = mensagem.replace(macro.marcacao, macro.valor);
    });

    return mensagem;
  }
}

module.exports = FormatterUtils;
