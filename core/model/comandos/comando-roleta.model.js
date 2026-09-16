const ComandoBase = require('./comando-base.model');

class ComandoRoleta extends ComandoBase {
  constructor(comando, premios = [], config = {}, roleta = null) {
    super(config);
    this.comando = comando;
    this.premios = Array.isArray(premios) ? premios.map(String).filter(Boolean) : [];
    this.roleta = roleta;
  }
  podeExecutar(tags = {}) {
    if (!super.podeExecutar(tags)) return false;
    const r = this.roleta || {}, usuarios = Array.isArray(r.usuarios) ? r.usuarios.map(x => String(x).toLowerCase()) : [];
    const usuario = String(tags.username || tags.user || '').toLowerCase();
    if (usuarios.length && !usuarios.includes(usuario)) return false;
    const cargos = Array.isArray(r.cargos) ? r.cargos : ((r.restricoes && r.restricoes.cargos) || []);
    if (cargos.length) { const antiga = this.restricoes; this.restricoes = { cargos }; const ok = this.cargoEhPermitido(tags); this.restricoes = antiga; if (!ok) return false; }
    return true;
  }
  match(mensagem) {
    const texto = String(mensagem || '').toLowerCase();
    return texto === String(this.comando).toLowerCase() || texto.startsWith(String(this.comando).toLowerCase() + ' ');
  }
}
module.exports = ComandoRoleta;
