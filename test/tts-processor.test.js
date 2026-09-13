const test = require("node:test");
const assert = require("node:assert/strict");
const PurpleMonkeyChatBot = require("../core/shared/service/purple-monkey-chat-bot.js");
const ComandoTTS = require("../core/model/comandos/comando-tts.model.js");

test("envia pedido de TTS para processador quando ele estiver conectado", async () => {
  const eventos = [];
  const bot = new PurpleMonkeyChatBot("bot", "senha", [{ nome: "#canal", comandos: [] }], { userAccessToken: "oauth:token" });
  bot.client = { say() {} };

  const servidor = {
    notificarSockets: (evento, payload) => eventos.push([evento, payload]),
    hasTTSProcessor: () => true,
    notificarProcessadorTts: (payload) => {
      eventos.push(["tts:request", payload]);
      return true;
    },
  };

  const comando = new ComandoTTS("!tts", { mensagem: "hello from tts" }, { voice: "Microsoft Maria Desktop", language: "pt-BR" });

  await bot.executarComando(comando, "#canal", { username: "viewer" }, "!tts", servidor);

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0][0], "tts:request");
  assert.equal(eventos[0][1].texto, "hello from tts");
  assert.equal(eventos[0][1].usuario, "viewer");
});
