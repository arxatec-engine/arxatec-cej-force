import { mkdir, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Captura exclusivamente la imagen vigente sin solicitar un nuevo CAPTCHA. */
export class CaptchaImage {
  constructor(selector, file) {
    Object.assign(this, { selector, file });
  }

  async capture(page, signal) {
    signal.throwIfAborted();
    const loaded = await page.waitForFunction(selector => {
      const image = document.querySelector(selector);
      return image?.complete && image.naturalWidth > 0;
    }, { signal, polling: 200 }, this.selector);
    await loaded.dispose();
    const image = await page.waitForSelector(this.selector, { visible: true });
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const buffer = await image.screenshot({ path: this.file });
      await chmod(this.file, 0o600);
      return Buffer.from(buffer);
    } finally {
      await image.dispose();
    }
  }
}
