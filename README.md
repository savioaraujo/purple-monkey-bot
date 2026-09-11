# Purple Monkey Bot

> Bot para Twitch: responde comandos de chat, gera TTS e dispara alertas na UI.

## Instalação

1. Instale dependências:

```bash
npm install
```

1. Configure canais e comandos em `core/config/canais.config.json` e ajuste tokens OAuth conforme necessário.

## Execução

- Iniciar com:

```bash
npm start
```

- Alternativamente:

```bash
node index.js
```

## Arquivos importantes

- `index.js` — ponto de entrada.
- `config/canais.config.json` — defina canais e comandos.
- `core/shared/service/purple-monkey-chat-bot.js` — lógica do bot e execução de comandos.
- `core/shared/service/tts.service.js` — geração de TTS.
- `core/app/alert/` — UI de alertas e sons.
- `core/app/config/rewards/` — cadastro de recompensas por pontos com imagem, GIF ou vídeo e áudio.

## Comandos TTS

- `tipo: "tts"` — comando configurado no `canais.config.json` que envia o texto configurado para o layer; exemplo:

```json
{
  "tipo": "tts",
  "comando": "!exemplo-tts",
  "resposta": "Olá, essa mensagem será falada pela camada de TTS.",
  "options": {
    "provider": "xai",
    "model": "gpt-4o-mini-tts",
    "voice": "Vitoria",
    "language": "pt-br",
    "instructions": "Fale de forma clara e em tom amigável."
  }
}
```

- `tipo: "chat-tts"` — permite que usuários do chat usem `!tts <texto>` ou `!tts-<voz> <texto>` para pedir leitura via IA (vozes opcionais). O texto é enviado ao layer via socket com `tipo: "tts"`.
- Tanto `tipo: "tts"` quanto `tipo: "chat-tts"` aceitam `options` com `provider`, `model`, `voice`, `language` e `instructions`.
- Valores padrões aplicados quando não informados: `{ provider: "xai", voice: "eve", language: "pt-br" }`.

### TTS gratuito com Puter.js

- A interface de alertas (`/alert`) usa Puter.js no cliente para converter texto em fala gratuitamente usando `puter.ai.txt2speech` quando disponível. Não é necessário chave de API.
- Se Puter não estiver disponível, a UI usa a Web Speech API do navegador como fallback.

## Configuração rápida

- O token Twitch deve estar no formato `oauth:xxxxx`. O bot aplica `oauth:` automaticamente se faltar.
- Para recompensas por pontos, autentique a conta do próprio broadcaster em `/config`, use **Renovar token** para consentir os escopos `channel:read:redemptions` e `channel:manage:redemptions`, e cadastre/crie a recompensa na opção **Recompensas por pontos**. O overlay `/alert` recebe os resgates via EventSub WebSocket, sem exigir webhook público.
- Use `/alert/rewards` como fonte de navegador no OBS para reproduzir somente os alertas de recompensas, em fila, com imagem/GIF/vídeo e áudio simultâneos. A rota `/alert` continua sendo o player unificado de áudio, TTS e recompensas.

## Próximos passos

- Verificar `core/config/canais.config.json` e adicionar canais.
- Ajustar tokens em seu ambiente ou no arquivo de configuração do bot.

