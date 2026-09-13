class TTSOptionsService {
  constructor() {
    this.providers = {
      puter: {
        label: "Puter",
        languages: [
          "pt-BR",
          "en-US",
          "es-ES",
          "fr-FR",
          "de-DE",
          "it-IT",
          "ja-JP",
          "ko-KR",
          "pt-PT",
          "en-GB",
          "en-AU",
          "es-MX",
          "fr-CA",
          "nl-NL",
          "ar-AE",
          "ru-RU",
        ],
        voices: {
          "pt-BR": ["Vitoria", "Bianca", "Camila", "Thiago", "Ricardo", "Mia", "Jasmine"],
          "en-US": ["Aria", "Matthew", "Daniel", "Emma", "Niamh", "Salli"],
          "es-ES": ["Arlet", "Conchita", "Carmen", "Enrique"],
          "fr-FR": ["Chantal", "Hannah", "Lea", "Mathieu"],
          "de-DE": ["Marlene", "Hans", "Klaus", "Vicki"],
          "it-IT": ["Giorgio", "Carla", "Bianca", "Sofia"],
          "ja-JP": ["Takumi", "Mizuki", "Kazuha"],
          "ko-KR": ["Seoyeon", "Nari", "Jin"],
          "pt-PT": ["Vitoria", "Bianca", "Ricardo", "Carmen"],
          "en-GB": ["Aria", "Daniel", "Emma"],
          "en-AU": ["Aria", "Daniel", "Emma"],
          "es-MX": ["Mia", "Arlet", "Camila"],
          "fr-CA": ["Chantal", "Lea", "Hannah"],
          "nl-NL": ["Lisa", "Marlene", "Carmen"],
          "ar-AE": ["Zayd", "Aditi", "Hala"],
          "ru-RU": ["Tatyana", "Maxim", "Nika"],
        },
      },
      local: {
        label: "Local",
        languages: ["pt-BR", "en-US"],
        voices: {
          "pt-BR": ["Microsoft Maria Desktop", "Microsoft Daniel Desktop", "Microsoft Zira Desktop"],
          "en-US": ["Microsoft Aria Desktop", "Microsoft Zira Desktop", "Microsoft David Desktop"],
        },
      },
    };
  }

  getProviders() {
    return Object.entries(this.providers).map(([value, config]) => ({
      value,
      label: config.label,
    }));
  }

  getLanguages(provider = "puter") {
    const config = this.providers[provider] || this.providers.puter;
    return [...config.languages];
  }

  getVoices(provider = "puter", language = "pt-BR") {
    const config = this.providers[provider] || this.providers.puter;
    const refLanguage = this.normalizeLanguage(language);
    const voices = config.voices && config.voices[refLanguage];
    return voices ? [...voices] : [...(config.voices && Object.values(config.voices).flat()) || []];
  }

  getOptions(provider = "puter", language = "pt-BR") {
    const normalizedProvider = this.normalizeProvider(provider);
    const normalizedLanguage = this.normalizeLanguage(language);
    const languages = this.getLanguages(normalizedProvider);
    const selectedLanguage = languages.includes(normalizedLanguage) ? normalizedLanguage : languages[0];
    return {
      providers: this.getProviders(),
      provider: normalizedProvider,
      languages,
      language: selectedLanguage,
      voices: this.getVoices(normalizedProvider, selectedLanguage),
    };
  }

  normalizeProvider(provider) {
    const value = String(provider || "puter").trim();
    if (value.toLowerCase() === "local") return "local";
    return value && this.providers[value.toLowerCase()] ? value.toLowerCase() : "puter";
  }

  normalizeLanguage(language) {
    const value = String(language || "pt-BR").trim();
    const map = {
      "pt-br": "pt-BR",
      "pt_br": "pt-BR",
      "en-us": "en-US",
      "en_us": "en-US",
      "es-es": "es-ES",
      "es_es": "es-ES",
      "fr-fr": "fr-FR",
      "fr_fr": "fr-FR",
      "de-de": "de-DE",
      "de_de": "de-DE",
      "it-it": "it-IT",
      "it_it": "it-IT",
      "ja-jp": "ja-JP",
      "ja_jp": "ja-JP",
      "ko-kr": "ko-KR",
      "ko_kr": "ko-KR",
      "pt-pt": "pt-PT",
      "pt_pt": "pt-PT",
      "en-gb": "en-GB",
      "en_gb": "en-GB",
      "en-au": "en-AU",
      "en_au": "en-AU",
      "es-mx": "es-MX",
      "es_mx": "es-MX",
      "fr-ca": "fr-CA",
      "fr_ca": "fr-CA",
      "nl-nl": "nl-NL",
      "nl_nl": "nl-NL",
      "ar-ae": "ar-AE",
      "ar_ae": "ar-AE",
      "ru-ru": "ru-RU",
      "ru_ru": "ru-RU",
    };
    return map[value] || value || "pt-BR";
  }

  normalizeVoice(voice, provider = "puter", language = "pt-BR") {
    const providerNormalized = this.normalizeProvider(provider);
    const languageNormalized = this.normalizeLanguage(language);
    const candidates = this.getVoices(providerNormalized, languageNormalized);
    const value = String(voice || "").trim();
    if (!value) {
      return candidates[0] || "Vitoria";
    }
    return candidates.includes(value) ? value : (candidates[0] || "Vitoria");
  }

  normalize(voice, language, provider = "puter") {
    return {
      provider: this.normalizeProvider(provider),
      language: this.normalizeLanguage(language),
      voice: this.normalizeVoice(voice, provider, language),
    };
  }
}

module.exports = TTSOptionsService;
