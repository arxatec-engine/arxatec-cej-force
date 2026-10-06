import { Server, RequestError } from 'proxy-chain';
import { Agent } from 'node:https';

const backgroundHosts = new Set([
  'mtalk.google.com', 'update.googleapis.com', 'clients2.google.com',
  'optimizationguide-pa.googleapis.com',
]);

/** Autentica ante el proxy HTTP(S) mediante un puente privado en loopback. */
export class ProxyBridge {
  constructor(proxy, view, createAgent = options => new Agent(options)) {
    this.proxy = proxy;
    this.view = view;
    this.createAgent = createAgent;
  }

  async open(signal) {
    signal?.throwIfAborted();
    this.httpsAgent = this.createAgent({ servername: new URL(this.proxy.url).hostname });
    this.server = new Server({
      host: '127.0.0.1', port: 0, verbose: false,
      prepareRequestFunction: ({ hostname }) => {
        if (backgroundHosts.has(hostname)) throw new RequestError('Tráfico de fondo de Chrome deshabilitado.', 403);
        return {
          requestAuthentication: false, upstreamProxyUrl: this.proxy.url,
          ignoreUpstreamProxyCertificate: false,
          httpsAgent: this.httpsAgent, customTag: { hostname },
        };
      },
    });
    this.server.on('tunnelConnectFailed', ({ response, customTag }) => {
      this.view?.info(`El proveedor proxy rechazó el túnel hacia ${customTag.hostname}: HTTP ${response.statusCode}.`);
      if (response.statusCode === 402) this.view?.info('Evomi/proveedor solicita pago: revisa el saldo y la vigencia de la prueba.');
      if ([401, 407].includes(response.statusCode)) this.view?.info('El proveedor proxy rechazó la autenticación. Revisa PROXY_URL.');
    });
    this.server.on('requestFailed', () => {
      this.view?.info('Falló una petición al proveedor proxy. Revisa conexión, credenciales y saldo.');
    });
    try {
      await this.server.listen();
      signal?.throwIfAborted();
      return `http://127.0.0.1:${this.server.port}`;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close() {
    const server = this.server;
    this.server = null;
    try { if (server) await server.close(true); } finally { this.httpsAgent?.destroy(); }
  }
}
