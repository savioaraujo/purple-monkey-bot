const Canal = require("../model/canal.model.js");
const ComandoAudio = require("../model/comandos/comando-audio.model.js");

class CanalDatabase {
  constructor() {}

  getCanais() {
    var comandos = [
      new ComandoAudio("!bemtevi", "bem-tevi.mp3"),
      new ComandoAudio("!nanezinha", "nanezinha.mp3"),
    ];
    var canal = new Canal("balderking", comandos);
    var canais = [canal];
    return canais;
  }
}

module.exports = CanalDatabase;
