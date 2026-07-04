const puppeteer = require("puppeteer");

class TTSService {
  // mensagem: texto a falar
  // voz: nome/valor de voz usado pelo site (opcional)
  // language: código de idioma, ex: 'pt-BR' (opcional)
  async gerarAudio(mensagem, voz, language) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto("https://ttsmp3.com/text-to-speech/");

    await page.type("#voicetext", mensagem);

    try {
      await page.select("#sprachwahl", voz);
    } catch (e) {
      // ignore se a voz nao existir para o site
    }

    // alguns sites mudam com base no idioma; por enquanto não mapeamos language
    await page.click("#vorlesenbutton");
    await page.waitForFunction(
      'document.getElementById("vorlesenbutton").value == "Read"',
      { timeout: 15000 }
    );
    await browser.close();
  }
}

module.exports = TTSService;
