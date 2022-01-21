/**
 * Comandos de textos simples são usados apenas para receber e emitir uma resposta no próprio chat
 * de forma direta. Ex :
 * chat : !teste
 * response : Retornando um texto de teste.
 */
class ComandoTextoSimples {
  constructor(comando, resposta, matcher) {
    this.comando = comando;
    this.resposta = resposta;
    this.matcher = matcher;
  }

  match(mensagem) {
    if (this.matcher != null && this.matcher != undefined) {
      return this.matcher.match(mensagem);
    } else {
      return mensagem.toLowerCase().startsWith(this.comando);
    }
  }
}

module.exports = ComandoTextoSimples;
