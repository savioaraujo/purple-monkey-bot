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
      left.textContent = (cmd.comando || cmd.matcher || '') + ' → ' + (cmd.resposta || '');
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
      provider: 'xai',
      voice: 'eve',
      language: 'pt-br',
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
      throw new Error('JSON de options inválido. Ex.: {"provider":"xai","voice":"eve","language":"pt-br"}');
    }
  }

  function clearEditor() {
    editingIndex.value = '';
    cmdName.value = '';
    cmdResponse.value = '';
    if (cmdOptions) cmdOptions.value = '';
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
    deleteBtn.style.display = 'inline-block';
    const editorCol = document.getElementById('editorColumn');
    if (editorCol) editorCol.style.display = '';
  }

  function addNew() {
    clearEditor();
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
      if (isTtsLike) {
        canal.comandos[idx].options = optionsPayload;
      }
    } else {
      // append new
      canal.comandos = canal.comandos || [];
      if (currentType === 'texto-regex') {
        canal.comandos.push({ tipo: currentType, matcher: name, resposta: response });
      } else if (isTtsLike) {
        canal.comandos.push({ tipo: currentType, comando: name, resposta: response, options: optionsPayload });
      } else {
        canal.comandos.push({ tipo: currentType, comando: name, resposta: response });
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
  loadConfig().then(() => renderMacros());

})();
