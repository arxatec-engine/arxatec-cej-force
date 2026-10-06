import { isIP } from 'node:net';

function location(data) {
  const country = data.country_code || data.countryCode || data.country?.code
    || (typeof data.country === 'string' && data.country.length === 2 ? data.country : '');
  return {
    ip: typeof data.ip === 'string' ? data.ip : data.query,
    country: String(country).toUpperCase(),
    city: typeof data.city === 'string' ? data.city : data.city?.name || null,
  };
}

/** Comprueba la IP de salida del propio Chrome antes de visitar el CEJ. */
export class ProxyVerifier {
  constructor(artifacts, view, options) {
    Object.assign(this, { artifacts, view, options });
  }

  async verify(page, signal) {
    const result = { capturedAt: new Date().toISOString(), accepted: false,
      expectedCountry: this.options.expectedCountry, httpStatus: null };
    try {
      signal?.throwIfAborted();
      this.view.info('Comprobando la IP de salida de Chrome mediante el proxy.');
      const response = await page.goto(this.options.url, { waitUntil: 'domcontentloaded' });
      signal?.throwIfAborted();
      result.httpStatus = response?.status() ?? null;
      if (result.httpStatus !== 200) throw new Error(`La comprobación de IP respondió HTTP ${result.httpStatus}.`);
      const text = await page.evaluate(() => document.querySelector('pre')?.innerText || document.body?.innerText || '');
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error('La comprobación de IP no devolvió JSON válido.');
      }
      Object.assign(result, location(data));
      if (!isIP(result.ip || '') || !/^[A-Z]{2}$/.test(result.country)) {
        throw new Error('El endpoint no informó una IP y un código de país verificables.');
      }
      if (result.country !== this.options.expectedCountry) {
        throw new Error(`El proxy salió por ${result.country}; se esperaba ${this.options.expectedCountry}. No se abrió el CEJ.`);
      }
      result.accepted = true;
      await this.artifacts.save(page, 'proxy-ip', result);
      this.view.info(`IP de Chrome verificada: ${result.ip}, país ${result.country}.`);
      return result;
    } catch (error) {
      result.error = error.message;
      if (!signal?.aborted && !page.isClosed()) await this.artifacts.save(page, 'proxy-ip', result);
      throw error;
    }
  }
}
