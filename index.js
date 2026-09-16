const Servidor = require("./core/shared/service/servidor.js");
const TwitchApi = require("./core/shared/service/twitch.api.js");
const PurpleMonkeyChatBot = require("./core/shared/service/purple-monkey-chat-bot.js");
const CanalDatabase = require("./core/shared/data/canal.data.js");
const TwitchOAuthService = require("./core/shared/service/twitch-oauth.service.js");
const { aplicarTokenAutorizado } = require("./core/shared/service/twitch-auth-flow.js");
const TwitchRewardsService = require("./core/shared/service/twitch-rewards.service.js");
const TTSService = require("./core/shared/service/tts.service.js");
const TTSOptionsService = require("./core/shared/service/tts-options.service.js");
const { listarArquivosTts, excluirArquivoTts } = require("./core/shared/service/tts-file-store.js");

const servidor = new Servidor(process.env.PORT || 3000);
const fs = require('fs');
const path = require('path');
const ttsGeneratedDir = path.join(__dirname, "core", "app", "tts", "generated");
const ttsProcessorDir = path.join(__dirname, "core", "app", "tts-processor", "files");
const alertSoundsDir = path.join(__dirname, "core", "app", "alert", "sounds");
if (!fs.existsSync(ttsGeneratedDir)) {
  fs.mkdirSync(ttsGeneratedDir, { recursive: true });
}
if (!fs.existsSync(ttsProcessorDir)) {
  fs.mkdirSync(ttsProcessorDir, { recursive: true });
}
const ttsService = new TTSService();
const ttsOptionsService = new TTSOptionsService();
const canalDatabase = new CanalDatabase();
const twitchOAuthService = new TwitchOAuthService(canalDatabase);
let chatBot;
const twitchRewardsService = new TwitchRewardsService(canalDatabase, servidor);

servidor.registrarApp("/alert", __dirname + "/core/app/alert/index.html");
servidor.registrarApp("/alert/rewards", __dirname + "/core/app/alert/index.html");
servidor.registrarApp("/tts", __dirname + "/core/app/tts-processor/index.html");
servidor.registrarApp("/tts-processor", __dirname + "/core/app/tts-processor/index.html");
servidor.registrarApp("/config", __dirname + "/core/app/config/index.html");
// Tela MVC para CRUD de comandos de texto simples
servidor.registrarApp("/config/text-commands", __dirname + "/core/app/config/text-commands/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/config/text-commands", "/config/text-commands");
// Tela MVC para CRUD de comandos de audio
servidor.registrarApp("/config/audio-commands", __dirname + "/core/app/config/audio-commands/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/config/audio-commands", "/config/audio-commands");
servidor.registrarApp("/config/triggers", __dirname + "/core/app/config/triggers/index.html");
servidor.registrarApp("/config/roletas", __dirname + "/core/app/config/roletas/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/alert", "/alert");
servidor.registrarConteudoPublico(alertSoundsDir, "/alert/sounds");
servidor.registrarConteudoPublico(ttsGeneratedDir, "/tts/generated");
servidor.registrarConteudoPublico(ttsProcessorDir, "/tts-processor/files");
servidor.registrarApp("/config/rewards", __dirname + "/core/app/config/rewards/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/config/rewards", "/config/rewards");
servidor.registrarApp("/config/overlay", __dirname + "/core/app/config/overlay/index.html");

servidor.registrarGet("/api/config", (req, res) => {
  res.json(canalDatabase.getConfig());
});

servidor.registrarGet("/api/tts/options", (req, res) => {
  try {
    const provider = req.query.provider || "puter";
    const language = req.query.language || "pt-BR";
    const query = String(req.query.q || '').trim().toLowerCase();
    const options = ttsOptionsService.getOptions(provider, language);
    if (String(provider).toLowerCase() === 'puter') {
      const catalogo = servidor.getTtsCatalogoPuter();
      const vozesCatalogo = catalogo.voices || [];
      if (vozesCatalogo.length) {
        const puterProvider = String(req.query.puterProvider || req.query.puter_provider || 'aws-polly');
        const model = String(req.query.model || '');
        const vozesProvider = vozesCatalogo.filter(v => (v.provider || 'aws-polly') === puterProvider && (!model || !(v.supported_models || v.supported_engines) || (v.supported_models || v.supported_engines).includes(model)));
        const idiomas = [...new Set(vozesProvider.map(v => v.language && v.language.code).filter(Boolean))].sort();
        const idiomaSelecionado = idiomas.includes(language) ? language : (idiomas[0] || language);
        options.languages = idiomas;
        options.language = idiomaSelecionado;
        options.puterProviders = [...new Set(vozesCatalogo.map(v => v.provider || 'aws-polly'))].sort();
        options.models = (catalogo.engines || []).filter(e => e.provider === puterProvider).map(e => ({ value: e.id, label: e.name || e.id }));
        options.voiceOptions = vozesProvider.filter(v => !v.language || v.language.code === idiomaSelecionado).map(v => ({ value: v.id, label: v.name || v.id, provider: v.provider || puterProvider }));
        options.voices = options.voiceOptions.map(v => v.label);
      }
    }
    if (query) options.voices = options.voices.filter((voice) => String(voice).toLowerCase().includes(query));
    res.json(options);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

servidor.registrarGet("/api/tts/fila", (req, res) => {
  try {
    const itens = listarArquivosTts([ttsGeneratedDir, ttsProcessorDir]);
    res.json({ itens: itens.map((item) => ({
      ...item,
      data: new Date(item.data).toLocaleString(),
    })) });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

servidor.registrarPost("/api/tts/save", async (req, res) => {
  try {
    const body = req.body || {};
    const nomeArquivo = String(body.nomeArquivo || `tts-${Date.now()}.mp3`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const texto = String(body.texto || "");
    const usuario = String(body.usuario || "Sistema");
    const audio = String(body.audio || "");
    const audioData = body.audioData || "";

    const filePath = path.join(ttsGeneratedDir, nomeArquivo);
    const metaPath = path.join(ttsGeneratedDir, `${path.basename(nomeArquivo, path.extname(nomeArquivo))}.json`);

    if (audioData) {
      const base64 = String(audioData).replace(/^data:audio\/[^;]+;base64,/, "").replace(/^data:audio\/[^;]+,/, "");
      const buffer = Buffer.from(base64, "base64");
      fs.writeFileSync(filePath, buffer);
    } else if (audio && /^https?:\/\//i.test(audio)) {
      const resposta = await fetch(audio);
      const buffer = Buffer.from(await resposta.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
    } else if (audio && /^data:audio\//i.test(audio)) {
      const base64 = String(audio).replace(/^data:audio\/[^;]+;base64,/, "").replace(/^data:audio\/[^;]+,/, "");
      const buffer = Buffer.from(base64, "base64");
      fs.writeFileSync(filePath, buffer);
    }

    fs.writeFileSync(metaPath, JSON.stringify({ texto, usuario, nomeArquivo, data: new Date().toISOString() }, null, 2));
    res.json({ ok: true, audio: `/tts/generated/${encodeURIComponent(nomeArquivo)}`, filePath });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

servidor.registrarDelete("/api/tts/clear", (req, res) => {
  try {
    const diretorios = [ttsGeneratedDir, ttsProcessorDir];
    let removidos = 0;

    for (const diretorio of diretorios) {
      if (!fs.existsSync(diretorio)) {
        continue;
      }

      for (const nome of fs.readdirSync(diretorio)) {
        const fullPath = path.join(diretorio, nome);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          fs.unlinkSync(fullPath);
          removidos += 1;
        }
      }
    }

    res.json({ ok: true, removidos });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

servidor.registrarDelete("/api/tts/clear/:filePath", (req, res) => {
  try {
    const nome = decodeURIComponent(req.params.filePath || "");
    if (!nome) {
      return res.status(400).json({ erro: "arquivo e obrigatorio" });
    }

    const fullPath = path.normalize(nome);
    const dirBase = fs.existsSync(fullPath) ? path.dirname(fullPath) : ttsProcessorDir;
    const finalPath = path.join(dirBase, path.basename(fullPath));
    const resultado = excluirArquivoTts(finalPath, dirBase);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

servidor.registrarPost("/api/tts/generate", async (req, res) => {
  try {
    const { texto, voz, language } = req.body || {};
    const valor = String(texto || "").trim();

    if (!valor) {
      return res.status(400).json({ erro: "texto e obrigatorio" });
    }

    const arquivo = await ttsService.gerarAudio(valor, voz, language);
    if (!arquivo) {
      return res.status(500).json({ erro: "Falha ao gerar audio local do TTS." });
    }

    res.json({
      audio: arquivo,
      texto: valor,
      voz: voz || null,
      language: language || null,
    });
  } catch (error) {
    console.error("Erro ao gerar TTS via endpoint:", error);
    res.status(500).json({ erro: error.message || "Erro ao gerar TTS." });
  }
});

servidor.registrarGet("/api/bot/status", (req, res) => {
  if (!chatBot) {
    return res.json({
      conectado: false,
      status: "inicializando",
      ultimoErro: null,
      username: "purplemonkeybot",
      canais: [],
    });
  }

  res.json(chatBot.getStatusResumo());
});

servidor.registrarPost("/api/bot/reconnect", async (req, res) => {
  try {
    if (!chatBot) {
      return res.status(503).json({ erro: "Bot ainda não inicializado." });
    }

    const configAtual = canalDatabase.getConfig();
    const token = (configAtual.twitch && configAtual.twitch.userAccessToken) || "";
    if (!token) {
      return res.status(400).json({ erro: "Nenhum token de acesso salvo. Conecte o bot via OAuth primeiro." });
    }

    chatBot.atualizarCanais(canalDatabase.getCanais());
    const status = await chatBot.reconectar(servidor, token);
    res.json(status);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

servidor.registrarPost("/api/config", async (req, res) => {
  try {
    const configSalva = canalDatabase.salvarConfig(req.body);
    if (chatBot) {
      chatBot.atualizarCanais(canalDatabase.getCanais());
      await aplicarTokenAutorizado(chatBot, configSalva.twitch, servidor);
    }
    twitchRewardsService.reiniciar();
    res.json(configSalva);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

servidor.registrarGet("/auth/twitch/url", (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    res.json({
      url: twitchOAuthService.criarUrlAutorizacao(baseUrl, { forceVerify: req.query.force_verify === "true" }),
      status: twitchOAuthService.getStatus(baseUrl),
    });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

servidor.registrarGet("/auth/twitch/status", (req, res) => {
  try {
    res.json(twitchOAuthService.getStatus(getBaseUrl(req)));
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

servidor.registrarGet("/auth/twitch", (req, res) => {
  try {
    res.redirect(twitchOAuthService.criarUrlAutorizacao(getBaseUrl(req)));
  } catch (error) {
    res.status(400).send(error.message);
  }
});

servidor.registrarGet("/auth/twitch/callback", async (req, res) => {
  try {
    const configSalva = await twitchOAuthService.concluirAutorizacao(
      req.query,
      getBaseUrl(req)
    );
    if (chatBot) {
      await aplicarTokenAutorizado(chatBot, configSalva.twitch, servidor);
    }
    twitchRewardsService.reiniciar();

    res.send(
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Twitch conectada</title></head><body><h1>Twitch conectada</h1><p>Token do bot salvo com sucesso. Você já pode fechar esta aba.</p><p><a href=\"/config\">Voltar para a configuração</a></p></body></html>"
    );
  } catch (error) {
    console.error("Erro OAuth Twitch:", error);
    res
      .status(400)
      .send(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Erro Twitch</title></head><body><h1>Erro ao conectar Twitch</h1><p>" +
          escapeHtml(error.message) +
          "</p><p><a href=\"/config\">Voltar para a configuração</a></p></body></html>"
      );
  }
});

servidor.registrarGet("/api/rewards/status", (req, res) => {
  res.json(twitchRewardsService.getStatus());
});

servidor.registrarGet("/api/rewards/logs", (req, res) => {
  res.json(twitchRewardsService.getLogs());
});

servidor.registrarPost("/api/rewards/create", async (req, res) => {
  try {
    const recompensa = await twitchRewardsService.criarRecompensa(req.body || {});
    res.json(recompensa);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

servidor.registrarPost("/api/rewards/sync", async (req, res) => {
  try {
    res.json(await twitchRewardsService.salvarRecompensa(req.body || {}));
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

servidor.registrarPost("/api/rewards/delete", async (req, res) => {
  try {
    await twitchRewardsService.excluirRecompensa(req.body && req.body.rewardId);
    res.json({ sucesso: true });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

// Upload simples: espera JSON { filename, data } onde data é base64 (sem data:... prefix)
servidor.registrarPost('/api/upload', async (req, res) => {
  try {
    const body = req.body || {};
    const filename = body.filename;
    const data = body.data;
    if (!filename || !data) {
      return res.status(400).json({ erro: 'filename e data sao obrigatorios' });
    }

    const soundsDir = path.join(__dirname, 'core', 'app', 'alert', 'sounds');
    if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = path.join(soundsDir, safeName);
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(fullPath, buffer);

    const publicPath = '/alert/sounds/' + encodeURIComponent(safeName);
    res.json({ path: publicPath });
  } catch (error) {
    console.error('Erro upload:', error);
    res.status(500).json({ erro: error.message });
  }
});

servidor.start();

const canais = canalDatabase.getCanais();
const configInicial = canalDatabase.getConfig();
const senhaBot = (configInicial.twitch && configInicial.twitch.userAccessToken) || "";

try {
  chatBot = new PurpleMonkeyChatBot(
    "purplemonkeybot",
    senhaBot,
    canais,
    configInicial.twitch
  );

  chatBot.start(servidor);
  twitchRewardsService.iniciar();
} catch (error) {
  console.error("Erro ao iniciar o bot:", error);
  chatBot = null;
}

function getBaseUrl(req) {
  return req.protocol + "://" + req.get("host");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
