(function () {
  const socket = io();
  const somenteRecompensas = window.location.pathname === "/alert/rewards";
  const fila = [];
  const mediaStage = document.querySelector("#media-stage");
  const alertImage = document.querySelector("#alert-image");
  const alertVideo = document.querySelector("#alert-video");

  let tocando = false;
  let audioAtual = null;
  let timeoutAtual = null;

  socket.on("connect", () => {
    // Aguardando alerta sem HUD.
  });

  socket.on("disconnect", () => {
    // Socket desconectado; sem HUD.
  });

  socket.on("alert", (payload) => {
    if (somenteRecompensas && (!payload || payload.tipo !== "midia")) {
      return;
    }

    if (payload && payload.tipo === "tts") {
      adicionarNaFilaTTS(payload);
    } else if (payload && payload.tipo === "midia") {
      adicionarNaFilaMidia(payload);
    } else {
      adicionarNaFila(payload);
    }
  });

  socket.on("tts:ready", (payload) => {
    const ttsPayload = payload && payload.tipo ? payload : { tipo: "tts", ...(payload || {}) };
    if (somenteRecompensas) {
      return;
    }
    if (ttsPayload.tipo === "tts") {
      adicionarNaFilaTTS(ttsPayload);
    }
  });

  function adicionarNaFila(payload) {
    const audio = extrairAudio(payload);

    if (!audio) {
      return;
    }

    const metadados = typeof payload === "object" && payload ? payload : {};

    fila.push({ tipo: "audio", audio: normalizarAudio(audio), comando: metadados.comando, usuario: metadados.usuario });
    tocarProximo();
  }

  function adicionarNaFilaMidia(payload) {
    if (!payload.midia && !payload.audio) return;
    fila.push({ tipo: "midia", midia: payload.midia ? normalizarAudio(payload.midia) : "", audio: payload.audio ? normalizarAudio(payload.audio) : "", duracao: Math.max(1, Number(payload.duracao) || 8), usuario: payload.usuario || "", recompensa: payload.recompensa || "Alerta" });
    tocarProximo();
  }

  async function adicionarNaFilaTTS(payload) {
    const metadados = typeof payload === "object" && payload ? payload : {};
    const audio = metadados.audio || "";

    if (audio) {
      fila.push({
        tipo: "audio",
        audio: normalizarAudio(audio),
        comando: metadados.comando,
        usuario: metadados.usuario,
      });
      tocarProximo();
      return;
    }

    const texto = String(metadados.texto || "").trim();
    if (!texto) {
      console.warn("[alert] payload TTS sem texto nem audio; ignorando.");
      return;
    }

    try {
      const resposta = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto,
          voz: metadados.options && metadados.options.voice ? metadados.options.voice : null,
          language: metadados.options && metadados.options.language ? metadados.options.language : "pt-BR",
        }),
      });

      const data = await resposta.json();
      if (!resposta.ok || !data || !data.audio) {
        throw new Error((data && data.erro) || "Falha ao gerar TTS local.");
      }

      fila.push({
        tipo: "audio",
        audio: normalizarAudio(data.audio),
        comando: metadados.comando,
        usuario: metadados.usuario,
      });
      tocarProximo();
    } catch (error) {
      console.error("[alert] falha ao gerar TTS no servidor:", error);
    }
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

      audioAtual.addEventListener("ended", finalizarAudioAtual);
      audioAtual.addEventListener("error", () => {
        console.error("Erro ao reproduzir audio:", audioPath);
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
    } else if (item.tipo === "midia") {
      tocarMidia(item);
    }
  }

  function tocarMidia(item) {
    const ehVideo = /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(item.midia);
    mediaStage.classList.add("visible");
    if (item.midia) {
      if (ehVideo) {
        alertVideo.src = item.midia; alertVideo.classList.add("visible"); alertVideo.currentTime = 0;
        alertVideo.play().catch((error) => console.error("Vídeo bloqueado:", error));
      } else {
        alertImage.src = item.midia; alertImage.classList.add("visible");
      }
    }
    if (item.audio) {
      audioAtual = new Audio(item.audio); audioAtual.preload = "auto";
      audioAtual.play().catch((error) => console.error("Áudio bloqueado:", error));
    }
    timeoutAtual = setTimeout(finalizarAudioAtual, item.duracao * 1000);
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
    clearTimeout(timeoutAtual);
    timeoutAtual = null;
    if (audioAtual && typeof audioAtual.pause === "function") {
      audioAtual.pause();
      if (typeof audioAtual.removeAttribute === "function") audioAtual.removeAttribute("src");
      if (typeof audioAtual.load === "function") audioAtual.load();
      audioAtual = null;
    }
    if (alertVideo) {
      alertVideo.pause();
      alertVideo.removeAttribute("src");
      alertVideo.load();
      alertVideo.classList.remove("visible");
    }
    if (alertImage) {
      alertImage.removeAttribute("src");
      alertImage.classList.remove("visible");
    }
    mediaStage.classList.remove("visible");

    tocando = false;

    if (fila.length > 0) {
      tocarProximo();
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

})();
