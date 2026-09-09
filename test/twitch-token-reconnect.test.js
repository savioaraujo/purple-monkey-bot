const test = require('node:test');
const assert = require('node:assert/strict');
const { aplicarTokenAutorizado } = require('../core/shared/service/twitch-auth-flow.js');

test('aplicarTokenAutorizado atualiza o token do bot e dispara reconexão', async () => {
  const eventos = [];
  const chatBot = {
    atualizarConfigTwitch(configTwitch) {
      eventos.push(['config', configTwitch]);
    },
    async atualizarTokenChat(userAccessToken, servidor) {
      eventos.push(['token', userAccessToken, servidor]);
      return { ok: true };
    },
  };

  const servidor = { id: 'srv' };
  const twitchConfig = { userAccessToken: 'novo-token' };

  const resultado = await aplicarTokenAutorizado(chatBot, twitchConfig, servidor);

  assert.deepEqual(eventos, [
    ['config', twitchConfig],
    ['token', 'novo-token', servidor],
  ]);
  assert.deepEqual(resultado, { ok: true });
});
