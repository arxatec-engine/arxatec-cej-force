/** Administra la pestaña propia, la configuración y la sesión persistente. */
export class BrowserSession {
  constructor(provider, cookies, options) {
    this.provider = provider;
    this.cookies = cookies;
    this.options = options;
  }

  async open(signal) {
    this.connection = await this.provider.connect(signal);
    const { browser } = this.connection;
    this.context = browser.defaultBrowserContext();
    await this.cookies.restore(this.context);
    this.page = this.connection.page || await this.context.newPage();
    this.page.setDefaultTimeout(this.options.timeoutMs);
    this.page.setDefaultNavigationTimeout(this.options.timeoutMs);
    await this.page.bringToFront();
    await this.page.emulateFocusedPage(true);
    if (!this.options.startupUrl) {
      if (this.options.userAgent) await this.page.setUserAgent(this.options.userAgent);
      await this.page.emulateTimezone(this.options.timezone);
      await this.page.setExtraHTTPHeaders({ 'Accept-Language': this.options.language });
    }
    return this.page;
  }

  async ping() {
    if (!this.connection?.browser.connected || this.page?.isClosed()) {
      throw new Error('El navegador o la pestaña del bot se cerró.');
    }
    await this.connection.browser.version();
  }

  async saveCookies() {
    if (this.context && this.connection?.browser.connected) {
      await this.cookies.save(this.context);
    }
  }

  async close() {
    try {
      await this.saveCookies();
    } finally {
      try {
        if (this.page && !this.page.isClosed()) await this.page.close();
      } finally {
        await this.connection?.release();
      }
    }
  }
}
