class TwitchApi {
  urlFollowers = "https://api.twitch.tv/helix/channels/followers";

  constructor(clientId, clientSecret) {
    this.clientSecret = clientSecret;
    this.clientId = clientId;
  }

  async getTwitchToken() {
    try {
      const response = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
        }).toString(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      return data.access_token;
    } catch (error) {
      console.error("Erro real:", error);
    }
  }

  async getBroadcasterId(channelName) {
    try {
      // garante que temos token
      const token = await this.getTwitchToken();

      const response = await fetch(
        `https://api.twitch.tv/helix/users?login=${channelName}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Client-Id": this.clientId,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      if (!data.data.length) {
        throw new Error("Canal não encontrado");
      }

      const broadcasterId = data.data[0].id;

      console.log("Broadcaster ID:", broadcasterId);

      return broadcasterId;
    } catch (error) {
      console.error("Erro ao buscar broadcaster_id:", error);
    }
  }

  async getChannelCardData(channelName) {
    const nome = String(channelName || "").replace(/^@/, "").trim().toLowerCase();
    if (!nome) throw new Error("Canal Twitch não informado");

    const token = await this.getTwitchToken();
    if (!token) throw new Error("Não foi possível obter token da Twitch");

    const headers = {
      Authorization: `Bearer ${token}`,
      "Client-Id": this.clientId,
    };
    const usuarioResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(nome)}`,
      { headers },
    );
    const usuarioData = await usuarioResponse.json();
    if (!usuarioResponse.ok || !usuarioData.data || !usuarioData.data.length) {
      throw new Error("Canal Twitch não encontrado");
    }

    const usuario = usuarioData.data[0];
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(usuario.id)}`,
      { headers },
    );
    const streamData = await streamResponse.json();
    if (!streamResponse.ok) throw new Error(JSON.stringify(streamData));

    const stream = streamData.data && streamData.data[0];
    let nomeJogoDoCanal = null;
    if (!stream) {
      const canalResponse = await fetch(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(usuario.id)}`,
        { headers },
      );
      const canalData = await canalResponse.json();
      if (canalResponse.ok && canalData.data && canalData.data.length) {
        nomeJogoDoCanal = canalData.data[0].game_name || null;
      }
    }

    let ultimoVideo = null;
    if (!stream) {
      const videosResponse = await fetch(
        `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(usuario.id)}&first=1&type=archive`,
        { headers },
      );
      const videosData = await videosResponse.json();
      if (videosResponse.ok && videosData.data && videosData.data.length) {
        ultimoVideo = videosData.data[0];
      }
    }

    let ultimoJogo = null;
    if (!nomeJogoDoCanal && ultimoVideo && ultimoVideo.game_id) {
      const jogoResponse = await fetch(
        `https://api.twitch.tv/helix/games?id=${encodeURIComponent(ultimoVideo.game_id)}`,
        { headers },
      );
      const jogoData = await jogoResponse.json();
      if (jogoResponse.ok && jogoData.data && jogoData.data.length) {
        ultimoJogo = jogoData.data[0].name;
      }
    }

    return {
      channelName: usuario.display_name || usuario.login,
      login: usuario.login,
      profileImageUrl: usuario.profile_image_url,
      bio: usuario.description || "Este canal ainda não informou uma bio.",
      activityLabel: stream ? "Está transmitindo" : "Estava transmitindo",
      activity: stream
        ? (stream.game_name || "um jogo não identificado")
        : (nomeJogoDoCanal || ultimoJogo || "um jogo não identificado"),
      lastActivityAt: stream
        ? stream.started_at
        : (ultimoVideo && ultimoVideo.created_at) || null,
      isLive: Boolean(stream),
    };
  }
}

module.exports = TwitchApi;
