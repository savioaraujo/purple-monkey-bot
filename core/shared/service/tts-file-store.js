const fs = require("fs");
const path = require("path");

function listarArquivosTts(dirs) {
  const listaDiretorios = Array.isArray(dirs) ? dirs : [dirs].filter(Boolean);
  const itens = [];

  for (const dirAtual of listaDiretorios) {
    if (!dirAtual || !fs.existsSync(dirAtual)) {
      continue;
    }

    for (const nome of fs.readdirSync(dirAtual)) {
      const fullPath = path.join(dirAtual, nome);
      const stat = fs.statSync(fullPath);

      if (!stat.isFile()) {
        continue;
      }

      const extensao = path.extname(nome).toLowerCase();
      if (![".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(extensao)) {
        continue;
      }

      const metaPath = path.join(dirAtual, `${path.basename(nome, extensao)}.json`);
      let texto = "";
      let usuario = "Sistema";
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          texto = meta.texto || "";
          usuario = meta.usuario || "Sistema";
        } catch (error) {
          console.warn("[tts-file-store] meta inválida ignorada:", metaPath);
        }
      }

      const audioPublicPath = montarCaminhoPublico(fullPath, dirAtual);
      itens.push({
        id: `${dirAtual}:${nome}`,
        filePath: fullPath,
        nomeArquivo: nome,
        texto,
        usuario,
        data: new Date(stat.mtime).toISOString(),
        audio: audioPublicPath,
        dirAtual,
      });
    }
  }

  return itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

function montarCaminhoPublico(fullPath, dirAtual) {
  const dir = String(dirAtual || "").replace(/\\/g, "/");
  const nomeArquivo = encodeURIComponent(path.basename(fullPath));

  if (dir.includes("tts/generated") || dir.endsWith("tts/generated")) {
    return `/tts/generated/${nomeArquivo}`;
  }

  if (dir.includes("tts-processor/files") || dir.endsWith("tts-processor/files")) {
    return `/tts-processor/files/${nomeArquivo}`;
  }

  if (dir.includes("alert/sounds") || dir.endsWith("alert/sounds")) {
    return `/alert/sounds/${nomeArquivo}`;
  }

  const rel = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
  return rel.startsWith("..") ? `/${nomeArquivo}` : `/${rel}`;
}

function excluirArquivoTts(filePath, dirAtual) {
  const arquivo = filePath && typeof filePath === "string" ? filePath : "";
  if (!arquivo) {
    return { ok: false, removidos: 0 };
  }

  const normalizado = path.normalize(arquivo);
  const alvo = fs.existsSync(normalizado) ? normalizado : path.join(dirAtual || process.cwd(), path.basename(normalizado));

  if (fs.existsSync(alvo)) {
    fs.unlinkSync(alvo);
  }

  const metaPath = path.join(path.dirname(alvo), `${path.basename(alvo, path.extname(alvo))}.json`);
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }

  return { ok: true, removidos: 1 };
}

module.exports = {
  listarArquivosTts,
  montarCaminhoPublico,
  excluirArquivoTts,
};
