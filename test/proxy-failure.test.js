import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { Agent } from 'node:https';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvironment } from '../src/config/environment.js';
import { ProxyBridge } from '../src/infrastructure/proxy-bridge.js';
import { ProxyProviderError } from '../src/infrastructure/proxy-provider-error.js';
import { ProxyFailureRepository } from '../src/models/proxy-failure-repository.js';
import { JsonFile } from '../src/infrastructure/json-file.js';
import { proxyFixture } from './helpers/proxy-fixture.js';

function connectThrough(endpoint) {
  return new Promise((resolve, reject) => {
    const connection = request(endpoint, { method: 'CONNECT', path: 'cej-fixture.test:443', timeout: 2000 });
    connection.on('connect', (response, socket) => {
      socket.destroy(); resolve(response.statusCode);
    });
    connection.on('error', reject);
    connection.on('timeout', () => connection.destroy(new Error('Fixture timeout')));
    connection.end();
  });
}

test('HTTP 401, 402 y 407 notifican un fallo único e impiden nuevas peticiones al proveedor', async t => {
  const options = {};
  const fixture = await proxyFixture(t, options);
  const proxy = loadEnvironment({ PROXY_URL: fixture.url }).browser.proxy;
  for (const httpStatus of [401, 402, 407]) {
    options.tunnelStatus = httpStatus;
    const failures = [];
    const abort = new AbortController();
    const bridge = new ProxyBridge(proxy, null, settings => new Agent({ ...settings, ca: fixture.ca }), error => {
      failures.push(error); abort.abort(error);
    });
    t.after(() => bridge.close());
    const endpoint = await bridge.open();
    const initialCount = fixture.tunnels.length;
    assert.ok(await connectThrough(endpoint) >= 400);
    assert.equal(abort.signal.aborted, true);
    assert.equal(abort.signal.reason.httpStatus, httpStatus);
    assert.equal(abort.signal.reason.destination, 'cej-fixture.test');
    assert.equal(await connectThrough(endpoint), 503);
    assert.equal(fixture.tunnels.length, initialCount + 1);
    assert.equal(failures.length, 1);
    assert.equal(fixture.requests.length, 0);
    await bridge.close();
  }
});

test('HTTP 501 del proveedor no cancela la sesión ni impide otra petición', async t => {
  const fixture = await proxyFixture(t);
  const proxy = loadEnvironment({ PROXY_URL: fixture.url }).browser.proxy;
  const bridge = new ProxyBridge(proxy, null, settings => new Agent({ ...settings, ca: fixture.ca }), () => assert.fail());
  t.after(() => bridge.close());
  const endpoint = await bridge.open();
  assert.ok(await connectThrough(endpoint) >= 400);
  assert.ok(await connectThrough(endpoint) >= 400);
  assert.equal(bridge.failure, null);
  assert.equal(fixture.tunnels.length, 2);
});

test('el diagnóstico privado registra el rechazo del proxy y omite fallos ajenos al proveedor', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-proxy-error-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new ProxyFailureRepository(directory, new JsonFile());
  assert.equal(await repository.save(new Error('Error ajeno con datos privados')), null);
  const file = await repository.save(new ProxyProviderError(402, 'cej-fixture.test'));
  const record = JSON.parse(await readFile(file));
  assert.equal(record.stage, 'proxy');
  assert.equal(record.code, 'PROXY_PAYMENT_REQUIRED');
  assert.equal(record.httpStatus, 402);
  assert.equal(record.destination, 'cej-fixture.test');
  assert.match(record.error, /Statistics \/ Subscription/);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});
