(function () {
  const socket = io();
  const fila = [];
  const mediaStage = document.querySelector("#media-stage");
  const alertImage = document.querySelector("#alert-image");
  const alertVideo = document.querySelector("#alert-video");
  const cardHost = document.querySelector("#card-sh-host");
  const roletaHost = document.querySelector("#roleta-host");
  const overlayDefaults = {
    resolution: { width: 1920, height: 1080 },
    components: {
      midia: { x: 960, y: 540, width: 640, height: 360, scale: 1 },
      "card-sh": { x: 960, y: 540, width: 380, height: 540, scale: 1 },
      roleta: { x: 960, y: 540, width: 700, height: 700, scale: 1 },
    },
  };
  let overlayConfig = overlayDefaults;

  let tocando = false;
  let audioAtual = null;
  let timeoutAtual = null;
  const ttsRoletasPendentes = new Map();

  if (cardHost) {
    carregarLayoutOverlay();
    if (window.addEventListener) window.addEventListener("resize", aplicarLayoutOverlay);
  }

  async function carregarLayoutOverlay() {
    try {
      const resposta = await fetch("/api/config");
      const config = await resposta.json();
      overlayConfig = normalizarLayoutOverlay(config.overlay);
      aplicarLayoutOverlay();
    } catch (error) {
      console.warn("[alert] usando layout padrão do overlay:", error.message);
    }
  }

  function normalizarLayoutOverlay(layout) {
    const valor = layout || {};
    return {
      resolution: {
        width: Number(valor.resolution && valor.resolution.width) || overlayDefaults.resolution.width,
        height: Number(valor.resolution && valor.resolution.height) || overlayDefaults.resolution.height,
      },
      components: {
        midia: { ...overlayDefaults.components.midia, ...(valor.components && valor.components.midia ? valor.components.midia : {}) },
        "card-sh": { ...overlayDefaults.components["card-sh"], ...(valor.components && valor.components["card-sh"] ? valor.components["card-sh"] : {}) },
        roleta: { ...overlayDefaults.components.roleta, ...(valor.components && valor.components.roleta ? valor.components.roleta : {}) },
      },
    };
  }

  function aplicarLayoutOverlay() {
    const largura = window.innerWidth || overlayConfig.resolution.width;
    const altura = window.innerHeight || overlayConfig.resolution.height;
    const escala = Math.min(
      largura / overlayConfig.resolution.width,
      altura / overlayConfig.resolution.height,
    );
    const offsetX = (largura - overlayConfig.resolution.width * escala) / 2;
    const offsetY = (altura - overlayConfig.resolution.height * escala) / 2;
    aplicarLayoutElemento(alertImage, overlayConfig.components.midia, escala, offsetX, offsetY);
    aplicarLayoutElemento(alertVideo, overlayConfig.components.midia, escala, offsetX, offsetY);

    if (cardHost) {
      const layout = overlayConfig.components["card-sh"];
      const escalaCardX = (Number(layout.width) || 380) / 380 * escala * (Number(layout.scale) || 1);
      const escalaCardY = (Number(layout.height) || 540) / 540 * escala * (Number(layout.scale) || 1);
      cardHost.style.display = "block";
      cardHost.style.position = "absolute";
      cardHost.style.margin = "0";
      cardHost.style.maxWidth = "none";
      cardHost.style.maxHeight = "none";
      cardHost.style.left = `${offsetX + Number(layout.x) * escala}px`;
      cardHost.style.top = `${offsetY + Number(layout.y) * escala}px`;
      cardHost.style.width = "950px";
      cardHost.style.height = "760px";
      cardHost.style.transform = `translate(-50%, -50%) scaleX(${escalaCardX}) scaleY(${escalaCardY})`;
      cardHost.style.transformOrigin = "center center";

      const cena = cardHost.querySelector(".scene");
      if (cena) {
        cena.style.position = "absolute";
        cena.style.left = "0";
        cena.style.top = "0";
        cena.style.width = "950px";
        cena.style.height = "760px";
        cena.style.margin = "0";
      }
    }
    if (roletaHost) aplicarLayoutElemento(roletaHost, overlayConfig.components.roleta, escala, offsetX, offsetY);
    ajustarTamanhoRoleta();
  }

  function ajustarTamanhoRoleta() {
    if (!roletaHost) return;
    const cena = roletaHost.querySelector('.scene');
    if (!cena) return;
    const largura = roletaHost.clientWidth || Number(overlayConfig.components.roleta.width) || 700;
    const altura = roletaHost.clientHeight || Number(overlayConfig.components.roleta.height) || 700;
    const tamanho = Math.max(120, Math.floor(Math.min(largura, altura) * 0.82));
    cena.style.width = '100%';
    cena.style.height = '100%';
    cena.style.minHeight = '0';
    cena.style.setProperty('--size', `${tamanho}px`);
    const roda = cena.querySelector('.wheel-wrap');
    if (roda) { roda.style.width = `${tamanho}px`; roda.style.height = `${tamanho}px`; }
  }

  function aplicarLayoutElemento(elemento, layout, escala, offsetX, offsetY) {
    if (!elemento || !elemento.style) return;
    const escalaComponente = Number(layout.scale) || 1;
    elemento.style.position = "absolute";
    elemento.style.left = `${offsetX + Number(layout.x) * escala}px`;
    elemento.style.top = `${offsetY + Number(layout.y) * escala}px`;
    elemento.style.width = `${Number(layout.width) * escala * escalaComponente}px`;
    elemento.style.height = `${Number(layout.height) * escala * escalaComponente}px`;
    elemento.style.maxWidth = "none";
    elemento.style.maxHeight = "none";
    elemento.style.objectFit = "contain";
    elemento.style.transform = "translate(-50%, -50%)";
  }

  socket.on("connect", () => {
    // Aguardando alerta sem HUD.
  });

  socket.on("disconnect", () => {
    // Socket desconectado; sem HUD.
  });

  socket.on("alert", (payload) => {
    if (payload && payload.roletaId && ttsRoletasPendentes.has(payload.roletaId)) {
      const resolver = ttsRoletasPendentes.get(payload.roletaId);
      ttsRoletasPendentes.delete(payload.roletaId);
      resolver(payload.audio || "");
      return;
    }
    if (payload && payload.tipo === "card-sh") {
      adicionarNaFilaCardSH(payload);
    } else if (payload && payload.tipo === "roleta") {
      fila.push({ tipo: "roleta", premios: payload.premios || [], audioInicio: payload.audioInicio || "", audioResultado: payload.audioResultado || "", ttsResultado: payload.ttsResultado || false, ttsOptions: payload.ttsOptions || {} }); tocarProximo();
    } else if (payload && payload.tipo === "tts") {
      adicionarNaFilaTTS(payload);
    } else if (payload && payload.tipo === "midia") {
      adicionarNaFilaMidia(payload);
    } else {
      adicionarNaFila(payload);
    }
  });

  function adicionarNaFilaCardSH(payload) {
    if (!payload || !payload.card) return;
    fila.push({ tipo: "card-sh", card: payload.card });
    tocarProximo();
  }

  socket.on("tts:ready", (payload) => {
    const ttsPayload = payload && payload.tipo ? payload : { tipo: "tts", ...(payload || {}) };
    if (ttsPayload.roletaId && ttsRoletasPendentes.has(ttsPayload.roletaId)) {
      const resolver = ttsRoletasPendentes.get(ttsPayload.roletaId);
      ttsRoletasPendentes.delete(ttsPayload.roletaId);
      resolver(ttsPayload.audio || "");
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
    } else if (item.tipo === "card-sh") {
      tocarCardSH(item);
    } else if (item.tipo === "roleta") {
      tocarRoleta(item);
    }
  }

  async function tocarRoleta(item) {
    if (!roletaHost) return finalizarAudioAtual();
    try {
      if (item.audioInicio) { const inicio = new Audio(normalizarAudio(item.audioInicio)); await inicio.play().catch(()=>{}); }
      const resposta = await fetch('/alert/roleta_premios_v2.html');
      const html = await resposta.text();
      const documento = new DOMParser().parseFromString(html, 'text/html');
      const estilo = document.createElement('style'); estilo.id='roleta-runtime-style'; estilo.textContent=(documento.querySelector('style')||{}).textContent||''; document.head.appendChild(estilo);
      Array.from(documento.body.children).forEach(el=>{if(el.tagName.toLowerCase()!=='script')roletaHost.appendChild(document.importNode(el,true))});
      const cenaRoleta = roletaHost.querySelector('.scene');
      if (cenaRoleta) { cenaRoleta.style.width='100%'; cenaRoleta.style.height='100%'; cenaRoleta.style.minHeight='0'; }
      const scripts=Array.from(documento.querySelectorAll('script')); window.ROLETA_PREMIOS=item.premios;
      scripts.forEach(s=>{let code=s.textContent.replace(/const prizes\s*=.*?;/,'const prizes = (window.ROLETA_PREMIOS || []);');new Function(code)()});
      mediaStage.style.display='block';
      roletaHost.style.display='block';
      roletaHost.style.zIndex='9999';
      ajustarTamanhoRoleta();
      window.dispatchEvent(new Event('resize'));
      mediaStage.classList.add('visible');
      const encerrar = () => { roletaHost.innerHTML='';roletaHost.style.display='none';mediaStage.classList.remove('visible');const st=document.querySelector('#roleta-runtime-style');if(st)st.remove();window.ROLETA_PREMIOS=null;tocando=false;tocarProximo(); };
      const tocarAudio = (src) => new Promise(resolve => { if (!src) return resolve(); const audio = new Audio(normalizarAudio(src)); audio.addEventListener('ended', resolve, { once:true }); audio.addEventListener('error', resolve, { once:true }); audio.play().catch(resolve); });
      const tocarResultado = async (premio) => {
        await tocarAudio(item.audioResultado);
        if (item.ttsResultado) { try { const texto='Resultado da roleta: '+premio; const roletaId='roleta-'+Date.now()+'-'+Math.random().toString(36).slice(2); const audio=await new Promise(resolve=>{ttsRoletasPendentes.set(roletaId,resolve);socket.emit('tts:request',{roletaId,texto,options:item.ttsOptions||{},comando:'roleta'});setTimeout(()=>{if(ttsRoletasPendentes.has(roletaId)){ttsRoletasPendentes.delete(roletaId);resolve('')}},60000)}); await tocarAudio(audio); } catch(_){} }
        encerrar();
      };
      let resultadoDetectado = false, inicio = Date.now();
      const aguardarResultado = () => { const banner = roletaHost.querySelector('#banner.show'), texto = roletaHost.querySelector('#winnerText'); if (banner && texto && texto.textContent.trim() && !resultadoDetectado) { resultadoDetectado=true; tocarResultado(texto.textContent.trim()); return; } if (Date.now()-inicio > 60000) return encerrar(); setTimeout(aguardarResultado,100); };
      aguardarResultado();
    } catch(e){console.error('[alert] roleta:',e);roletaHost.innerHTML='';roletaHost.style.display='none';mediaStage.classList.remove('visible');tocando=false;tocarProximo()}
  }

  async function tocarCardSH(item) {
    if (!cardHost) return;
    aplicarLayoutOverlay();
    let encerrado = false;
    const finalizar = () => {
      if (encerrado) return;
      encerrado = true;
      window.removeEventListener("message", finalizarPorMensagem);
      cardHost.classList.remove("visible");
      cardHost.innerHTML = "";
      window.CARD_SH_DATA = null;
      const estilo = document.querySelector("#card-sh-runtime-style");
      if (estilo) estilo.remove();
      mediaStage.classList.remove("visible");
      tocando = false;
      tocarProximo();
    };
    const finalizarPorMensagem = (evento) => {
      if (evento.source === window && evento.data === "card-sh:finished") finalizar();
    };

    try {
      const resposta = await fetch("/alert/twitch_channel_card_v3.html");
      if (!resposta.ok) throw new Error("Não foi possível carregar o Card SH.");
      const html = await resposta.text();
      const documento = new DOMParser().parseFromString(html, "text/html");
      const estiloOriginal = documento.querySelector("style");
      const estilo = document.createElement("style");
      estilo.id = "card-sh-runtime-style";
      estilo.textContent = estiloOriginal ? estiloOriginal.textContent : "";
      document.head.appendChild(estilo);

      Array.from(documento.body.children).forEach((elemento) => {
        if (elemento.tagName.toLowerCase() !== "script") cardHost.appendChild(document.importNode(elemento, true));
      });

      const scripts = Array.from(documento.querySelectorAll("script"));
      window.CARD_SH_DATA = item.card;
      scripts.forEach((script) => {
        if (script.textContent) new Function(script.textContent)();
      });
      aplicarLayoutOverlay();
      mediaStage.classList.add("visible");
      cardHost.classList.add("visible");
    } catch (error) {
      console.error("[alert] falha ao carregar Card SH:", error);
      finalizar();
      return;
    }

    window.addEventListener("message", finalizarPorMensagem);
    setTimeout(finalizar, 22000);
  }

  function tocarMidia(item) {
    const ehVideo = /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(item.midia);
    aplicarLayoutOverlay();
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
    if (cardHost) {
      cardHost.classList.remove("visible");
      cardHost.innerHTML = "";
    }
    window.CARD_SH_DATA = null;
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
