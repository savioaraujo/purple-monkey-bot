const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

class Servidor {
  constructor(porta) {
    this.porta = porta;
    this.sockets = [];
    this.ttsProcessorSocket = null;
    this.ttsCatalogoPuter = { voices: [], engines: [] };
    this.app = express();
    this.app.use(express.json({ limit: "100mb" }));
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);

    this.io.on("connection", (socket) => {
      console.log("Conectando novo usuário...");
      this.sockets.push(socket);
      console.log(this.sockets.length);

      socket.on("tts:register-processor", () => {
        this.ttsProcessorSocket = socket;
        console.log("[tts] processador registrado para geração de áudio. socketId=" + socket.id);
      });
      socket.on("tts:catalog", (catalogo) => {
        if (socket !== this.ttsProcessorSocket || !catalogo) return;
        this.ttsCatalogoPuter = { voices: Array.isArray(catalogo.voices) ? catalogo.voices : [], engines: Array.isArray(catalogo.engines) ? catalogo.engines : [] };
        console.log('[tts] catálogo Puter atualizado: ' + this.ttsCatalogoPuter.voices.length + ' vozes.');
      });

      socket.on("tts:request", (payload) => {
        if (this.ttsProcessorSocket === socket) return;
        if (!this.ttsProcessorSocket) {
          console.warn("[tts] solicitação recebida sem processador registrado.");
          return;
        }
        this.ttsProcessorSocket.emit("tts:request", payload || {});
      });

      socket.on("tts:ready", (payload) => {
        const payloadTts = {
          tipo: "tts",
          ...(payload || {}),
        };

        console.log("[tts] áudio processado e pronto para o overlay:", payloadTts && payloadTts.comando ? payloadTts.comando : "sem-comando");
        this.notificarSockets("alert", payloadTts);
      });

      socket.on("disconnect", () => {
        console.log("Desconectando usuário... ");
        if (this.ttsProcessorSocket === socket) {
          this.ttsProcessorSocket = null;
        }
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
  registrarConteudoPublico(dir, path) {
    if (path) {
      this.app.use(path, express.static(dir));
    } else {
      this.app.use(express.static(dir));
    }
  }

  registrarGet(path, callback) {
    this.app.get(path, callback);
  }

  registrarPost(path, callback) {
    this.app.post(path, callback);
  }

  registrarDelete(path, callback) {
    this.app.delete(path, callback);
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

  hasTTSProcessor() {
    return Boolean(this.ttsProcessorSocket);
  }

  getTtsCatalogoPuter() { return this.ttsCatalogoPuter || { voices: [], engines: [] }; }

  notificarProcessadorTts(msg) {
    if (!this.ttsProcessorSocket) {
      console.log("[tts] pedido recusado: processador não conectado. payload=", msg && msg.comando ? msg.comando : "sem-comando");
      return false;
    }

    console.log("[tts] enviando pedido para processador. comando=", msg && msg.comando ? msg.comando : "sem-comando");
    this.ttsProcessorSocket.emit("tts:request", msg);
    return true;
  }
}

module.exports = Servidor;
