const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var externalSocket = null;
/* definindo path das aplicações */
app.use(express.static(__dirname +'/app/alert/sounds/'))

app.get("/tts", (req, res) => {
  res.sendFile(__dirname + "/app/tts/index.html");
});

app.get("/layer", (req, res) => {
  res.sendFile(__dirname + "/app/layer/index.html");
});

app.get("/alert", (req, res) => {
  res.sendFile(__dirname + "/app/alert/index.html");
});

/* Eventos */
io.on("connection", (socket) => {
  externalSocket = socket;
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

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
  channels: ["balderking"],
});

// Serviço a ser consumido.
client.on("message", (channel, tags, message, self) => {
  if (self) return;

  if (externalSocket != null) {
    if (message.toLowerCase().startsWith("!tts")) {
      externalSocket.emit("tts-event", message.replace("!tts", ""));
    } else if (message.toLowerCase().startsWith("!teste")) {
      externalSocket.emit("alert", message.replace("!teste", ""));
    }
  }

  message_tts = message;
});

client.connect();
