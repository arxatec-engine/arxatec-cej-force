import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnvironment } from '../src/config/environment.js';
import { ConsoleView } from '../src/views/console-view.js';

test('acepta exportación Evomi y URL estándar con credenciales especiales sin alterar la clave', () => {
  const proxy = loadEnvironment({ PROXY_URL: 'https://proxy.example:1001:test-user:p@ss:word%2F_country-PE_session-example1' }).browser.proxy;
  const url = new URL(proxy.url);
  assert.equal(url.origin, 'https://proxy.example:1001');
  assert.equal(decodeURIComponent(url.password), 'p@ss:word%2F_country-PE_session-example1');
  assert.equal(proxy.server, url.origin);
  const equivalent = loadEnvironment({ PROXY_URL: url.href }).browser.proxy;
  assert.equal(equivalent.id, proxy.id);
});

test('aísla el perfil y las cookies por proveedor, país y sesión del proxy', () => {
  const direct = loadEnvironment({});
  const peru = loadEnvironment({ PROXY_URL: 'http://user:secret_country-PE_session-example1@proxy.example:1000' });
  const france = loadEnvironment({ PROXY_URL: 'http://user:secret_country-FR_session-example2@proxy.example:1000' });
  assert.notEqual(peru.browser.profileDirectory, direct.browser.profileDirectory);
  assert.notEqual(peru.browser.profileDirectory, france.browser.profileDirectory);
  assert.doesNotMatch(peru.browser.profileDirectory, /secret|country-PE|example1/);
  assert.notEqual(peru.cookieFile, direct.cookieFile);
  assert.notEqual(peru.cookieFile, france.cookieFile);
});

test('rechaza proxies inválidos y modos remotos en vez de navegar directamente', () => {
  for (const PROXY_URL of ['not a proxy', 'socks5://proxy.example:1002',
    'http://user@proxy.example', 'https://proxy.example/path', 'https://proxy.example:99999',
    'https://proxy.example?token=secret']) {
    assert.throws(() => loadEnvironment({ PROXY_URL }), error => {
      assert.doesNotMatch(error.message, /token=secret/);
      return true;
    });
  }
  for (const BROWSER_MODE of ['cdp', 'real', 'browserless']) {
    assert.throws(() => loadEnvironment({ BROWSER_MODE, PROXY_URL: 'https://proxy.example:1001' }), /BROWSER_MODE=local/);
  }
});

test('la vista oculta la cadena exportada, sus credenciales y cualquier URL autenticada', () => {
  const raw = 'https://proxy.example:1001:test-user:private-value_country-PE_session-example1';
  const config = loadEnvironment({ PROXY_URL: raw });
  const { proxy } = config.browser;
  const view = new ConsoleView([raw, proxy.username, proxy.password]);
  const message = view.redact(`${raw} ${proxy.url} https://other:other-secret@other.example/`);
  for (const secret of [raw, proxy.username, proxy.password, 'other-secret']) assert.ok(!message.includes(secret));
});
