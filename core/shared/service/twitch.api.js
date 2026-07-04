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

  async getLoggedFollowers() {
    try {
      const token = await this.getTwitchToken();
      const broadcast = await this.getBroadcasterId("BalderKing");
      const broadcastbot = await this.getBroadcasterId("purplemonkeybot");
      const response = await fetch(
        `${this.urlFollowers}?broadcaster_id=${broadcast}&moderator_id=${broadcastbot}`,
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

      console.log("Dados recebidos:", data.data);
    } catch (error) {
      console.error("Erro na requisição:", error);
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
}

module.exports = TwitchApi;
