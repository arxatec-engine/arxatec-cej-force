import { QueryResult } from '../models/query-result.js';

/** Coordina la consulta y su fase opcional de validación de identidad. */
export class QueryController {
  constructor({ form, solver, modal, identity, refresher, artifacts, view, data, options }) {
    Object.assign(this, { form, solver, modal, identity, refresher, artifacts, view, data, options });
  }

  async run(page, signal) {
    try {
      signal.throwIfAborted();
      if (!this.solver) throw new Error('La consulta requiere CAPTCHA_MODE=ocr o 2captcha.');
      const actual = await this.form.fill(page, this.data, signal);
      this.view.info('Datos de la consulta ingresados y comprobados.');
      for (let attempt = 1; attempt <= this.options.attempts; attempt++) {
        const reading = await this.solver.solve(page, { signal });
        const captcha = reading || {
          method: '2captcha', code: await page.$eval('#codigoCaptcha', input => input.value),
        };
        await this.artifacts.save(page, 'consulta-preparada', { query: actual, captcha });
        signal.throwIfAborted();
        await page.click('#consultarExpedientes');
        this.view.info('Consultar pulsado; esperando la validación de identidad.');
        try {
          const modal = await this.modal.wait(page, signal);
          const result = new QueryResult(page.url(), actual, captcha, modal);
          const files = await this.artifacts.save(page, 'validacion-identidad', result);
          this.view.info(`Validación de identidad visible. Captura: ${files.screenshot}`);
          if (this.identity) result.completeIdentity(await this.identity.run(page, signal));
          await this.artifacts.save(page, 'consulta-final', result);
          return result;
        } catch (error) {
          if (error.name !== 'CaptchaRejectedError' || attempt === this.options.attempts) throw error;
          this.view.info(`El CEJ rechazó el CAPTCHA; renovando el desafío (${attempt + 1}).`);
          if (!error.alreadyRefreshed) await this.refresher.refresh(page, signal);
        }
      }
    } catch (error) {
      if (!signal.aborted && !page.isClosed()) {
        try {
          const files = await this.artifacts.diagnostic(page, error, null);
          this.view.info(`Diagnóstico de consulta: ${files.json}`);
        } catch (diagnosticError) {
          this.view.error(diagnosticError);
        }
      }
      throw error;
    }
  }
}
