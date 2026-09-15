const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function carregarPlayer(pagina) {
  const script = fs.readFileSync(path.join(__dirname, "..", "core", "app", "alert", "alert-player.js"), "utf8");
  const eventos = {};
  const fetchCalls = [];
  const mediaStage = { classList: { add() {}, remove() {} } };
  const image = { classList: { add() {}, remove() {} }, removeAttribute() {} };
  const video = { classList: { add() {}, remove() {} }, removeAttribute() {}, pause() {}, load() {}, play() { return Promise.resolve(); }, currentTime: 0, src: "" };
  const socket = {
    on(evento, callback) {
      eventos[evento] = callback;
    },
  };

  const context = {
    window: {
      location: { pathname: pagina },
      speechSynthesis: { getVoices: () => [], speak() {}, onvoiceschanged: null },
    },
    document: {
      querySelector(selector) {
        if (selector === "#media-stage") return mediaStage;
        if (selector === "#alert-image") return image;
        if (selector === "#alert-video") return video;
        return null;
      },
    },
    io: () => socket,
    fetch: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, json: async () => ({ audio: "/alert/sounds/tts.mp3" }) };
    },
    Audio: class {
      constructor(src) {
        this.src = src;
      }
      addEventListener() {}
      play() { return Promise.resolve(); }
      pause() {}
      removeAttribute() {}
      load() {}
    },
    setTimeout,
    clearTimeout,
    console,
  };

  vm.runInNewContext(script, context);
  return { eventos, fetchCalls };
}

test("a página unificada continua processando TTS mesmo em /alert/rewards", async () => {
  const { eventos, fetchCalls } = carregarPlayer("/alert/rewards");

  eventos.alert({ tipo: "tts", texto: "Olá mundo", usuario: "Viewer" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(fetchCalls.length, 1);
  assert.match(String(fetchCalls[0][0]), /\/api\/tts\/generate/);
});
