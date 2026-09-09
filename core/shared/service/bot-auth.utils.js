function resolverSenhaBot(twitchConfig) {
  const token = (twitchConfig && twitchConfig.userAccessToken) || '';
  if (!token) {
    return '';
  }

  return token.startsWith('oauth:') ? token : `oauth:${token}`;
}

module.exports = { resolverSenhaBot };
