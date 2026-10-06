/** Ejecuta interacciones DOM configuradas, sin enviar búsquedas por defecto. */
export class FormInteractor {
  constructor(solver = null) {
    this.solver = solver;
  }

  async run(page, actions, signal) {
    for (const action of actions) {
      signal.throwIfAborted();
      const target = action.frameUrl
        ? page.frames().find(frame => frame.url() === action.frameUrl) : page;
      if (!target) throw new Error(`No se encontró el frame ${action.frameUrl}.`);
      if (action.type === 'captcha') {
        if (!this.solver) throw new Error('La acción captcha requiere CAPTCHA_MODE=ocr o 2captcha.');
        await this.solver.solve(target, { signal });
        continue;
      }
      const element = await target.waitForSelector(action.selector, {
        visible: action.visible ?? action.type !== 'wait',
      });
      await element?.dispose();
      if (action.type === 'fill') {
        await target.locator(action.selector).fill(action.value);
      } else if (action.type === 'select') {
        await target.select(action.selector, action.value);
      } else if (action.type === 'click') {
        if (action.waitForNavigation) {
          await Promise.all([
            target.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            target.click(action.selector),
          ]);
        } else {
          await target.click(action.selector);
        }
      } else if (action.type !== 'wait') {
        throw new Error(`Acción desconocida: ${action.type}.`);
      }
      if (action.waitForSelector) {
        const result = await target.waitForSelector(action.waitForSelector, { visible: true });
        await result?.dispose();
      }
    }
  }
}
