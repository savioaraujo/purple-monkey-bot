(function () {
  const socket = io();
  const fila = [];
  const statusDot = document.querySelector("#status-dot");
  const statusTitle = document.querySelector("#status-title");
  const statusDetail = document.querySelector("#status-detail");

  let tocando = false;
  let audioAtual = null;

  socket.on("connect", () => {
    atualizarStatus("Aguardando áudio", "Fila vazia", "idle");
  });

  socket.on("disconnect", () => {
    atualizarStatus("Socket desconectado", "Tentando reconectar...", "error");
  });

  socket.on("alert", (payload) => {
    if (payload && payload.tipo === "tts") {
      adicionarNaFilaTTS(payload);
    } else {
      adicionarNaFila(payload);
    }
  });

  function adicionarNaFila(payload) {
    const audio = extrairAudio(payload);

    if (!audio) {
      return;
    }

    const metadados = typeof payload === "object" && payload ? payload : {};

    fila.push({ tipo: "audio", audio: normalizarAudio(audio), comando: metadados.comando, usuario: metadados.usuario });
    atualizarDetalheFila();
    tocarProximo();
  }

  function adicionarNaFilaTTS(payload) {
    const metadados = typeof payload === "object" && payload ? payload : {};
    const texto = metadados.texto || "";
    if (!texto) return;
    fila.push({
      tipo: "tts",
      texto: texto,
      options: metadados.options || {},
      comando: metadados.comando,
      usuario: metadados.usuario,
    });
    atualizarDetalheFila();
    tocarProximo();
  }

  async function tocarProximo() {
    if (tocando || fila.length === 0) {
      return;
    }

    tocando = true;
    const item = fila.shift();
    if (item.tipo === "audio") {
      const audioPath = item.audio;
      audioAtual = new Audio(audioPath);
      audioAtual.preload = "auto";

      atualizarStatus(
        "Reproduzindo áudio",
        nomeArquivo(audioPath) + " - " + fila.length + " na fila",
        "playing"
      );

      audioAtual.addEventListener("ended", finalizarAudioAtual);
      audioAtual.addEventListener("error", () => {
        console.error("Erro ao reproduzir audio:", audioPath);
        atualizarStatus("Erro no áudio", nomeArquivo(audioPath), "error");
        finalizarAudioAtual();
      });

      const playPromise = audioAtual.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
          console.error("Audio bloqueado pelo navegador:", error);
          atualizarStatus("Áudio bloqueado", "Interaja com a página e tente novamente.", "error");
          finalizarAudioAtual();
        });
      }
    } else if (item.tipo === "tts") {
      const texto = item.texto;
      const options = Object.assign(
        {
          provider: "xai",
          voice: "eve",
          language: "pt-br",
        },
        item.options || {}
      );
      atualizarStatus("Reproduzindo TTS", texto + " - " + fila.length + " na fila", "playing");

      // Preferir Puter.js if disponível (cliente gratuito)
      if (window.puter && puter.ai && typeof puter.ai.txt2speech === "function") {
        try {
          const audioObj = await puter.ai.txt2speech(texto, options);
          // audioObj deve ser um elemento de áudio compatível
          audioAtual = audioObj;
          if (audioAtual && typeof audioAtual.addEventListener === "function") {
            audioAtual.addEventListener("ended", finalizarAudioAtual);
            audioAtual.addEventListener("error", (e) => {
              console.error("Erro no audio Puter:", e);
              atualizarStatus("Erro no TTS", "Erro ao reproduzir áudio Puter", "error");
              finalizarAudioAtual();
            });
          }
          const playResult = audioAtual && typeof audioAtual.play === "function" ? audioAtual.play() : null;
          if (playResult && typeof playResult.then === "function") {
            await playResult;
          }
          // Se play não retornar Promise, onend cuidará de finalizar
        } catch (e) {
          console.error("Puter.txt2speech falhou:", e);
          // fallback para speechSynthesis
          speakWithWebAPI(texto, options);
        }
      } else {
        // Fallback: usar Web Speech API
        speakWithWebAPI(texto, options);
      }
    }
  }

  function speakWithWebAPI(texto, options) {
    const utter = new SpeechSynthesisUtterance(texto);
    if (options && options.language) {
      utter.lang = options.language;
    }
    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      if (options && options.voice) {
        const match = voices.find((v) => v.name.toLowerCase().includes(options.voice.toLowerCase()));
        if (match) utter.voice = match;
      }
      utter.onend = finalizarAudioAtual;
      utter.onerror = (e) => {
        console.error("Erro ao sintetizar voz:", e);
        atualizarStatus("Erro no TTS", e.message || "", "error");
        finalizarAudioAtual();
      };
      window.speechSynthesis.speak(utter);
      audioAtual = utter;
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoiceAndSpeak();
      };
    } else {
      setVoiceAndSpeak();
    }
  }

  function finalizarAudioAtual() {
    if (audioAtual) {
      audioAtual.pause();
      audioAtual.removeAttribute("src");
      audioAtual.load();
      audioAtual = null;
    }

    tocando = false;

    if (fila.length > 0) {
      tocarProximo();
    } else {
      atualizarStatus("Aguardando áudio", "Fila vazia", "idle");
    }
  }

  function normalizarAudio(audio) {
    if (/^https?:\/\//i.test(audio) || audio.startsWith("/")) {
      return audio;
    }

    return "/" + audio;
  }

  function extrairAudio(payload) {
    if (typeof payload === "string") {
      return payload;
    }

    if (payload && payload.audio) {
      return payload.audio;
    }

    return "";
  }

  function nomeArquivo(audioPath) {
    return audioPath.split("/").pop() || audioPath;
  }

  function atualizarDetalheFila() {
    if (!tocando) {
      statusDetail.textContent = fila.length + " na fila";
    }
  }

  function atualizarStatus(titulo, detalhe, estado) {
    statusTitle.textContent = titulo;
    statusDetail.textContent = detalhe;
    statusDot.className = "status-dot";

    if (estado === "playing") {
      statusDot.classList.add("playing");
    } else if (estado === "error") {
      statusDot.classList.add("error");
    }
  }
})();
