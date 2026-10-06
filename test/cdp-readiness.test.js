import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { CdpReadiness } from '../src/browser/cdp-readiness.js';
import { availableDebuggingPort } from '../src/browser/debugging-port.js';

test('espera a que CDP entregue su WebSocket, aunque el primer HTTP falle', async t => {
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    if (requests === 1) { response.writeHead(503); response.end(); return; }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ webSocketDebuggerUrl: endpoint }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const endpoint = `ws://127.0.0.1:${port}/devtools/browser/ready`;
  const chrome = { port, browserEndpoint: endpoint, checkAlive() {} };
  assert.equal(await new CdpReadiness().wait(chrome, 3000), endpoint);
  assert.equal(requests, 2);
});

test('un puerto rechazado termina con diagnóstico CDP y dentro del plazo', async () => {
  const port = await availableDebuggingPort();
  const started = Date.now();
  await assert.rejects(new CdpReadiness().wait({ port, checkAlive() {} }, 100), /Chrome no habilitó CDP/);
  assert.ok(Date.now() - started < 1500);
});

test('Ctrl+C cancela incluso una respuesta HTTP de CDP que queda pendiente', async t => {
  const controller = new AbortController();
  const server = createServer(() => controller.abort());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  await assert.rejects(new CdpReadiness().wait({
    port: server.address().port, checkAlive() {},
  }, 3000, controller.signal), { name: 'AbortError' });
});
