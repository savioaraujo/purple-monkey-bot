const Servidor = require("./core/shared/service/servidor.js");
const PurpleMonkeyChatBot = require("./core/shared/service/purple-monkey-chat-bot.js");
const CanalDatabase = require("./core/shared/data/canal.data.js");

var servidor = new Servidor(3000);
servidor.registrarApp("/alert", __dirname + "/core/app/alert/index.html");
servidor.registrarApp("/tts", __dirname + "/core/app/tts/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/alert/sounds/");
servidor.start();

let canais = new CanalDatabase().getCanais();

var chatBot = new PurpleMonkeyChatBot(
  "purplemonkeybot",
  "oauth:",
  canais
);

chatBot.start(servidor);
