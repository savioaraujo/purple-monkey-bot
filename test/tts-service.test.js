const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const say = require("say");
const TTSService = require("../core/shared/service/tts.service.js");

test("gera audio em mp3 quando a conversao local estiver disponivel", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-service-"));
  const service = new TTSService();
  service.dirSaida = dir;

  const originalExport = say.export;
  say.export = (texto, voz, velocidade, destino, callback) => {
    fs.writeFileSync(destino, "fake-wav");
    callback(null);
  };

  service.converterParaMp3SeDisponivel = async (arquivoOriginal) => {
    const saida = path.join(dir, "resultado.mp3");
    fs.writeFileSync(saida, "fake-mp3");
    fs.unlinkSync(arquivoOriginal);
    return saida;
  };

  try {
    const resultado = await service.gerarAudio("Teste de conversao", "Microsoft Maria Desktop", "pt-BR");
    assert.match(resultado, /\.mp3$/);
    assert.equal(fs.existsSync(path.join(dir, "resultado.mp3")), true);
  } finally {
    say.export = originalExport;
  }
});

test("usa a voz padrao do sistema quando a voz configurada nao existe", () => {
  const service = new TTSService();
  assert.equal(service.resolverVoz("Voz que nao existe", "pt-BR"), null);
  assert.equal(service.resolverVoz("Microsoft Maria Desktop", "pt-BR"), "Microsoft Maria Desktop");
  assert.equal(service.resolverVoz("", "pt-BR"), null);
});
