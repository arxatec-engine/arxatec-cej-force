import test from 'node:test';
import assert from 'node:assert/strict';
import { FormController } from '../src/controllers/form-controller.js';
import { CookieRepository } from '../src/models/cookie-repository.js';
import { loadEnvironment } from '../src/config/environment.js';

test('conserva la página que cargó Chrome antes de conectar por CDP', async () => {
  const config = loadEnvironment({});
  assert.equal(config.browser.startupUrl, config.target.url);
  assert.equal(config.browser.startupDelayMs, 15000);
  let navigation = false;
  const page = { url: () => 'https://validate.perfdrive.com/', title: async () => 'CEJ',
    goto: async () => { navigation = true; }, isClosed: () => false };
  const controller = new FormController({ target: config.target, actions: [],
    access: { wait: async () => [{ id: 'busquedaFiltros', fields: [] }] },
    interactor: { run: async () => {} }, artifacts: { save: async () => ({}) },
    view: { info() {}, error() {}, form() {} },
  });
  await controller.capture(page, new AbortController().signal);
  assert.equal(navigation, false);
});

test('el respaldo no sobrescribe cookies de verificación nuevas del perfil', async () => {
  const cookie = { domain: 'cej.pj.gob.pe', path: '/', name: 'clearance', expires: -1 };
  let restored = [];
  const repository = new CookieRepository('cookies', 'https://cej.pj.gob.pe', {
    read: async () => [{ ...cookie, value: 'old' }, { ...cookie, name: 'extra', value: 'backup' }],
  });
  await repository.restore({ cookies: async () => [{ ...cookie, value: 'fresh' }],
    setCookie: async (...cookies) => { restored = cookies; } });
  assert.equal(restored.length, 1);
  assert.equal(restored[0].name, 'extra');
});
