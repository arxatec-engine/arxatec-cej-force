/** Selecciona por etiqueta, esperando a que lleguen opciones cargadas mediante AJAX. */
export class SelectOption {
  async byText(page, selector, label, signal) {
    signal.throwIfAborted();
    const option = await page.waitForFunction((css, expected) => {
      const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim().toUpperCase();
      const select = document.querySelector(css);
      return [...(select?.options || [])]
        .find(item => !item.disabled && normalize(item.textContent) === normalize(expected))?.value;
    }, { signal, polling: 200 }, selector, label);
    const value = await option.jsonValue();
    await option.dispose();
    signal.throwIfAborted();
    const selected = await page.select(selector, value);
    if (!selected.includes(value)) throw new Error(`No se pudo seleccionar ${label} en ${selector}.`);
  }
}
