// Client-side model for Text Commands MVC
window.TextCommandsModel = (function () {
  const macros = [
    { name: '{{username}}', description: 'Login do usuário que acionou o comando' },
    { name: '{{displayName}}', description: 'Nome exibido do usuário' },
    { name: '{{channel}}', description: 'Nome do canal' },
    { name: '{{message}}', description: 'Mensagem completa que disparou o comando' },
    { name: '{{random_viewer}}', description: 'Seleciona aleatoriamente um espectador presente' },
    { name: '{{random_follow}}', description: 'Seleciona aleatoriamente um seguidor do canal' },
    { name: '{{random_pick_animais}}', description: 'Seleciona um valor aleatório de uma lista cadastrada' },
    { name: '{{g1}}', description: 'Grupo 1 capturado por regex (quando aplicável)' }
  ];

  return {
    getMacros: () => macros
  };
})();
