import { setTimeout } from 'node:timers/promises';

/** Espera el formulario real; deja disponibles los desafíos para intervención manual. */
export class FormAccess {
  constructor(inspector, detector, solver, view, options) {
    Object.assign(this, { inspector, detector, solver, view, options });
  }

  async wait(page, signal) {
    const deadline = Date.now() + this.options.timeoutMs;
    let previousKind;
    let nextProgressAt = 0;
    let solverAttempted = false;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const forms = await this.inspector.inspect(page);
      if (forms.length) return forms;
      const challenge = await this.detector.inspect(page);
      const changed = challenge.kind !== previousKind;
      if (changed || Date.now() >= nextProgressAt) {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        this.view.info(`Esperando el formulario. Estado: ${challenge.kind}; quedan ${remaining} s. `
          + `Título: ${JSON.stringify(challenge.title || '(sin título)')}.`);
        if (changed && ['radware', 'captcha'].includes(challenge.kind)) {
          this.view.info('Desafío detectado; requiere una solución compatible o intervención en el navegador.');
        }
        previousKind = challenge.kind;
        nextProgressAt = Date.now() + 10000;
      }
      if (challenge.kind === 'blocked') {
        throw new Error(`La página denegó el acceso (${challenge.title || 'bloqueo explícito'}). Revisa el diagnóstico.`);
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
