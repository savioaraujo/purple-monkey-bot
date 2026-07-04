class TwitchChattersService {
  constructor(config) {
    this.config = config || {};
    this.cache = new Map();
    this.cacheTtlMs = this.config.cacheTtlMs || 30000;
  }

  atualizarConfig(config) {
    this.config = config || {};
    this.cache.clear();
  }

  async getRandomViewer(channelName, ignoredLogins) {
    const viewers = await this.getChatters(channelName);
    const ignored = new Set((ignoredLogins || []).filter(Boolean).map((login) => login.toLowerCase()));
    const elegiveis = viewers.filter((viewer) => !ignored.has(viewer.user_login.toLowerCase()));

    if (!elegiveis.length) {
      return "";
    }

    const index = Math.floor(Math.random() * elegiveis.length);
    return elegiveis[index].user_name || elegiveis[index].user_login;
  }

  async getRandomFollower(channelName, ignoredLogins) {
    try {
      const channel = channelName.replace("#", "").toLowerCase();
      console.log(`Obtendo seguidores do canal ${channelName}...`);
      const broadcasterId = await this.getBroadcasterId(channel, this.getClientId(), this.getUserAccessToken());
      if (!broadcasterId) {
        return "";
      }

      const followers = await this.getFollowers(broadcasterId);
      const ignored = new Set((ignoredLogins || []).filter(Boolean).map((login) => login.toLowerCase()));
      const elegiveis = followers.filter((follower) => !ignored.has(follower.from_login.toLowerCase()));

      if (!elegiveis.length) {
        return "";
      }

      const index = Math.floor(Math.random() * elegiveis.length);
      return elegiveis[index].from_name || elegiveis[index].from_login;
    } catch (error) {
      console.error("Erro ao resolver macro {{random_follow}}:", error);
      return "";
    }
  }

  async getFollowers(broadcasterId) {
    const cacheKey = "followers:" + broadcasterId;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < this.cacheTtlMs) {
      return cached.data;
    }

    const followers = [];
    let after;
    const clientId = this.getClientId();
    const userAccessToken = this.getUserAccessToken();

    if (!clientId || !userAccessToken) {
      console.warn(
        "Macro {{random_follow}} sem TWITCH_CLIENT_ID ou TWITCH_USER_ACCESS_TOKEN configurado."
      );
      return followers;
    }

    do {
      const url = new URL("https://api.twitch.tv/helix/channels/followers");
      url.searchParams.set("broadcaster_id", broadcasterId);
      url.searchParams.set("first", "100");
      if (after) {
        url.searchParams.set("after", after);
      }

      const data = await this.fetchTwitch(url, clientId, userAccessToken);
      followers.push(...(data.data || []));
      after = data.pagination && data.pagination.cursor;
    } while (after && followers.length < 1000);
    console.log(`Obtidos ${followers.length} seguidores do canal ${broadcasterId}`);
    return followers;
  }

  async getChatters(channelName) {
    const channel = channelName.replace("#", "").toLowerCase();
    const cacheKey = "chatters:" + channel;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < this.cacheTtlMs) {
      return cached.data;
    }

    const clientId = this.getClientId();
    const userAccessToken = this.getUserAccessToken();

    if (!clientId || !userAccessToken) {
      console.warn(
        "Macro {{random_viewer}} sem TWITCH_CLIENT_ID ou TWITCH_USER_ACCESS_TOKEN configurado."
      );
      return [];
    }

    const broadcasterId = await this.getBroadcasterId(channel, clientId, userAccessToken);
    const moderatorId = await this.getModeratorId(clientId, userAccessToken);

    if (!broadcasterId || !moderatorId) {
      return [];
    }

    const chatters = await this.getAllChatters(broadcasterId, moderatorId, clientId, userAccessToken);
    this.cache.set(cacheKey, { createdAt: Date.now(), data: chatters });
    return chatters;
  }

  async getAllChatters(broadcasterId, moderatorId, clientId, userAccessToken) {
    const chatters = [];
    let after;

    do {
      const url = new URL("https://api.twitch.tv/helix/chat/chatters");
      url.searchParams.set("broadcaster_id", broadcasterId);
      url.searchParams.set("moderator_id", moderatorId);
      url.searchParams.set("first", "1000");
      if (after) {
        url.searchParams.set("after", after);
      }

      const data = await this.fetchTwitch(url, clientId, userAccessToken);
      chatters.push(...(data.data || []));
      after = data.pagination && data.pagination.cursor;
    } while (after);

    return chatters;
  }

  async getBroadcasterId(channelName, clientId, userAccessToken) {
    const ids = this.config.broadcasterIdsByChannel || {};
    if (ids[channelName]) {
      return ids[channelName];
    }

    return this.getUserId(channelName, clientId, userAccessToken);
  }

  async getModeratorId(clientId, userAccessToken) {
    if (this.config.moderatorId) {
      return this.config.moderatorId;
    }

    if (this.config.moderatorLogin) {
      return this.getUserId(this.config.moderatorLogin, clientId, userAccessToken);
    }

    if (this.config.botUsername) {
      return this.getUserId(this.config.botUsername, clientId, userAccessToken);
    }

    return "";
  }

  async getUserId(login, clientId, userAccessToken) {
    const userCacheKey = "user:" + login.toLowerCase();
    const cached = this.cache.get(userCacheKey);
    if (cached) {
      return cached.data;
    }

    const url = new URL("https://api.twitch.tv/helix/users");
    url.searchParams.set("login", login);

    const data = await this.fetchTwitch(url, clientId, userAccessToken);
    const user = data.data && data.data[0];
    const userId = user ? user.id : "";
    this.cache.set(userCacheKey, { createdAt: Date.now(), data: userId });
    return userId;
  }

  async fetchTwitch(url, clientId, userAccessToken) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + userAccessToken,
        "Client-Id": clientId,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error("Erro Twitch API: " + JSON.stringify(data));
    }

    return data;
  }

  getClientId() {
    return this.config.clientId || process.env.TWITCH_CLIENT_ID || "";
  }

  getUserAccessToken() {
    const token = this.config.userAccessToken || process.env.TWITCH_USER_ACCESS_TOKEN || "";
    return token.replace(/^oauth:/, "");
  }
}

module.exports = TwitchChattersService;
