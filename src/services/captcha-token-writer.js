/** Aplica la respuesta del proveedor y el callback explícito del sitio. */
export class CaptchaTokenWriter {
  async write(page, token, options) {
    await page.evaluate((response, config) => {
      const controls = [...document.querySelectorAll(config.responseSelector)];
      if (!controls.length && !config.callback) {
        throw new Error('No se encontró el control de respuesta del CAPTCHA.');
      }
      for (const control of controls) {
        control.value = response;
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (config.callback) {
        const names = config.callback.split('.');
        const method = names.pop();
        const owner = names.reduce((object, name) => object?.[name], window);
        if (typeof owner?.[method] !== 'function') {
          throw new Error('CAPTCHA_CALLBACK no es una función accesible.');
        }
        owner[method](response);
      }
    }, token, options);
    if (options.submitSelector) await page.click(options.submitSelector);
  }
}
