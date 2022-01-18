const CanalDatabase = require("./core/data/canal.data.js");
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var externalSocket = null;
/* definindo path das aplicações */
app.use(express.static(__dirname + "/core/app/alert/sounds/"));

app.get("/tts", (req, res) => {
  res.sendFile(__dirname + "/core/app/tts/index.html");
});

app.get("/layer", (req, res) => {
  res.sendFile(__dirname + "/core/app/layer/index.html");
});

app.get("/alert", (req, res) => {
  res.sendFile(__dirname + "/core/app/alert/index.html");
});

/* Eventos */
io.on("connection", (socket) => {
  externalSocket = socket;
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
let canais = new CanalDatabase().getCanais();
/* Start do servidor */
server.listen(3000, () => {
  console.log("listening on *:3000");
});
/* Teste de eventos da twitch */
var tmi = require("tmi.js");
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: "purplemonkeybot",
    password: "oauth:",
  },
  channels: [canais[0].canal],
});

// Serviço a ser consumido.
client.on("message", (channel, tags, message, self) => {
  if (self) return;
  canais.forEach((canal) => {
    if (canal.canal == channel) {
      canal.comandos.forEach((comando) => {
        if (message.toLowerCase().startsWith(comando.comando)) {
          console.log("comando executado : " + comando.comando);
          notificarSocket("alert", comando.audio);
        }
      });
    }
  });
  message_tts = message;
});

function notificarSocket(evento, msg) {
  if (externalSocket != null) {
    externalSocket.emit(evento, msg);
  }
}

client.connect();
