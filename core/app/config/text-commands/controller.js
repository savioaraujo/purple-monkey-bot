// Controller for Text Commands MVC
(function () {
  const channelSelect = document.getElementById('channelSelect');
  const commandsList = document.getElementById('commandsList');
  const newBtn = document.getElementById('newBtn');
  const editorForm = document.getElementById('editorForm');
  const cmdName = document.getElementById('cmdName');
  const cmdResponse = document.getElementById('cmdResponse');
  const cmdOptions = document.getElementById('cmdOptions');
  const cmdOptionsLabel = document.getElementById('cmdOptionsLabel');
  const restricoesUsuarios = document.getElementById('restricoesUsuarios');
  const restricoesCargos = document.getElementById('restricoesCargos');
  const triggerTipo = document.getElementById('triggerTipo');
  const triggerUsuario = document.getElementById('triggerUsuario');
  const editingIndex = document.getElementById('editingIndex');
  const cancelBtn = document.getElementById('cancelBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const macrosListEl = document.getElementById('macrosList');
  const roletaSelect = document.getElementById('roletaSelect');
  const roletaLabel = document.getElementById('roletaLabel');

  let config = null;
  let currentChannel = null;
  const currentType = new URLSearchParams(window.location.search).get('type') || 'texto-simples';

  function loadConfig() {
    return fetch('/api/config').then(r => r.json()).then(json => {
      config = json;
      populateChannels();
    });
  }

  function populateChannels() {
    const canais = (config.canais || []).map(c => c.nome);
    channelSelect.innerHTML = '';
    canais.forEach(nome => {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.textContent = nome;
      channelSelect.appendChild(opt);
    });
    if (canais.length) {
      channelSelect.value = canais[0];
      onChannelChange();
    }
  }

  function populateRoletas() {
    if (!roletaSelect) return;
    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    roletaSelect.innerHTML = '<option value="">Selecione uma roleta</option>' +
      ((canal && canal.roletas) || []).map(r => `<option value="${r.nome}">${r.nome}</option>`).join('');
  }

  function getCommandsForChannel(nome) {
    const canal = (config.canais || []).find(c => c.nome === nome);
    if (!canal) return [];
    return (canal.comandos || []).filter(cmd => cmd.tipo === currentType);
  }

  function renderCommandsList() {
    commandsList.innerHTML = '';
    const items = getCommandsForChannel(currentChannel);
    items.forEach((cmd, idx) => {
      const div = document.createElement('div');
      div.className = 'command-item';
      const left = document.createElement('div');
      const metaParts = [];
      if (cmd.restricoes && (cmd.restricoes.usuarios || cmd.restricoes.cargos)) {
        const restricoes = [];
        if (cmd.restricoes.usuarios && cmd.restricoes.usuarios.length) restricoes.push('usuarios: ' + cmd.restricoes.usuarios.join(', '));
        if (cmd.restricoes.cargos && cmd.restricoes.cargos.length) restricoes.push('cargos: ' + cmd.restricoes.cargos.join(', '));
        if (restricoes.length) metaParts.push(restricoes.join(' | '));
      }
      const cmdTriggers = (config.canais.find(c => c.nome === currentChannel)?.triggers || [])
        .filter(t => t.comando === (cmd.comando || cmd.matcher));
      cmdTriggers.forEach(t => metaParts.push('trigger: ' + t.tipo + (t.usuario ? ' / ' + t.usuario : '')));
      left.textContent = (cmd.comando || cmd.matcher || '') + ' → ' + (cmd.resposta || '') + (metaParts.length ? ' [' + metaParts.join(' • ') + ']' : '');
      const right = document.createElement('div');
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Editar';
      editBtn.onclick = () => editCommand(idx);
      right.appendChild(editBtn);
      div.appendChild(left);
      div.appendChild(right);
      commandsList.appendChild(div);
    });
  }

  function onChannelChange() {
    currentChannel = channelSelect.value;
    populateRoletas();
    clearEditor();
    renderCommandsList();
  }

  function getDefaultTtsOptions() {
    return {
      provider: 'puter',
      voice: 'Vitoria',
      language: 'pt-BR',
      model: null,
      instructions: null
    };
  }

  function parseTtsOptions(rawValue) {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) {
      return getDefaultTtsOptions();
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('O valor de options precisa ser um objeto JSON.');
      }
      return Object.assign({}, getDefaultTtsOptions(), parsed);
    } catch (e) {
      throw new Error('JSON de options inválido. Ex.: {"provider":"xai","voice":"Vitoria","language":"pt-BR"}');
    }
  }

  async function carregarOpcoesTts(providerAtual = 'puter', languageAtual = 'pt-BR', puterProvider = '', model = '') {
    const params = new URLSearchParams({ provider: providerAtual, language: languageAtual });
    if (puterProvider) params.set('puterProvider', puterProvider);
    if (model) params.set('model', model);
    const options = await fetch('/api/tts/options?' + params.toString()).then(r => r.json());
    return options || { providers: [], languages: [], voices: [] };
  }

  function montarCampoTts(options, defOptions = {}) {
    const wrapper = document.createElement('div');
    wrapper.style.gridColumn = '1/-1';
    const providerWrap = document.createElement('div');
    const languageWrap = document.createElement('div');
    const voiceWrap = document.createElement('div');
    providerWrap.innerHTML = '<label>Provider</label>';
    languageWrap.innerHTML = '<label>Idioma</label>';
    voiceWrap.innerHTML = '<label>Voz</label>';

    const providerSelect = document.createElement('select');
    const puterProviderSelect = document.createElement('select');
    const modelSelect = document.createElement('select');
    const languageSelect = document.createElement('select');
    const voiceSelect = document.createElement('select');

    const toOption = (value, text) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text || value;
      return opt;
    };

    const preencherSelect = (select, valores, valorPadrao) => {
      select.innerHTML = '';
      valores.forEach((valor) => select.appendChild(toOption(valor, valor)));
      if (valorPadrao && valores.includes(valorPadrao)) {
        select.value = valorPadrao;
      } else if (valores.length) {
        select.value = valores[0];
      }
    };

    const atualizarOpcoes = async (trocaProvider = false) => {
      const provider = providerSelect.value || 'puter';
      const language = trocaProvider ? 'pt-BR' : (languageSelect.value || 'pt-BR');
      const api = await carregarOpcoesTts(provider, language);
      preencherSelect(languageSelect, api.languages || [], api.language || language);
      preencherSelect(voiceSelect, api.voices || [], trocaProvider ? (api.voices && api.voices[0]) : (voiceSelect.value || defOptions.voice));
      if (cmdOptions) {
        cmdOptions.value = JSON.stringify({
          provider: providerSelect.value,
          voice: voiceSelect.value,
          language: languageSelect.value,
          model: null,
          instructions: null,
        }, null, 2);
      }
    };

    providerSelect.addEventListener('change', () => atualizarOpcoes(true));
    languageSelect.addEventListener('change', () => atualizarOpcoes(false));

    const defaults = Object.assign({}, getDefaultTtsOptions(), defOptions || {});
    const providers = (options && options.providers) || [{ value: 'puter', label: 'Puter' }, { value: 'local', label: 'Local' }];
    preencherSelect(providerSelect, providers.map(p => p.value), defaults.provider || 'puter');

    const init = async () => {
      const opcoes = await carregarOpcoesTts(providerSelect.value || 'puter', defaults.language || 'pt-BR');
      preencherSelect(languageSelect, opcoes.languages || [], defaults.language || 'pt-BR');
      preencherSelect(voiceSelect, opcoes.voices || [], defaults.voice || (opcoes.voices && opcoes.voices[0]) || 'Vitoria');
      if (cmdOptions) {
        cmdOptions.value = JSON.stringify({
          provider: providerSelect.value,
          voice: voiceSelect.value,
          language: languageSelect.value,
          model: null,
          instructions: null,
        }, null, 2);
      }
    };

    providerWrap.appendChild(providerSelect);
    languageWrap.appendChild(languageSelect);
    voiceWrap.appendChild(voiceSelect);

    wrapper.appendChild(providerWrap);
    wrapper.appendChild(languageWrap);
    wrapper.appendChild(voiceWrap);
    init();
    return wrapper;
  }

  function parseCsv(value) {
    return (value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  function parseRestricoes() {
    const usuarios = parseCsv(restricoesUsuarios ? restricoesUsuarios.value : '');
    const cargos = parseCsv(restricoesCargos ? restricoesCargos.value : '');

    const payload = {};
    if (usuarios.length) payload.usuarios = usuarios;
    if (cargos.length) payload.cargos = cargos;
    return Object.keys(payload).length ? payload : undefined;
  }

  function parseTrigger() {
    const tipo = triggerTipo ? triggerTipo.value : '';
    const usuario = triggerUsuario ? (triggerUsuario.value || '').trim() : '';

    if (!tipo) return undefined;

    const payload = { tipo };
    if (usuario) payload.usuario = usuario;
    return payload;
  }

  function clearEditor() {
    editingIndex.value = '';
    cmdName.value = '';
    cmdResponse.value = '';
    if (cmdOptions) cmdOptions.value = '';
    const existingWrapper = document.getElementById('ttsOptionsSelects');
    if (existingWrapper) existingWrapper.remove();
    if (restricoesUsuarios) restricoesUsuarios.value = '';
    if (restricoesCargos) restricoesCargos.value = '';
    if (triggerTipo) triggerTipo.value = '';
    if (triggerUsuario) triggerUsuario.value = '';
    deleteBtn.style.display = 'none';
    const editorCol = document.getElementById('editorColumn');
    if (editorCol) editorCol.style.display = 'none';
  }

  function editCommand(idx) {
    const items = getCommandsForChannel(currentChannel);
    const cmd = items[idx];
    if (!cmd) return;
    // find global index in canal.comandos
    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    const globalIndex = canal.comandos.findIndex(c => c === cmd);
    editingIndex.value = String(globalIndex);
    cmdName.value = cmd.comando || cmd.matcher || '';
    cmdResponse.value = cmd.resposta || '';
    if (cmdOptions) {
      const optionsValue = cmd.options ? JSON.stringify(Object.assign({}, getDefaultTtsOptions(), cmd.options), null, 2) : JSON.stringify(getDefaultTtsOptions(), null, 2);
      cmdOptions.value = optionsValue;
    }
    if (currentType === 'tts' || currentType === 'chat-tts') {
      renderTtsOptionsUI({ options: cmd.options || parseTtsOptions(cmdOptions && cmdOptions.value ? cmdOptions.value : '') });
    }
    if (restricoesUsuarios) restricoesUsuarios.value = Array.isArray(cmd.restricoes && cmd.restricoes.usuarios) ? cmd.restricoes.usuarios.join(', ') : '';
    if (restricoesCargos) restricoesCargos.value = Array.isArray(cmd.restricoes && cmd.restricoes.cargos) ? cmd.restricoes.cargos.join(', ') : '';
    const cmdTrigger = (canal.triggers || []).find(t => t.comando === (cmd.comando || cmd.matcher));
    if (triggerTipo) triggerTipo.value = cmdTrigger && cmdTrigger.tipo ? cmdTrigger.tipo : '';
    if (triggerUsuario) triggerUsuario.value = cmdTrigger && cmdTrigger.usuario ? cmdTrigger.usuario : '';
    deleteBtn.style.display = 'inline-block';
    const editorCol = document.getElementById('editorColumn');
    if (editorCol) editorCol.style.display = '';
  }

  function addNew() {
    clearEditor();
    if (currentType === 'tts' || currentType === 'chat-tts') {
      cmdOptions.value = JSON.stringify(getDefaultTtsOptions(), null, 2);
      renderTtsOptionsUI({ options: getDefaultTtsOptions() });
    }
    cmdName.focus();
    const editorCol = document.getElementById('editorColumn');
    if (editorCol) editorCol.style.display = '';
  }

  function saveConfig(newConfig) {
    return fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    }).then(r => r.json()).then(j => {
      config = j;
      renderCommandsList();
    });
  }

  function updateEditorLabels() {
    const label = document.getElementById('cmdNameLabel');
    const title = document.getElementById('pageTitle');
    const isTtsLike = currentType === 'tts' || currentType === 'chat-tts';
    const isCardSH = currentType === 'card-sh';
    const isRoleta = currentType === 'roleta';
    if (roletaLabel) roletaLabel.style.display = isRoleta ? '' : 'none';
    if (roletaSelect) roletaSelect.style.display = isRoleta ? '' : 'none';
    if (label) {
      label.innerHTML = currentType === 'texto-regex'
        ? 'Regex do comando (ex: !teste|!teste2) <span style="color:red">*</span>'
        : 'Nome do comando (ex: !teste) <span style="color:red">*</span>';
    }
    if (title) {
      title.textContent = currentType === 'texto-regex'
        ? 'Comandos de Texto Regex (MVC)'
        : currentType === 'tts' || currentType === 'chat-tts'
          ? 'Comandos TTS (MVC)'
          : isCardSH
            ? 'Comandos Card SH (MVC)'
          : 'Comandos de Texto Simples (MVC)';
    }
    if (cmdOptionsLabel) {
      cmdOptionsLabel.style.display = isTtsLike ? '' : 'none';
    }
    if (cmdOptions) {
      cmdOptions.style.display = isTtsLike ? '' : 'none';
      if (!isTtsLike) {
        cmdOptions.value = '';
      }
    }
    if (isTtsLike) {
      renderTtsOptionsUI({ options: parseTtsOptions(cmdOptions && cmdOptions.value ? cmdOptions.value : '') });
    }
  }

  function renderTtsOptionsUI(def = {}) {
    if (!cmdOptions) return;
    const existing = document.getElementById('ttsOptionsSelects');
    if (existing) existing.remove();

    const parent = cmdOptions.parentElement;
    if (!parent) return;

    const parsed = Object.assign({}, getDefaultTtsOptions(), def.options || parseTtsOptions(cmdOptions.value || ''));
    const target = document.createElement('div');
    target.id = 'ttsOptionsSelects';
    target.style.marginBottom = '10px';
    target.style.display = 'grid';
    target.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    target.style.gap = '10px';

    const providerSelect = document.createElement('select');
    const puterProviderSelect = document.createElement('select');
    const modelSelect = document.createElement('select');
    const languageSelect = document.createElement('select');
    const voiceSelect = document.createElement('select');

    const providerWrap = document.createElement('div');
    const puterProviderWrap = document.createElement('div');
    const modelWrap = document.createElement('div');
    const languageWrap = document.createElement('div');
    const voiceWrap = document.createElement('div');
    providerWrap.innerHTML = '<label>Provider</label>';
    puterProviderWrap.innerHTML = '<label>Provider Puter</label>';
    modelWrap.innerHTML = '<label>Modelo / engine</label>';
    languageWrap.innerHTML = '<label>Idioma</label>';
    voiceWrap.innerHTML = '<label>Voz</label>';

    const fill = (select, values, selected) => {
      select.innerHTML = '';
      values.forEach((item) => {
        const value = typeof item === 'object' ? item.value : item;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = typeof item === 'object' ? item.label : value;
        select.appendChild(option);
      });
      const ids = values.map(item => typeof item === 'object' ? item.value : item);
      if (selected && ids.includes(selected)) {
        select.value = selected;
      } else if (values.length) {
        select.value = values[0];
      }
    };

    providerSelect.innerHTML = ['puter', 'local'].map((value) => `<option value="${value}">${value}</option>`).join('');
    providerSelect.value = parsed.provider || 'puter';

    const setJsonValue = () => {
      cmdOptions.value = JSON.stringify({
        provider: providerSelect.value,
        puterProvider: providerSelect.value === 'puter' ? puterProviderSelect.value : null,
        language: languageSelect.value,
        voice: voiceSelect.value,
        voiceLabel: voiceSelect.selectedOptions[0] ? voiceSelect.selectedOptions[0].textContent : voiceSelect.value,
        model: providerSelect.value === 'puter' ? modelSelect.value || null : null,
        instructions: null,
      }, null, 2);
    };

    providerSelect.addEventListener('change', async () => {
      const data = await carregarOpcoesTts(providerSelect.value || 'puter', 'pt-BR');
      const isPuter = providerSelect.value === 'puter';
      puterProviderWrap.style.display = isPuter ? '' : 'none'; modelWrap.style.display = isPuter ? '' : 'none';
      fill(puterProviderSelect, data.puterProviders || [], parsed.puterProvider || 'aws-polly');
      fill(modelSelect, data.models || [], parsed.model || '');
      fill(languageSelect, data.languages || [], (data.languages || [])[0] || 'pt-BR');
      fill(voiceSelect, data.voiceOptions || data.voices || [], (data.voiceOptions && data.voiceOptions[0] && data.voiceOptions[0].value) || data.voices && data.voices[0] || 'Vitoria');
      setJsonValue();
    });

    const atualizarPuter = async (preservarVoz = false) => {
      const data = await carregarOpcoesTts('puter', languageSelect.value || 'pt-BR', puterProviderSelect.value, modelSelect.value);
      fill(modelSelect, data.models || [], modelSelect.value || parsed.model || '');
      fill(languageSelect, data.languages || [], data.language || languageSelect.value);
      fill(voiceSelect, data.voiceOptions || data.voices || [], preservarVoz ? voiceSelect.value : parsed.voice);
      setJsonValue();
    };
    puterProviderSelect.addEventListener('change', () => atualizarPuter(false));
    modelSelect.addEventListener('change', () => atualizarPuter(false));

    languageSelect.addEventListener('change', async () => {
      const data = await carregarOpcoesTts(providerSelect.value || 'puter', languageSelect.value || 'pt-BR', puterProviderSelect.value, modelSelect.value);
      fill(voiceSelect, data.voiceOptions || data.voices || [], (data.voiceOptions && data.voiceOptions[0] && data.voiceOptions[0].value) || data.voices && data.voices[0] || 'Vitoria');
      setJsonValue();
    });

    voiceSelect.addEventListener('change', setJsonValue);

    carregarOpcoesTts(providerSelect.value || 'puter', parsed.language || 'pt-BR', parsed.puterProvider || 'aws-polly', parsed.model || '').then((data) => {
      fill(puterProviderSelect, data.puterProviders || [], parsed.puterProvider || 'aws-polly');
      fill(modelSelect, data.models || [], parsed.model || '');
      fill(languageSelect, data.languages || [], parsed.language || 'pt-BR');
      fill(voiceSelect, data.voiceOptions || data.voices || [], parsed.voice || 'Vitoria');
      const isPuter = providerSelect.value === 'puter'; puterProviderWrap.style.display=isPuter?'':'none'; modelWrap.style.display=isPuter?'':'none';
      setJsonValue();
    });

    providerWrap.appendChild(providerSelect);
    puterProviderWrap.appendChild(puterProviderSelect);
    modelWrap.appendChild(modelSelect);
    languageWrap.appendChild(languageSelect);
    voiceWrap.appendChild(voiceSelect);

    target.appendChild(providerWrap);
    target.appendChild(puterProviderWrap);
    target.appendChild(modelWrap);
    target.appendChild(languageWrap);
    target.appendChild(voiceWrap);
    parent.insertBefore(target, cmdOptions);
  }

  editorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (cmdName.value || '').trim();
    const response = (cmdResponse.value || '').trim();
    const isTtsLike = currentType === 'tts' || currentType === 'chat-tts';
    const isCardSH = currentType === 'card-sh';
    const isRoleta = currentType === 'roleta';

    const premios = response.split('\n').map(item => item.trim()).filter(Boolean);
    if (!name || (isRoleta && !roletaSelect.value) || (!response && !isTtsLike && !isCardSH && !isRoleta)) {
      alert(currentType === 'texto-regex' ? 'Regex e resposta são obrigatórios' : isTtsLike || isCardSH ? 'Nome é obrigatório' : 'Nome e resposta são obrigatórios');
      return;
    }

    let optionsPayload = undefined;
    if (isTtsLike) {
      try {
        optionsPayload = parseTtsOptions(cmdOptions ? cmdOptions.value : '');
      } catch (err) {
        alert(err.message);
        return;
      }
    }

    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    if (!canal) return alert('Canal inválido');

    const idx = editingIndex.value ? parseInt(editingIndex.value, 10) : -1;
    const restricoes = parseRestricoes();
    const trigger = parseTrigger();

    const basePayload = {
      tipo: currentType,
      ...(currentType === 'texto-regex' ? { matcher: name } : { comando: name }),
      ...(response ? { resposta: response } : {}),
      ...(isRoleta ? { premios } : {}),
      ...(isRoleta ? { roleta: roletaSelect.value } : {}),
      ...(restricoes ? { restricoes } : {}),
      
    };

    if (idx >= 0) {
      // update existing
      if (currentType === 'texto-regex') {
        canal.comandos[idx].matcher = name;
        delete canal.comandos[idx].comando;
      } else {
        canal.comandos[idx].comando = name;
        delete canal.comandos[idx].matcher;
      }
      canal.comandos[idx].resposta = response;
      if (restricoes) {
        canal.comandos[idx].restricoes = restricoes;
      } else {
        delete canal.comandos[idx].restricoes;
      }
      canal.triggers = (canal.triggers || []).filter(t => t.comando !== name);
      if (trigger) canal.triggers.push({ ...trigger, comando: name });
      if (isTtsLike) {
        canal.comandos[idx].options = optionsPayload;
      }
    } else {
      // append new
      canal.comandos = canal.comandos || [];
      if (isTtsLike) {
        canal.comandos.push({ ...basePayload, ...(optionsPayload ? { options: optionsPayload } : {}) });
      } else {
        canal.comandos.push(basePayload);
      }
    }

    saveConfig(config).then(() => {
      clearEditor();
      renderCommandsList();
      alert('Salvo com sucesso');
      try { window.parent.postMessage({ type: 'configSaved' }, '*'); } catch(e){}
    }).catch(err => {
      console.error(err);
      alert('Erro ao salvar: ' + err.message);
    });
  });

  cancelBtn.addEventListener('click', (e) => { e.preventDefault(); clearEditor(); });

  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm('Excluir este comando?')) return;
    const idx = parseInt(editingIndex.value, 10);
    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    if (isNaN(idx) || !canal) return;
    canal.comandos.splice(idx, 1);
    saveConfig(config).then(() => {
      clearEditor();
      renderCommandsList();
      alert('Excluído');
      try { window.parent.postMessage({ type: 'configSaved' }, '*'); } catch(e){}
    }).catch(err => { alert('Erro ao excluir: ' + err.message); });
  });

  newBtn.addEventListener('click', addNew);
  channelSelect.addEventListener('change', onChannelChange);

  // Macros
  function renderMacros() {
    const macros = window.TextCommandsModel.getMacros();
    macrosListEl.innerHTML = '';
    macros.forEach(m => {
      const el = document.createElement('span');
      el.className = 'macro';
      el.textContent = m.name;
      el.title = m.description;
      el.onclick = () => insertMacroAtCursor(m.name);
      macrosListEl.appendChild(el);
    });
  }

  function insertMacroAtCursor(text) {
    const ta = cmdResponse;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const before = ta.value.substring(0, start);
    const after = ta.value.substring(end);
    ta.value = before + text + after;
    const pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
  }

  // init
  updateEditorLabels();
  if (currentType === 'tts' || currentType === 'chat-tts') {
    renderTtsOptionsUI({ options: parseTtsOptions(cmdOptions && cmdOptions.value ? cmdOptions.value : '') });
  }
  loadConfig().then(() => renderMacros());

})();
