/** Obtiene el texto ofrecido por el botón accesible de audio del CEJ. */
export class CaptchaAudio {
  async read(page, signal) {
    signal.throwIfAborted();
    const [response] = await Promise.all([page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === new URL(page.url()).origin && url.pathname === '/cej/xyhtml';
    }, { signal }), page.click('#btnRepro')]);
    if (response.status() !== 200) throw new Error(`El audio CAPTCHA respondió HTTP ${response.status()}.`);
    const code = await page.evaluate(html => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      return (document.querySelector('[id="1zirobotz0"]')?.value || '').replace(/\s/g, '').toUpperCase();
    }, await response.text());
    if (!/^[A-Z0-9]{4}$/.test(code)) throw new Error('El audio no entregó un código de cuatro caracteres.');
    return code;
  }
}
