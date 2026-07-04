const Servidor = require("./core/shared/service/servidor.js");
const TwitchApi = require("./core/shared/service/twitch.api.js");
const PurpleMonkeyChatBot = require("./core/shared/service/purple-monkey-chat-bot.js");
const CanalDatabase = require("./core/shared/data/canal.data.js");
const TwitchOAuthService = require("./core/shared/service/twitch-oauth.service.js");

const servidor = new Servidor(3000);
const canalDatabase = new CanalDatabase();
const twitchOAuthService = new TwitchOAuthService(canalDatabase);
let chatBot;

servidor.registrarApp("/alert", __dirname + "/core/app/alert/index.html");
servidor.registrarApp("/tts", __dirname + "/core/app/tts/index.html");
servidor.registrarApp("/config", __dirname + "/core/app/config/index.html");
servidor.registrarConteudoPublico(__dirname + "/core/app/alert", "/alert");
servidor.registrarConteudoPublico(__dirname + "/core/app/alert/sounds/");

servidor.registrarGet("/api/config", (req, res) => {
  res.json(canalDatabase.getConfig());
});

servidor.registrarPost("/api/config", async (req, res) => {
  try {
    const configSalva = canalDatabase.salvarConfig(req.body);
    if (chatBot) {
      chatBot.atualizarCanais(canalDatabase.getCanais());
      chatBot.atualizarConfigTwitch(configSalva.twitch);
      await chatBot.atualizarTokenChat(configSalva.twitch.userAccessToken, servidor);
    }
    res.json(configSalva);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

servidor.registrarGet("/auth/twitch/url", (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    res.json({
      url: twitchOAuthService.criarUrlAutorizacao(baseUrl),
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
      chatBot.atualizarConfigTwitch(configSalva.twitch);
      await chatBot.atualizarTokenChat(configSalva.twitch.userAccessToken, servidor);
    }

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

servidor.start();

const canais = canalDatabase.getCanais();
const configInicial = canalDatabase.getConfig();

chatBot = new PurpleMonkeyChatBot(
  "purplemonkeybot",
  configInicial.twitch.userAccessToken || "oauth:xuaovdy1ois22qgq75anpx1lj0rz2p",
  canais,
  configInicial.twitch
);

chatBot.start(servidor);

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
