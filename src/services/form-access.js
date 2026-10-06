import { setTimeout } from 'node:timers/promises';

/** Espera el formulario real; deja disponibles los desafíos para intervención manual. */
export class FormAccess {
  constructor(inspector, detector, solver, view, options) {
    Object.assign(this, { inspector, detector, solver, view, options });
  }

  async wait(page, signal) {
    const deadline = Date.now() + this.options.timeoutMs;
    let previousKind;
    let solverAttempted = false;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const forms = await this.inspector.inspect(page);
      if (forms.length) return forms;
      const challenge = await this.detector.inspect(page);
      if (challenge.kind !== previousKind) {
        this.view.info(`Esperando el formulario. Estado: ${challenge.kind}.`);
        if (challenge.kind !== 'loading') {
          this.view.info('El navegador queda abierto: puedes completar el desafío manualmente.');
        }
        previousKind = challenge.kind;
      }
      if (this.solver && !solverAttempted && await this.solver.canSolve(page)) {
        solverAttempted = true;
        this.view.info('Resolviendo el CAPTCHA con el adaptador configurado.');
        await this.solver.solve(page, { signal, timeoutMs: deadline - Date.now() });
      }
      await setTimeout(this.options.pollIntervalMs, undefined, { signal });
    }
    throw new Error(`No apareció el formulario en ${this.options.timeoutMs} ms. `
      + 'Revisa el diagnóstico; puede persistir Radware o cambiar el selector.');
  }
}
