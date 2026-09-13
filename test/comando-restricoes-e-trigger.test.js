const test = require('node:test');
const assert = require('node:assert/strict');
const ComandoFactory = require('../core/shared/factory/comando.factory.js');

const factory = new ComandoFactory();

test('comando respeita restrição por usuário e cargo', () => {
  const comando = factory.criar({
    tipo: 'texto-simples',
    comando: '!vip',
    resposta: 'ok',
    restricoes: {
      usuarios: ['alice'],
      cargos: ['moderador', 'vip'],
    },
  });

  assert.equal(comando.podeExecutar({ username: 'alice' }), true);
  assert.equal(comando.podeExecutar({ username: 'bob' }), false);
  assert.equal(
    comando.podeExecutar({ username: 'charlie', badges: { vip: '1' } }),
    true
  );
  assert.equal(
    comando.podeExecutar({ username: 'charlie', badges: { moderator: '1' } }),
    true
  );
});

test('trigger de primeira mensagem dispara apenas para usuário configurado', () => {
  const comando = factory.criar({
    tipo: 'texto-simples',
    comando: '!bemvindo',
    resposta: 'bem-vindo',
    trigger: {
      tipo: 'primeira-mensagem',
      usuario: 'alice',
    },
  });

  assert.equal(
    comando.temTriggerAtivo({ username: 'alice' }, { primeiraMensagem: true }),
    true
  );
  assert.equal(
    comando.temTriggerAtivo({ username: 'bob' }, { primeiraMensagem: true }),
    false
  );
  assert.equal(
    comando.temTriggerAtivo({ username: 'alice' }, { primeiraMensagem: false }),
    false
  );
});

test('trigger considera a primeira mensagem do dia do usuário', () => {
  const bot = new (require('../core/shared/service/purple-monkey-chat-bot.js'))(
    'bot',
    'oauth:test',
    [{ nome: '#teste', comandos: [], listas: [] }],
    {}
  );

  const hoje = new Date().toISOString().slice(0, 10);
  bot.primeirasMensagensPorDia.set(`teste:alice:${hoje}`, true);
  assert.equal(bot.isPrimeiraMensagemDoDia('#teste', 'alice'), false);

  bot.primeirasMensagensPorDia.clear();
  assert.equal(bot.isPrimeiraMensagemDoDia('#teste', 'alice'), true);
});

test('tts usa a voz histórica Vitoria como padrão para evitar erro no processor', () => {
  const tts = factory.criar({
    tipo: 'tts',
    comando: '!tts',
    resposta: 'Olá',
  });

  const chatTts = factory.criar({
    tipo: 'chat-tts',
    options: {},
  });

  assert.equal(tts.options.voice, 'Vitoria');
  assert.equal(chatTts.options.voice, 'Vitoria');
});

test('trigger de primeira mensagem do dia executa comando de áudio mesmo sem matched no texto', () => {
  const bot = new (require('../core/shared/service/purple-monkey-chat-bot.js'))(
    'bot',
    'oauth:test',
    [{ nome: '#balderking', comandos: [], listas: [] }],
    {}
  );

  const comando = factory.criar({
    tipo: 'audio',
    comando: '!boasvindas',
    audio: 'boasvindas.mp3',
    trigger: {
      tipo: 'primeira-mensagem',
      usuario: 'balderking',
    },
  });

  assert.equal(
    bot.deveExecutarComando(comando, 'qualquer mensagem do usuario', { username: 'balderking' }, { primeiraMensagemDoDia: true }),
    true
  );
  assert.equal(
    bot.deveExecutarComando(comando, 'qualquer mensagem do usuario', { username: 'alice' }, { primeiraMensagemDoDia: true }),
    false
  );
});
