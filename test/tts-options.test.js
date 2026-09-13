const test = require('node:test');
const assert = require('node:assert/strict');
const TTSOptionsService = require('../core/shared/service/tts-options.service.js');

test('lista de providers, idiomas e vozes do TTS tem valores válidos', () => {
  const service = new TTSOptionsService();
  const providers = service.getProviders();
  const idiomas = service.getLanguages('puter');
  const vozes = service.getVoices('puter', 'pt-BR');

  assert.ok(Array.isArray(providers) && providers.length > 0);
  assert.ok(Array.isArray(idiomas) && idiomas.includes('pt-BR'));
  assert.ok(Array.isArray(vozes) && vozes.includes('Vitoria'));
});

test('fallback normaliza valores incompatíveis para os padrões válidos', () => {
  const service = new TTSOptionsService();
  assert.equal(service.normalize('eve', 'pt-br').voice, 'Vitoria');
  assert.equal(service.normalize('eve', 'pt-br').language, 'pt-BR');
});

test('provider default do TTS usa Puter e mantém provider/language/voice no payload', () => {
  const service = new TTSOptionsService();
  const options = service.getOptions('puter', 'pt-BR');

  assert.equal(options.provider, 'puter');
  assert.equal(options.language, 'pt-BR');
  assert.ok(Array.isArray(options.voices));
  assert.ok(options.voices.includes('Vitoria'));

  const normalized = service.normalize('Vitoria', 'pt-BR', 'puter');
  assert.equal(normalized.provider, 'puter');
  assert.equal(normalized.language, 'pt-BR');
  assert.equal(normalized.voice, 'Vitoria');
});
