import puppeteer from 'puppeteer-core';

/** Conecta a un navegador externo; libera solo la conexión de este bot. */
export class CdpBrowser {
  constructor(endpoint, timeoutMs) {
    const url = new URL(endpoint);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
      throw new Error('El endpoint CDP debe usar HTTP(S) o WS(S).');
    }
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  async connect() {
    const browser = await puppeteer.connect({
      ...(this.endpoint.startsWith('http')
        ? { browserURL: this.endpoint }
        : { browserWSEndpoint: this.endpoint }),
      defaultViewport: null,
      protocolTimeout: this.timeoutMs,
    });
    return { browser, release: () => browser.disconnect() };
  }
}
