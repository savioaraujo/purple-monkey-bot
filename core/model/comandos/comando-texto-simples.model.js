/**
 * Comandos de textos simples são usados apenas para receber e emitir uma resposta no próprio chat
 * de forma direta. Ex :
 * chat : !teste
 * response : Retornando um texto de teste.
 */
class ComandoTextoSimples {
  constructor(comando, resposta) {
    this.comando = comando;
    this.resposta = resposta;
  }

  match(mensagem) {
    return mensagem.toLowerCase().startsWith(this.comando);
  }
}

module.exports = ComandoTextoSimples;
