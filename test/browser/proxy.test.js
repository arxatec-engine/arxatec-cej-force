import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnvironment } from '../../src/config/environment.js';
import { LocalBrowser } from '../../src/browser/local-browser.js';
import { ProxyBrowser } from '../../src/browser/proxy-browser.js';
import { ProxyBridge } from '../../src/infrastructure/proxy-bridge.js';
import { proxyFixture } from '../helpers/proxy-fixture.js';

test('Chrome autentica un proxy HTTPS antes de conectar CDP y no reutiliza un puente ajeno', async t => {
  const fixture = await proxyFixture(t);
  const config = loadEnvironment({ PROXY_URL: fixture.url, PROFILE_DIRECTORY: join(fixture.directory, 'warm'),
    TARGET_URL: 'http://cej-proxy.test/form', BROWSER_HEADLESS: 'true', BROWSER_STARTUP_DELAY_MS: '100' });
  const createBrowser = options => new LocalBrowser(options);
  const bridge = () => new ProxyBridge(config.browser.proxy, null, options => new Agent({ ...options, ca: fixture.ca }));
  let owner;
  t.after(async () => { await owner?.release(); });
  owner = await new ProxyBrowser(createBrowser, bridge(), config.browser).connect();
  const page = owner.page;
  await page.waitForSelector('#case');
  assert.ok(fixture.requests.some(url => url.href === config.target.url));
  assert.equal(await page.title(), 'Proxy fixture');
  await assert.rejects(new ProxyBrowser(createBrowser, bridge(), config.browser).connect(), /perfil proxy ya está abierto/);
  assert.equal(owner.browser.connected, true);
  await page.reload();
  await page.waitForSelector('#case');
});

test('CLI comprueba PE en Chrome, exporta el formulario y detiene el acceso si el país no coincide', async t => {
  const fixture = await proxyFixture(t);
  const run = promisify(execFile);
  const environment = { ...process.env, BROWSER_MODE: 'local', BROWSER_HEADLESS: 'true',
    PROXY_URL: fixture.url, PROXY_CHECK_URL: 'http://cej-proxy.test/ip', PROXY_EXPECTED_COUNTRY: 'PE',
    NODE_EXTRA_CA_CERTS: fixture.certificate, PROFILE_DIRECTORY: join(fixture.directory, 'cli-profile'),
    COOKIE_FILE: join(fixture.directory, 'cookies.json'), OUTPUT_DIRECTORY: join(fixture.directory, 'success'),
    TARGET_URL: 'http://cej-proxy.test/form', FORM_REQUIRED_TEXT: 'Distrito Judicial', FORM_SELECTOR: 'form',
    CAPTCHA_MODE: 'manual', ACTIONS_FILE: '', NAVIGATION_TIMEOUT_MS: '15000', FORM_TIMEOUT_MS: '3000',
  };
  delete environment.HEADLESS;
  const result = await run(process.execPath, ['src/main.js', '--proxy-check', '--once'], { env: environment, timeout: 30000 });
  assert.match(result.stdout, /país PE/);
  assert.match(result.stdout, /Formulario obtenido/);
  assert.doesNotMatch(result.stdout, /fixture-secret/);
  const record = JSON.parse(await readFile(join(environment.OUTPUT_DIRECTORY, 'proxy-ip.json')));
  assert.equal(record.accepted, true);
  const forms = JSON.parse(await readFile(join(environment.OUTPUT_DIRECTORY, 'formulario.json')));
  assert.equal(forms.forms.length, 1);
  assert.equal(fixture.requests.filter(url => url.hostname === 'cej-proxy.test')[0].pathname,
    '/ip', 'El CEJ no se visita antes de comprobar el país');
  fixture.requests.length = 0;
  environment.OUTPUT_DIRECTORY = join(fixture.directory, 'wrong-country');
  environment.PROXY_EXPECTED_COUNTRY = 'FR';
  await assert.rejects(run(process.execPath, ['src/main.js', '--proxy-check', '--once'],
    { env: environment, timeout: 30000 }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /se esperaba FR/);
    return true;
  });
  assert.ok(!fixture.requests.some(url => url.pathname === '/form'));
  const rejected = JSON.parse(await readFile(join(environment.OUTPUT_DIRECTORY, 'proxy-ip.json')));
  assert.equal(rejected.accepted, false);
  await assert.rejects(readFile(join(environment.OUTPUT_DIRECTORY, 'formulario.json')), { code: 'ENOENT' });
});
