import { setTimeout } from 'node:timers/promises';

/** Comprueba el endpoint HTTP de CDP antes de abrir su WebSocket. */
export class CdpReadiness {
  async read(port, signal, timeoutMs = 1500) {
    const timeout = AbortSignal.timeout(Math.max(1, timeoutMs));
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`CDP respondió HTTP ${response.status}.`);
    const version = await response.json();
    const endpoint = new URL(version.webSocketDebuggerUrl);
    if (endpoint.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(endpoint.hostname)
      || Number(endpoint.port) !== port || !/^\/devtools\/browser\/[\w-]+$/.test(endpoint.pathname)) {
      throw new Error('CDP no devolvió un WebSocket local válido del navegador.');
    }
    return endpoint.href;
  }

  async wait(chrome, timeoutMs, signal) {
    const deadline = Date.now() + timeoutMs;
    let failure;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      chrome.checkAlive();
      try {
        const endpoint = await this.read(chrome.port, signal, Math.min(1500, deadline - Date.now()));
        if (endpoint === chrome.browserEndpoint) return endpoint;
      } catch (error) {
        signal?.throwIfAborted();
        failure = error;
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await setTimeout(Math.min(200, remaining), undefined, { signal });
    }
    throw new Error(`Chrome no habilitó CDP en el puerto ${chrome.port} en ${timeoutMs} ms. `
      + 'Comprueba que el perfil no esté abierto en otro Chrome sin depuración.', { cause: failure });
  }
}
