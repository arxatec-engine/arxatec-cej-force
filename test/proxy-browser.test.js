import test from 'node:test';
import assert from 'node:assert/strict';
import { ProxyBrowser } from '../src/browser/proxy-browser.js';

test('el puente existe antes de iniciar Chrome y se libera después de cerrarlo', async () => {
  const calls = [];
  const bridge = { open: async () => { calls.push('proxy-open'); return 'http://127.0.0.1:1234'; },
    close: async () => { calls.push('proxy-close'); } };
  const provider = new ProxyBrowser(options => {
    assert.equal(options.proxyServer, 'http://127.0.0.1:1234');
    return { connect: async () => {
      calls.push('chrome-open');
      return { release: async () => { calls.push('chrome-close'); } };
    } };
  }, bridge, {});
  const connection = await provider.connect();
  await connection.release();
  assert.deepEqual(calls, ['proxy-open', 'chrome-open', 'chrome-close', 'proxy-close']);
});

test('un fallo al iniciar Chrome libera el puente sin intentar una conexión directa', async () => {
  let closed = false;
  const provider = new ProxyBrowser(() => ({ connect: async () => { throw new Error('Chrome unavailable'); } }),
    { open: async () => 'http://127.0.0.1:1234', close: async () => { closed = true; } }, {});
  await assert.rejects(provider.connect(), /Chrome unavailable/);
  assert.equal(closed, true);
});
