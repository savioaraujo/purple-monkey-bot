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
      if (cmd.trigger && cmd.trigger.tipo) {
        metaParts.push('trigger: ' + cmd.trigger.tipo + (cmd.trigger.usuario ? ' / ' + cmd.trigger.usuario : ''));
      }
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

  async function carregarOpcoesTts(providerAtual = 'puter', languageAtual = 'pt-BR') {
    const options = await fetch('/api/tts/options?provider=' + encodeURIComponent(providerAtual) + '&language=' + encodeURIComponent(languageAtual)).then(r => r.json());
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

    const atualizarOpcoes = async () => {
      const provider = providerSelect.value || 'puter';
      const language = languageSelect.value || 'pt-BR';
      const api = await carregarOpcoesTts(provider, language);
      preencherSelect(languageSelect, api.languages || [], language);
      preencherSelect(voiceSelect, api.voices || [], (defOptions.voice || api.voices && api.voices[0]));
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

    providerSelect.addEventListener('change', atualizarOpcoes);
    languageSelect.addEventListener('change', atualizarOpcoes);

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
    if (triggerTipo) triggerTipo.value = cmd.trigger && cmd.trigger.tipo ? cmd.trigger.tipo : '';
    if (triggerUsuario) triggerUsuario.value = cmd.trigger && cmd.trigger.usuario ? cmd.trigger.usuario : '';
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
    const languageSelect = document.createElement('select');
    const voiceSelect = document.createElement('select');

    const providerWrap = document.createElement('div');
    const languageWrap = document.createElement('div');
    const voiceWrap = document.createElement('div');
    providerWrap.innerHTML = '<label>Provider</label>';
    languageWrap.innerHTML = '<label>Idioma</label>';
    voiceWrap.innerHTML = '<label>Voz</label>';

    const fill = (select, values, selected) => {
      select.innerHTML = '';
      values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
      if (selected && values.includes(selected)) {
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
        language: languageSelect.value,
        voice: voiceSelect.value,
        model: null,
        instructions: null,
      }, null, 2);
    };

    providerSelect.addEventListener('change', async () => {
      const data = await carregarOpcoesTts(providerSelect.value || 'puter', 'pt-BR');
      fill(languageSelect, data.languages || [], (data.languages || [])[0] || 'pt-BR');
      fill(voiceSelect, data.voices || [], (data.voices || [])[0] || 'Vitoria');
      setJsonValue();
    });

    languageSelect.addEventListener('change', async () => {
      const data = await carregarOpcoesTts(providerSelect.value || 'puter', languageSelect.value || 'pt-BR');
      fill(voiceSelect, data.voices || [], (data.voices || [])[0] || 'Vitoria');
      setJsonValue();
    });

    voiceSelect.addEventListener('change', setJsonValue);

    carregarOpcoesTts(providerSelect.value || 'puter', parsed.language || 'pt-BR').then((data) => {
      fill(languageSelect, data.languages || [], parsed.language || 'pt-BR');
      fill(voiceSelect, data.voices || [], parsed.voice || 'Vitoria');
      setJsonValue();
    });

    providerWrap.appendChild(providerSelect);
    languageWrap.appendChild(languageSelect);
    voiceWrap.appendChild(voiceSelect);

    target.appendChild(providerWrap);
    target.appendChild(languageWrap);
    target.appendChild(voiceWrap);
    parent.insertBefore(target, cmdOptions);
  }

  editorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (cmdName.value || '').trim();
    const response = (cmdResponse.value || '').trim();
    const isTtsLike = currentType === 'tts' || currentType === 'chat-tts';

    if (!name || (!response && !isTtsLike)) {
      alert(currentType === 'texto-regex' ? 'Regex e resposta são obrigatórios' : isTtsLike ? 'Nome é obrigatório' : 'Nome e resposta são obrigatórios');
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
      resposta: response,
      ...(restricoes ? { restricoes } : {}),
      ...(trigger ? { trigger } : {})
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
      if (trigger) {
        canal.comandos[idx].trigger = trigger;
      } else {
        delete canal.comandos[idx].trigger;
      }
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
