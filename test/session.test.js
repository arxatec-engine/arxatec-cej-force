import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSession } from '../src/browser/browser-session.js';

test('restaura cookies antes de navegar y cierra solo su pestaña antes de desconectar', async () => {
  const calls = [];
  const page = {
    setDefaultTimeout() {}, setDefaultNavigationTimeout() {},
    bringToFront: async () => {},
    emulateFocusedPage: async enabled => assert.equal(enabled, true),
    emulateTimezone: async () => {}, setExtraHTTPHeaders: async () => {},
    isClosed: () => false, close: async () => { calls.push('close-page'); },
  };
  const context = { newPage: async () => { calls.push('new-page'); return page; } };
  const browser = { connected: true, defaultBrowserContext: () => context };
  const session = new BrowserSession({ connect: async () => ({
    browser, release: async () => { calls.push('release'); },
  }) }, {
    restore: async () => { calls.push('restore'); }, save: async () => { calls.push('save'); },
  }, { timeoutMs: 100, timezone: 'America/Lima', language: 'es-PE' });
  await session.open();
  await session.close();
  assert.deepEqual(calls, ['restore', 'new-page', 'save', 'close-page', 'release']);
});

test('libera la conexión aunque falle el guardado de cookies', async () => {
  let released = false;
  const session = new BrowserSession({}, { save: async () => { throw new Error('disk full'); } }, {});
  session.context = {};
  session.connection = { browser: { connected: true }, release: async () => { released = true; } };
  await assert.rejects(session.close(), /disk full/);
  assert.equal(released, true);
});

test('el arranque directo conserva el entorno nativo durante la sesión ya verificada', async () => {
  const page = {
    setDefaultTimeout() {}, setDefaultNavigationTimeout() {},
    bringToFront: async () => {},
    emulateFocusedPage: async enabled => assert.equal(enabled, true),
    emulateTimezone: () => assert.fail('No se cambia la zona después de cargar el sitio'),
    setExtraHTTPHeaders: () => assert.fail('No se cambia el idioma después de cargar el sitio'),
  };
  const session = new BrowserSession({ connect: async () => ({
    page, browser: { defaultBrowserContext: () => ({}) },
  }) }, { restore: async () => {} }, { startupUrl: 'https://cej.pj.gob.pe', timeoutMs: 100 });
  assert.equal(await session.open(), page);
});
