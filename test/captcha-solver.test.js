import test from 'node:test';
import assert from 'node:assert/strict';
import { TwoCaptchaSolver } from '../src/services/two-captcha-solver.js';
import { ConsoleView } from '../src/views/console-view.js';

test('usa la URL y sitekey actuales e inyecta el token devuelto', async () => {
  let payload;
  let response;
  const solver = new TwoCaptchaSolver({ type: 'recaptcha', siteKey: 'site-key' }, {
    write: async (_page, token) => { response = token; },
  }, { execute: async (method, params) => {
    assert.equal(method, 'recaptcha'); payload = params; return { data: 'test-token' };
  } });
  await solver.solve({ url: () => 'https://example.test/form' });
  assert.deepEqual(payload, { googlekey: 'site-key', pageurl: 'https://example.test/form' });
  assert.equal(response, 'test-token');
});

test('un token vacío del proveedor falla sin inyectar respuesta', async () => {
  const solver = new TwoCaptchaSolver({ type: 'turnstile', siteKey: 'site-key' }, {
    write: () => assert.fail(),
  }, { execute: async () => ({ data: '' }) });
  await assert.rejects(solver.solve({ url: () => 'https://example.test' }), /respuesta válida/);
});

test('oculta credenciales, incluidos errores con endpoints WebSocket', () => {
  const view = new ConsoleView(['a/b+secret']);
  const message = view.redact('wss://host/?token=a%2Fb%2Bsecret&x=1 key=a/b+secret');
  assert.ok(!message.includes('secret'));
  assert.ok(message.includes('[REDACTED]'));
});
