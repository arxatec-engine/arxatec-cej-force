import { CaptchaClient } from '../infrastructure/captcha-client.js';

/** Adapta solicitudes explícitas de CAPTCHA al SDK oficial de 2Captcha. */
export class TwoCaptchaSolver {
  constructor(options, writer, client = new CaptchaClient(options.apiKey, options.timeoutMs)) {
    this.options = options;
    this.writer = writer;
    this.client = client;
  }

  async canSolve(page) {
    const element = await page.$(this.options.triggerSelector);
    await element?.dispose();
    return Boolean(element);
  }

  async solve(page, execution) {
    const { type, siteKey, triggerSelector, imageSelector } = this.options;
    let result;
    if (type === 'image') {
      if (!imageSelector) throw new Error('Falta CAPTCHA_IMAGE_SELECTOR.');
      const image = await page.waitForSelector(imageSelector, { visible: true });
      try {
        const body = await image.screenshot({ encoding: 'base64' });
        result = await this.client.execute('imageCaptcha', { body }, execution);
      } finally {
        await image.dispose();
      }
    } else {
      const key = siteKey || await page.$eval(triggerSelector, node => node.dataset.sitekey);
      if (!key) throw new Error('Falta CAPTCHA_SITE_KEY y el widget no tiene data-sitekey.');
      const pageurl = page.url();
      result = type === 'recaptcha'
        ? await this.client.execute('recaptcha', { googlekey: key, pageurl }, execution)
        : await this.client.execute('cloudflareTurnstile', { sitekey: key, pageurl }, execution);
    }
    if (typeof result.data !== 'string' || !result.data) {
      throw new Error('2Captcha no devolvió una respuesta válida.');
    }
    execution?.signal?.throwIfAborted();
    await this.writer.write(page, result.data, this.options);
  }
}
