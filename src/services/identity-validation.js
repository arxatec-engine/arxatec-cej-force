/** Pulsa Validar una vez y obtiene la respuesta real del mismo origen. */
export class IdentityValidation {
  constructor(timeoutMs) {
    this.timeoutMs = timeoutMs;
  }

  async submit(page, signal) {
    signal.throwIfAborted();
    const origin = new URL(page.url()).origin;
    const previousImage = await page.$eval('#captcha_image', image => image.src);
    const [response] = await Promise.all([
      page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.origin === origin && url.pathname.endsWith('/ValidarConsultante.htm')
          && response.request().method() === 'POST';
      }, { signal, timeout: this.timeoutMs }),
      page.locator('#btnValidarConsultante').click({ signal }),
    ]);
    if (!response.ok()) throw new Error(`La validación respondió HTTP ${response.status()}.`);
    let result;
    try { result = JSON.parse(await response.text()); } catch {
      throw new Error('El CEJ devolvió una respuesta de validación que no es JSON.');
    }
    if (typeof result?.status !== 'string' || !result.status) {
      throw new Error('El CEJ no informó el estado de la validación.');
    }
    const state = await page.waitForFunction((status, previousImage) => {
      const visible = element => Boolean(element?.getClientRects().length)
        && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
      if (status === 'OK') return visible(document.querySelector('#modalExito'));
      if (status === 'CAPTCHA_ERROR') {
        const image = document.querySelector('#captcha_image');
        return !visible(document.querySelector('#modalValidacion'))
          && image?.complete && image.naturalWidth > 0 && image.src !== previousImage;
      }
      return visible(document.querySelector('#mensajeErrorValidacion'));
    }, { signal, timeout: this.timeoutMs, polling: 100 }, result.status, previousImage);
    await state.dispose();
    return { accepted: result.status === 'OK', status: result.status,
      message: typeof result.message === 'string' ? result.message : '', httpStatus: response.status() };
  }
}
