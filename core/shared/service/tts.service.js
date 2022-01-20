const puppeteer = require("puppeteer");

class TTSService {
  async gerarAudio(mensagem, voz) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto("https://ttsmp3.com/text-to-speech/");

    await page.type("#voicetext", mensagem);

    await page.select("#sprachwahl", voz);

    await page.click("#vorlesenbutton");
    await page.waitForFunction(
      'document.getElementById("vorlesenbutton").value == "Read"'
    );
    browser.close();
  }
}

module.exports = TTSService;
