import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptchaClient } from '../src/infrastructure/captcha-client.js';

test('un método desconocido falla dentro del worker sin contactar al proveedor', async () => {
  const client = new CaptchaClient('test-key');
  await assert.rejects(client.execute('unsupported', {}), /no soportado/);
});

test('Ctrl+C cancela el worker y su polling pendiente', async () => {
  const signal = new AbortController();
  const client = new CaptchaClient('test-key');
  const request = client.execute('unsupported', {}, { signal: signal.signal });
  signal.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('el timeout termina el worker antes de una solicitud externa', async () => {
  const client = new CaptchaClient('test-key', 1);
  await assert.rejects(client.execute('unsupported', {}), /agotó el tiempo/);
});
