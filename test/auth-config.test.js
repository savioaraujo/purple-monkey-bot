const test = require('node:test');
const assert = require('node:assert/strict');
const { resolverSenhaBot } = require('../core/shared/service/bot-auth.utils.js');

test('usa o token de acesso do Twitch em vez do client secret para autenticar o bot', () => {
  const twitchConfig = {
    userAccessToken: 'oauth:token-valido',
    clientSecret: 'segredo-nao-deve-ser-usado-como-senha',
  };

  assert.equal(resolverSenhaBot(twitchConfig), 'oauth:token-valido');
});

test('retorna vazio quando não há token de acesso salvo', () => {
  assert.equal(resolverSenhaBot({ clientSecret: 'segredo' }), '');
});
