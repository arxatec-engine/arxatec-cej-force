import { FormSnapshot } from '../models/form-snapshot.js';

/** Coordina navegación, acceso, interacción y exportación del formulario. */
export class FormController {
  constructor({ access, interactor, artifacts, view, target, actions }) {
    Object.assign(this, { access, interactor, artifacts, view, target, actions });
  }

  async capture(page, signal) {
    let status;
    try {
      signal.throwIfAborted();
      this.view.info(`Abriendo ${this.target.url}`);
      const reuse = this.target.reuseLoadedPage && /^https?:/.test(page.url());
      const response = reuse ? null
        : await page.goto(this.target.url, { waitUntil: 'domcontentloaded' });
      status = response?.status() ?? null;
      if (status === 403 || status === 429 || status >= 500) {
        throw new Error(`El servidor respondió HTTP ${status}; se detuvo la navegación.`);
      }
      const initial = await this.artifacts.save(page, 'acceso-inicial', {
        capturedAt: new Date().toISOString(), url: page.url(),
        title: await page.title(), httpStatus: status,
      });
      this.view.info(`Captura inicial del navegador: ${initial.screenshot}`);
      await this.access.wait(page, signal);
      await this.interactor.run(page, this.actions, signal);
      const forms = await this.access.wait(page, signal);
      const snapshot = new FormSnapshot({
        url: page.url(), title: await page.title(), forms, httpStatus: status,
      });
      const files = await this.artifacts.save(page, 'formulario', snapshot);
      this.view.form(snapshot, files);
      return snapshot;
    } catch (error) {
      if (!signal.aborted && !page.isClosed()) {
        try {
          const files = await this.artifacts.diagnostic(page, error, status);
          this.view.info(`Diagnóstico guardado: ${files.json}`);
        } catch (diagnosticError) {
          this.view.error(diagnosticError);
        }
      }
      throw error;
    }
  }
}
