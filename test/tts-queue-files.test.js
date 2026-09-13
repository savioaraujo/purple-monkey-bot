const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { listarArquivosTts, excluirArquivoTts } = require("../core/shared/service/tts-file-store.js");

test("lista arquivos de áudio gerados em pastas distintas e preserva metadados", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-queue-"));
  const dirProcessador = path.join(baseDir, "tts-processor", "files");
  const dirAlert = path.join(baseDir, "alert", "sounds");

  fs.mkdirSync(dirProcessador, { recursive: true });
  fs.mkdirSync(dirAlert, { recursive: true });

  const processoPath = path.join(dirProcessador, "processado.mp3");
  const localPath = path.join(dirAlert, "local.wav");

  fs.writeFileSync(processoPath, "processado");
  fs.writeFileSync(localPath, "local");

  fs.writeFileSync(path.join(dirProcessador, "processado.json"), JSON.stringify({ texto: "Olá do processador", usuario: "viewer" }));
  fs.writeFileSync(path.join(dirAlert, "local.json"), JSON.stringify({ texto: "Olá do alerta", usuario: "mod" }));

  const itens = listarArquivosTts([dirProcessador, dirAlert]);

  assert.equal(itens.length, 2);
  assert.ok(itens.some((item) => item.filePath === processoPath && item.texto === "Olá do processador"));
  assert.ok(itens.some((item) => item.audio === "/alert/sounds/local.wav" && item.usuario === "mod"));
});

test("remove o arquivo físico e o metadata ao excluir um item da fila", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-delete-"));
  const dir = path.join(baseDir, "tts-processor", "files");
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, "para-remover.mp3");
  fs.writeFileSync(filePath, "arquivo");
  fs.writeFileSync(path.join(dir, "para-remover.json"), JSON.stringify({ texto: "remover" }));

  excluirArquivoTts(filePath, dir);

  assert.equal(fs.existsSync(filePath), false);
  assert.equal(fs.existsSync(path.join(dir, "para-remover.json")), false);
});
