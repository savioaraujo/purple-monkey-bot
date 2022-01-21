class Matcher {
  constructor(regex) {
    this.regex = new RegExp(regex);
  }

  match(mensagem) {
    return mensagem.toLowerCase().match(this.regex);
  }

  getGroups(mensagem) {
    let groups = this.regex.exec("" + mensagem.toLowerCase());
    return groups;
  }
}

module.exports = Matcher;
