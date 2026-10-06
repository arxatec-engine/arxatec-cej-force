import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalBrowser } from '../../src/browser/local-browser.js';
import { BrowserSession } from '../../src/browser/browser-session.js';
import { FormController } from '../../src/controllers/form-controller.js';
import { FormInspector } from '../../src/services/form-inspector.js';
import { FormAccess } from '../../src/services/form-access.js';
import { ChallengeDetector } from '../../src/services/challenge-detector.js';
import { FormInteractor } from '../../src/services/form-interactor.js';

test('otra ejecución reutiliza el CDP activo y trabaja sin cerrar las pestañas existentes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-reconnect-'));
  const fixture = await readFile(new URL('../fixtures/form.html', import.meta.url));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(request.url === '/frame' ? '<form>Distrito Judicial<input></form>' : fixture);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/`;
  const options = { profileDirectory: join(directory, 'profile'), headless: true,
    timeoutMs: 20000, startupUrl: url, startupDelayMs: 50 };
  let owner;
  let session;
  t.after(async () => {
    await session?.close();
    await owner?.release();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  owner = await new LocalBrowser(options).connect();
  assert.equal(owner.reused, false);
  const original = owner.page;
  await original.waitForSelector('#number');
  await original.$eval('#number', input => { input.value = '12345'; });
  session = new BrowserSession(new LocalBrowser(options), {
    restore: async () => {}, save: async () => {},
  }, options);
  const page = await session.open(new AbortController().signal);
  assert.equal(session.connection.reused, true);
  assert.equal(session.connection.browser.wsEndpoint(), owner.browser.wsEndpoint());
  assert.equal(page.url(), 'about:blank');
  const target = { url, reuseLoadedPage: true, formSelector: 'form', requiredText: 'Distrito Judicial',
    timeoutMs: 5000, pollIntervalMs: 100 };
  const view = { info() {}, error(error) { throw error; }, form() {} };
  const controller = new FormController({ target, actions: [], view,
    access: new FormAccess(new FormInspector(target), new ChallengeDetector(), null, view, target),
    interactor: new FormInteractor(), artifacts: { save: async () => ({}) },
  });
  await controller.capture(page, new AbortController().signal);
  assert.equal(page.url(), url);
  assert.equal(await page.$eval('#number', input => input.value), '');
  await session.close();
  session = null;
  assert.equal(page.isClosed(), true);
  assert.equal(owner.browser.connected, true);
  assert.equal(original.isClosed(), false);
  assert.equal(await original.$eval('#number', input => input.value), '12345');
});
