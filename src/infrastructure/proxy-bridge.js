import { Server, RequestError } from 'proxy-chain';
import { Agent } from 'node:https';
import { ProxyProviderError } from './proxy-provider-error.js';

const backgroundHosts = new Set([
  'mtalk.google.com', 'update.googleapis.com', 'clients2.google.com',
  'optimizationguide-pa.googleapis.com',
]);

/** Autentica ante el proxy HTTP(S) mediante un puente privado en loopback. */
export class ProxyBridge {
  constructor(proxy, view, createAgent = options => new Agent(options), onFailure = () => {}) {
    this.proxy = proxy;
    this.view = view;
    this.createAgent = createAgent;
    this.onFailure = onFailure;
  }

  async open(signal) {
    signal?.throwIfAborted();
    this.failure = null;
    this.httpsAgent = this.createAgent({ servername: new URL(this.proxy.url).hostname });
    this.server = new Server({
      host: '127.0.0.1', port: 0, verbose: false,
      prepareRequestFunction: ({ hostname }) => {
        if (this.failure) throw new RequestError('Proveedor proxy no disponible.', 503);
        if (backgroundHosts.has(hostname)) throw new RequestError('Tráfico de fondo de Chrome deshabilitado.', 403);
        return {
          requestAuthentication: false, upstreamProxyUrl: this.proxy.url,
          ignoreUpstreamProxyCertificate: false,
          httpsAgent: this.httpsAgent, customTag: { hostname },
        };
      },
    });
    this.server.on('tunnelConnectFailed', ({ response, customTag }) => {
      if (this.failure) return;
      this.view?.info(`El proveedor proxy rechazó el túnel hacia ${customTag.hostname}: HTTP ${response.statusCode}.`);
      if ([401, 402, 407].includes(response.statusCode)) {
        this.failure = new ProxyProviderError(response.statusCode, customTag.hostname);
        this.onFailure(this.failure);
      }
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
