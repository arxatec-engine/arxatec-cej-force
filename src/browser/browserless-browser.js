import { CdpBrowser } from './cdp-browser.js';

/** Traduce la configuración Browserless a un endpoint CDP. */
export class BrowserlessBrowser {
  constructor(options) {
    this.options = options;
  }

  async connect() {
    const endpoint = new URL(this.options.browserlessEndpoint);
    if (endpoint.protocol !== 'wss:') throw new Error('Browserless requiere WSS.');
    endpoint.searchParams.set('token', this.options.browserlessToken);
    return new CdpBrowser(endpoint.toString(), this.options.timeoutMs).connect();
  }
}
