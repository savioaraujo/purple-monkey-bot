const test = require("node:test");
const assert = require("node:assert/strict");
const TwitchRewardsService = require("../core/shared/service/twitch-rewards.service.js");

test("dispara mídia e áudio ao resgatar a recompensa vinculada", () => {
  const eventos = [];
  const database = { getConfig: () => ({ twitch: {}, canais: [{ nome: "#canal", recompensas: [{ titulo: "Dança", rewardId: "reward-1", custo: 500, midia: "/alert/sounds/danca.gif", audio: "/alert/sounds/danca.mp3", duracao: 6 }] }] }) };
  const servidor = { notificarSockets: (nome, payload) => eventos.push([nome, payload]) };
  const service = new TwitchRewardsService(database, servidor);

  assert.equal(service.processarResgate({ broadcaster_user_login: "canal", user_name: "Viewer", reward: { id: "reward-1", title: "Dança" } }), true);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0][0], "alert");
  assert.equal(eventos[0][1].tipo, "midia");
  assert.equal(eventos[0][1].usuario, "Viewer");
  assert.equal(eventos[0][1].duracao, 6);
});

test("ignora recompensa não cadastrada ou inativa", () => {
  const eventos = [];
  const database = { getConfig: () => ({ twitch: {}, canais: [{ nome: "canal", recompensas: [{ titulo: "Dança", rewardId: "reward-1", custo: 100, ativo: false }] }] }) };
  const service = new TwitchRewardsService(database, { notificarSockets: (...args) => eventos.push(args) });
  assert.equal(service.processarResgate({ broadcaster_user_login: "canal", reward: { id: "reward-1", title: "Dança" } }), false);
  assert.equal(eventos.length, 0);
});

test("atualiza e exclui recompensa pela API da Twitch", async () => {
  const chamadas = [];
  const fetch = async (url, options) => {
    chamadas.push([url, options]);
    if (options.method === "DELETE") return { ok: true, text: async () => "" };
    return { ok: true, json: async () => ({ data: [{ id: "reward-1", title: "Novo título" }] }) };
  };
  const database = { getConfig: () => ({ twitch: { clientId: "client", userAccessToken: "token", moderatorId: "broadcaster" }, canais: [] }) };
  const service = new TwitchRewardsService(database, { notificarSockets() {} }, { fetch });

  const atualizado = await service.salvarRecompensa({ rewardId: "reward-1", titulo: "Novo título", custo: 200, ativo: true });
  await service.excluirRecompensa("reward-1");

  assert.equal(atualizado.id, "reward-1");
  assert.equal(chamadas[0][1].method, "PATCH");
  assert.match(chamadas[0][0], /id=reward-1/);
  assert.equal(chamadas[1][1].method, "DELETE");
});
