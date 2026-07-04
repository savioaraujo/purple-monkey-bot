const test = require('node:test');
const assert = require('node:assert/strict');
const PurpleMonkeyChatBot = require('../core/shared/service/purple-monkey-chat-bot.js');

test('resolve macros de lista configurável em respostas', async () => {
  const canal = {
    nome: '#teste',
    comandos: [],
    listas: [{ nome: 'Animais', valores: ['cachorro', 'gato'] }],
  };

  const bot = new PurpleMonkeyChatBot('bot', 'oauth:test', [canal], {});
  const macros = await bot.criarMacrosContexto(
    '#teste',
    { username: 'usuario', 'display-name': 'Usuário' },
    'ola',
    'Eu gosto de {{random_pick_animais}}',
    canal
  );
  const resposta = await bot.formatarMensagemResposta(
    'Eu gosto de {{random_pick_animais}}',
    macros
  );

  assert.match(resposta, /^Eu gosto de (cachorro|gato)$/);
});
