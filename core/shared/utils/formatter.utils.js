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
    macros.forEach((macro) => {
      mensagem = mensagem.split(macro.marcacao).join(macro.valor);
    });

    return mensagem;
  }
}

module.exports = FormatterUtils;
