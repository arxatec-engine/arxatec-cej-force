import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnvironment } from '../src/config/environment.js';

test('usa CEJ, Chrome visible y sesión activa por defecto', () => {
  const config = loadEnvironment({});
  assert.equal(new URL(config.target.url).hostname, 'cej.pj.gob.pe');
  assert.equal(config.browser.mode, 'local');
  assert.equal(config.browser.headless, false);
  assert.equal(config.keepBrowserOpen, true);
  assert.equal(config.browser.userAgent, '');
});

test('rechaza credenciales faltantes y opciones inválidas antes de navegar', () => {
  for (const environment of [
    { BROWSER_MODE: 'browserless' }, { BROWSER_MODE: 'cdp' },
    { CAPTCHA_MODE: '2captcha' }, { BROWSER_MODE: 'invalid' },
    { BROWSER_HEADLESS: 'yes' }, { HEADLESS: 'false' }, { FORM_TIMEOUT_MS: '-1' },
    { TARGET_URL: 'file:///private/file' },
  ]) assert.throws(() => loadEnvironment(environment));
});

test('no rechaza propiedades definidas para Browserless e imagen CAPTCHA', () => {
  const config = loadEnvironment({
    BROWSER_MODE: 'browserless', BROWSERLESS_TOKEN: 'example',
    CAPTCHA_MODE: '2captcha', TWOCAPTCHA_API_KEY: 'example', CAPTCHA_TYPE: 'image',
  });
  assert.equal(config.browser.mode, 'browserless');
  assert.equal(config.captcha.type, 'image');
});
