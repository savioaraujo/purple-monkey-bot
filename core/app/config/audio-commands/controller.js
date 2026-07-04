// Controller for Audio Commands MVC
(function () {
  const channelSelect = document.getElementById('channelSelect');
  const commandsList = document.getElementById('commandsList');
  const newBtn = document.getElementById('newBtn');
  const editorForm = document.getElementById('editorForm');
  const cmdName = document.getElementById('cmdName');
  const cmdAudio = document.getElementById('cmdAudio');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const editingIndex = document.getElementById('editingIndex');
  const cancelBtn = document.getElementById('cancelBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  let config = null;
  let currentChannel = null;

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
    return (canal.comandos || []).filter(cmd => cmd.tipo === 'audio');
  }

  function renderCommandsList() {
    commandsList.innerHTML = '';
    const items = getCommandsForChannel(currentChannel);
    items.forEach((cmd, idx) => {
      const div = document.createElement('div');
      div.className = 'command-item';
      const left = document.createElement('div');
      left.textContent = cmd.comando + ' → ' + (cmd.audio || '');
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

  function clearEditor() {
    editingIndex.value = '';
    cmdName.value = '';
    cmdAudio.value = '';
    deleteBtn.style.display = 'none';
    const editorCol = document.getElementById('editorColumn');
    if (editorCol) editorCol.style.display = 'none';
  }

  function editCommand(idx) {
    const items = getCommandsForChannel(currentChannel);
    const cmd = items[idx];
    if (!cmd) return;
    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    const globalIndex = canal.comandos.findIndex(c => c === cmd);
    editingIndex.value = String(globalIndex);
    cmdName.value = cmd.comando || '';
    cmdAudio.value = cmd.audio || '';
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

  editorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (cmdName.value || '').trim();
    const audio = (cmdAudio.value || '').trim();
    if (!name || !audio) { alert('Nome do comando e áudio são obrigatórios'); return; }
    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    if (!canal) return alert('Canal inválido');
    const idx = editingIndex.value ? parseInt(editingIndex.value, 10) : -1;
    if (idx >= 0) {
      canal.comandos[idx].comando = name;
      canal.comandos[idx].audio = audio;
    } else {
      canal.comandos = canal.comandos || [];
      canal.comandos.push({ tipo: 'audio', comando: name, audio: audio });
    }
    saveConfig(config).then(() => { clearEditor(); renderCommandsList(); alert('Salvo com sucesso'); try { window.parent.postMessage({ type: 'configSaved' }, '*'); } catch(e){} }).catch(err => { alert('Erro: ' + err.message); });
  });

  cancelBtn.addEventListener('click', (e) => { e.preventDefault(); clearEditor(); });

  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm('Excluir este comando?')) return;
    const idx = parseInt(editingIndex.value, 10);
    const canal = (config.canais || []).find(c => c.nome === currentChannel);
    if (isNaN(idx) || !canal) return;
    canal.comandos.splice(idx, 1);
    saveConfig(config).then(() => { clearEditor(); renderCommandsList(); alert('Excluído'); try { window.parent.postMessage({ type: 'configSaved' }, '*'); } catch(e){} }).catch(err => { alert('Erro: ' + err.message); });
  });

  uploadBtn.addEventListener('click', async () => {
    if (!fileInput.files || !fileInput.files[0]) return alert('Escolha um arquivo.');
    const f = fileInput.files[0];
    const arr = await readFileAsBase64(f);
    const resp = await fetch('/api/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filename: f.name, data: arr }) });
    const body = await resp.json();
    if (!resp.ok) { alert(body.erro || 'Erro no upload'); return; }
    cmdAudio.value = body.path;
    alert('Arquivo enviado e campo preenchido');
  });

  function readFileAsBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => { const raw = r.result.split(',')[1]; res(raw); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  newBtn.addEventListener('click', addNew);
  channelSelect.addEventListener('change', onChannelChange);

  loadConfig().then(() => renderCommandsList());

})();
