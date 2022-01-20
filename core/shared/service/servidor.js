const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

class Servidor {
  constructor(porta) {
    this.porta = porta;
    this.sockets = [];
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);

    this.io.on("connection", (socket) => {
      console.log("Conectando novo usuário...");
      this.sockets.push(socket);
      console.log(this.sockets.length);
      socket.on("disconnect", () => {
        console.log("Desconectando usuário... ");
        let ultimo = this.sockets[this.sockets.length - 1];
        this.sockets[this.sockets.indexOf(socket)] = ultimo;
        this.sockets.pop();

        console.log(this.sockets.length);
      });
    });
  }

  registrarApp(path, index) {
    this.app.get(path, (req, res) => {
      res.sendFile(index);
    });
  }
  registrarConteudoPublico(dir) {
    this.app.use(express.static(dir));
  }

  start() {
    this.server.listen(this.porta, () => {
      console.log("Servidor up na porta *:" + this.porta);
    });
  }

  notificarSockets(evento, msg) {
    this.sockets.forEach((socket) => {
      socket.emit(evento, msg);
    });
  }
}

module.exports = Servidor;
