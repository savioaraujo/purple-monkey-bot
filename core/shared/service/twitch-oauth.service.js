const crypto = require("crypto");

class TwitchOAuthService {
  constructor(canalDatabase) {
    this.canalDatabase = canalDatabase;
    this.states = new Set();
  }

  criarUrlAutorizacao(baseUrl) {
    const twitch = this.getTwitchConfig();
    const clientId = this.getClientId(twitch);
    const redirectUri = this.getRedirectUri(twitch, baseUrl);
    const scopes = this.getScopes(twitch);
    const state = crypto.randomBytes(24).toString("hex");

    if (!clientId) {
      throw new Error("Informe twitch.clientId na config.");
    }

    this.states.add(state);

    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);

    if (twitch.forceVerify) {
      url.searchParams.set("force_verify", "true");
    }

    return url.toString();
  }

  getStatus(baseUrl) {
    const twitch = this.getTwitchConfig();
    const scopes = this.getScopes(twitch);

    return {
      clientIdConfigurado: Boolean(this.getClientId(twitch)),
      clientSecretConfigurado: Boolean(this.getClientSecret(twitch)),
      redirectUri: this.getRedirectUri(twitch, baseUrl),
      scopes,
      tokenSalvo: Boolean(twitch.userAccessToken),
      refreshTokenSalvo: Boolean(twitch.refreshToken),
      tokenExpiresAt: twitch.tokenExpiresAt || "",
      moderatorId: twitch.moderatorId || "",
      moderatorLogin: twitch.moderatorLogin || "",
    };
  }

  async concluirAutorizacao(query, baseUrl) {
    if (query.error) {
      throw new Error(query.error_description || query.error);
    }

    if (!query.state || !this.states.has(query.state)) {
      throw new Error("State OAuth invalido. Tente conectar novamente.");
    }

    this.states.delete(query.state);

    if (!query.code) {
      throw new Error("Callback OAuth sem authorization code.");
    }

    const twitch = this.getTwitchConfig();
    const token = await this.trocarCodePorToken(query.code, twitch, baseUrl);
    const usuario = await this.getUsuarioAutenticado(token.access_token, twitch);

    const config = this.canalDatabase.getConfig();
    config.twitch = {
      ...(config.twitch || {}),
      userAccessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      tokenScopes: token.scope || [],
      moderatorId: usuario.id,
      moderatorLogin: usuario.login,
    };

    return this.canalDatabase.salvarConfig(config);
  }

  async trocarCodePorToken(code, twitch, baseUrl) {
    const clientId = this.getClientId(twitch);
    const clientSecret = this.getClientSecret(twitch);
    const redirectUri = this.getRedirectUri(twitch, baseUrl);

    if (!clientSecret) {
      throw new Error(
        "Informe twitch.clientSecret na config ou TWITCH_CLIENT_SECRET no ambiente."
      );
    }

    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        "Erro ao recuperar token da Twitch usando redirect_uri '" +
          redirectUri +
          "': " +
          JSON.stringify(data)
      );
    }

    return data;
  }

  async getUsuarioAutenticado(accessToken, twitch) {
    const response = await fetch("https://api.twitch.tv/helix/users", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Client-Id": this.getClientId(twitch),
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error("Erro ao recuperar usuario autenticado: " + JSON.stringify(data));
    }

    if (!data.data || !data.data.length) {
      throw new Error("A Twitch nao retornou o usuario autenticado.");
    }

    return data.data[0];
  }

  getTwitchConfig() {
    return this.canalDatabase.getConfig().twitch || {};
  }

  getClientId(twitch) {
    return twitch.clientId || process.env.TWITCH_CLIENT_ID || "";
  }

  getClientSecret(twitch) {
    return twitch.clientSecret || process.env.TWITCH_CLIENT_SECRET || "";
  }

  getRedirectUri(twitch, baseUrl) {
    return twitch.redirectUri || baseUrl + "/auth/twitch/callback";
  }

  getScopes(twitch) {
    return twitch.scopes || ["chat:read", "chat:edit", "moderator:read:chatters", "moderator:read:followers"];
  }
}

module.exports = TwitchOAuthService;
