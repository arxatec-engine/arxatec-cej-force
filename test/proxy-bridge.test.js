import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { Agent } from 'node:https';
import { loadEnvironment } from '../src/config/environment.js';
import { ProxyBridge } from '../src/infrastructure/proxy-bridge.js';
import { proxyFixture } from './helpers/proxy-fixture.js';

function fetchThrough(proxy, target) {
  return new Promise((resolve, reject) => {
    const request = get(proxy, { path: target }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
  });
}

test('el puente impide actualizaciones de Chrome y rechaza credenciales incorrectas sin acceso directo', async t => {
  const fixture = await proxyFixture(t);
  const proxy = loadEnvironment({ PROXY_URL: fixture.url }).browser.proxy;
  const bridge = new ProxyBridge(proxy, null, options => new Agent({ ...options, ca: fixture.ca }));
  t.after(() => bridge.close());
  const endpoint = await bridge.open();
  const blocked = await fetchThrough(endpoint, 'http://update.googleapis.com/download');
  assert.equal(blocked.status, 403);
  assert.equal(fixture.requests.length, 0, 'El tráfico de fondo no llega al proveedor');
  await bridge.close();
  const bad = loadEnvironment({ PROXY_URL: fixture.url.replace('fixture-secret', 'incorrect-secret') }).browser.proxy;
  const wrong = new ProxyBridge(bad, null, options => new Agent({ ...options, ca: fixture.ca }));
  t.after(() => wrong.close());
  const rejected = await fetchThrough(await wrong.open(), 'http://cej-proxy.test/form');
  assert.ok(rejected.status >= 400);
  assert.equal(fixture.requests.length, 0);
});

test('el proxy HTTPS no acepta un certificado que no está en la cadena de confianza', async t => {
  const fixture = await proxyFixture(t);
  const proxy = loadEnvironment({ PROXY_URL: fixture.url }).browser.proxy;
  const bridge = new ProxyBridge(proxy);
  t.after(() => bridge.close());
  const rejected = await fetchThrough(await bridge.open(), 'http://cej-proxy.test/form');
  assert.ok(rejected.status >= 400);
  assert.equal(fixture.requests.length, 0);
});
