/** Mantiene el puente proxy durante todo el ciclo de vida de Chrome. */
export class ProxyBrowser {
  constructor(createBrowser, bridge, options, view) {
    Object.assign(this, { createBrowser, bridge, options, view });
  }

  async connect(signal) {
    try {
      const proxyServer = await this.bridge.open(signal);
      this.view?.info(`Proxy configurado: ${this.options.proxy.server}. Autenticación privada activa.`);
      const connection = await this.createBrowser({ ...this.options, proxyServer }).connect(signal);
      return {
        ...connection,
        release: async () => {
          try { await connection.release(); } finally { await this.bridge.close(); }
        },
      };
    } catch (error) {
      await this.bridge.close();
      throw error;
    }
  }
}
