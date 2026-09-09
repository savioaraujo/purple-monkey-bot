async function aplicarTokenAutorizado(chatBot, twitchConfig, servidor) {
  if (!chatBot) {
    return null;
  }

  if (chatBot.atualizarConfigTwitch) {
    chatBot.atualizarConfigTwitch(twitchConfig);
  }

  if (typeof chatBot.atualizarTokenChat === 'function') {
    return chatBot.atualizarTokenChat(
      twitchConfig && twitchConfig.userAccessToken,
      servidor
    );
  }

  return null;
}

module.exports = {
  aplicarTokenAutorizado,
};
