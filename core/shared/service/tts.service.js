const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const say = require("say");

class TTSService {
  constructor() {
    this.dirSaida = path.join(__dirname, "../../app/tts/generated");
    fs.mkdirSync(this.dirSaida, { recursive: true });
  }

  // mensagem: texto a falar
  // voz: nome/valor de voz local do sistema (opcional)
  // language: código de idioma, ex: 'pt-BR' (opcional)
  async gerarAudio(mensagem, voz, language) {
    const texto = String(mensagem || "").trim();
    if (!texto) {
      return "";
    }

    const nomeArquivo = `tts-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`;
    const caminhoArquivo = path.join(this.dirSaida, nomeArquivo);
    const nomeVoz = this.resolverVoz(voz, language);

    try {
      if (typeof say.export !== "function") {
        throw new Error("say.export não está disponível neste ambiente.");
      }

      await new Promise((resolve, reject) => {
        say.export(texto, nomeVoz || null, 1, caminhoArquivo, (erro) => {
          if (erro) {
            reject(erro);
            return;
          }
          resolve();
        });
      });

      const caminhoFinal = await this.converterParaMp3SeDisponivel(caminhoArquivo);
      const caminhoPublico = this.toPublicPath(caminhoFinal);
      console.log(`[tts-local] Áudio gerado localmente em ${caminhoPublico}`);
      return caminhoPublico;
    } catch (error) {
      console.error("[tts-local] Falha ao gerar TTS local:", error.message || error);
      return "";
    }
  }

  async converterParaMp3SeDisponivel(caminhoArquivo) {
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
    const extensao = path.extname(caminhoArquivo).toLowerCase();

    if (extensao === ".mp3") {
      return caminhoArquivo;
    }

    const caminhoMp3 = caminhoArquivo.replace(/\.wav$/i, ".mp3");

    try {
      await new Promise((resolve, reject) => {
        execFile(
          ffmpegPath,
          [
            "-y",
            "-i",
            caminhoArquivo,
            "-vn",
            "-ar",
            "44100",
            "-ac",
            "2",
            caminhoMp3,
          ],
          (erro) => {
            if (erro) {
              reject(erro);
              return;
            }
            resolve();
          }
        );
      });

      if (fs.existsSync(caminhoMp3)) {
        fs.unlinkSync(caminhoArquivo);
        return caminhoMp3;
      }
    } catch (error) {
      console.warn("[tts-local] ffmpeg não disponível ou conversão falhou; mantendo WAV.", error.message || error);
    }

    return caminhoArquivo;
  }

  toPublicPath(caminhoArquivo) {
    const nomeArquivo = path.basename(caminhoArquivo);
    return `/tts/generated/${nomeArquivo}`;
  }

  resolverVoz(voz, language) {
    const valor = String(voz || "").trim();
    if (valor) {
      const vozNormalizada = valor.toLowerCase();
      const vozesConhecidas = [
        "microsoft maria desktop",
        "microsoft zira desktop",
        "microsoft david desktop",
        "microsoft joana desktop",
        "microsoft heather desktop",
        "microsoft aria desktop",
        "microsoft guy desktop",
      ];

      if (vozesConhecidas.includes(vozNormalizada)) {
        return valor;
      }

      console.warn(`[tts-local] Voz configurada não está disponível no sistema: "${valor}". Usando a voz padrão do Windows.`);
      return null;
    }

    const idioma = String(language || "").toLowerCase();
    if (idioma.includes("pt")) {
      return null;
    }

    return null;
  }
}

module.exports = TTSService;
