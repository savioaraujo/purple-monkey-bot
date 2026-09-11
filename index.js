const Servidor = require("./core/shared/service/servidor.js");
const TwitchApi = require("./core/shared/service/twitch.api.js");
const PurpleMonkeyChatBot = require("./core/shared/service/purple-monkey-chat-bot.js");
const CanalDatabase = require("./core/shared/data/canal.data.js");
const TwitchOAuthService = require("./core/shared/service/twitch-oauth.service.js");
const { aplicarTokenAutorizado } = require("./core/shared/service/twitch-auth-flow.js");
const TwitchRewardsService = require("./core/shared/service/twitch-rewards.service.js");

const servidor = new Servidor(process.env.PORT || 3000);
const fs = require('fs');
const path = require('path');
const canalDatabase = new CanalDatabase();
const twitchOAuthService = new TwitchOAuthService(canalDatabase);
let chatBot;
const twitchRewardsService = new TwitchRewardsService(canalDatabase, servidor);

servidor.registrarApp("/alert", __dirname + "/core/app/alert/index.html");
servidor.registrarApp("/alert/rewards", __dirname + "/core/app/alert/index.html");
servidor.registrarApp("/tts", __dirname + "/core/app/tts/index.html");
servidor.registrarApp("/config", __dirname + "/core/app/config/index.html");
// Tela MVC para CRUD de comandos de texto simples
servidor.registrarApp("/config/text-commands", __dirname + "/core/app/config/text-commands/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/config/text-commands", "/config/text-commands");
// Tela MVC para CRUD de comandos de audio
servidor.registrarApp("/config/audio-commands", __dirname + "/core/app/config/audio-commands/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/config/audio-commands", "/config/audio-commands");
servidor.registrarConteudoPublico(__dirname + "/core/app/alert", "/alert");
servidor.registrarConteudoPublico(__dirname + "/core/app/alert/sounds/");
servidor.registrarApp("/config/rewards", __dirname + "/core/app/config/rewards/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/config/rewards", "/config/rewards");

servidor.registrarGet("/api/config", (req, res) => {
  res.json(canalDatabase.getConfig());
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
