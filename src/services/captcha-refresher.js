/** Renueva el desafío únicamente cuando el CEJ rechaza el código ingresado. */
export class CaptchaRefresher {
  async refresh(page, signal) {
    signal.throwIfAborted();
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/cej/Captcha.jpg', { signal }),
      page.click('#btnReload'),
    ]);
    if (response.status() !== 200) throw new Error(`La imagen CAPTCHA respondió HTTP ${response.status()}.`);
  }
}
