/** Verifica que Consultar abrió la ventana de identidad con sus controles reales. */
export class IdentityModal {
  constructor(timeoutMs) {
    this.timeoutMs = timeoutMs;
  }

  async wait(page, signal) {
    const state = await page.waitForFunction(() => {
      const visible = node => Boolean(node?.getClientRects().length)
        && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
      const modal = document.querySelector('#modalValidacion');
      const title = (modal?.querySelector('.modal-title')?.textContent || '').replace(/\s+/g, ' ').trim();
      const controls = ['tipoDocumento', 'numDocumento', 'fechaEmision', 'fechaNacimiento'];
      if (visible(modal)
        && /VALIDACI[ÓO]N DE IDENTIDAD DEL CONSULTANTE/i.test(title)
        && controls.every(id => visible(modal.querySelector(`[id="${id}"]`)))) {
        return Number(getComputedStyle(modal).opacity) >= 0.99 ? { ready: true } : false;
      }
      const error = document.querySelector('#codCaptchaError');
      if (visible(error) && error.textContent.trim()) return { captchaError: error.textContent.trim() };
      return false;
    }, { signal, polling: 200, timeout: this.timeoutMs });
    const result = await state.jsonValue();
    await state.dispose();
    if (result.captchaError) {
      const error = new Error(result.captchaError);
      error.name = 'CaptchaRejectedError';
      throw error;
    }
    return page.$eval('#modalValidacion', modal => ({
      selector: '#modalValidacion', title: modal.querySelector('.modal-title').textContent.trim(),
      fields: [...modal.querySelectorAll('input, select')].map(field => ({
        id: field.id, type: field.type, value: field.value, disabled: field.disabled,
      })),
    }));
  }
}
