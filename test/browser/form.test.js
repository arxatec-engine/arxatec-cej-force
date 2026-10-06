import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalBrowser } from '../../src/browser/local-browser.js';
import { RealBrowser } from '../../src/browser/real-browser.js';
import { FormInspector } from '../../src/services/form-inspector.js';
import { FormInteractor } from '../../src/services/form-interactor.js';
import { CaptchaTokenWriter } from '../../src/services/captcha-token-writer.js';
import { ArtifactRepository } from '../../src/models/artifact-repository.js';
import { CookieRepository } from '../../src/models/cookie-repository.js';
import { JsonFile } from '../../src/infrastructure/json-file.js';

test('Chrome local y real: formulario, frames, interacción y persistencia entre conexiones', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-browser-'));
  const fixture = await readFile(new URL('../fixtures/form.html', import.meta.url));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(request.url === '/frame'
      ? '<form id="frameForm">Distrito Judicial<input id="other"></form>' : fixture);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  for (const Provider of [LocalBrowser, RealBrowser]) {
    const provider = new Provider({
      profileDirectory: join(directory, Provider.name), headless: true, timeoutMs: 20000,
    });
    let connection = await provider.connect();
    try {
      const page = connection.page || await connection.browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      const inspector = new FormInspector({ formSelector: 'form', requiredText: 'Distrito Judicial' });
      let forms = await inspector.inspect(page);
      assert.equal(forms.length, 2);
      assert.ok(forms.every(form => form.id !== 'challenge'));
      const mainForm = forms.find(form => form.id === 'busquedaFiltros');
      assert.equal(mainForm.fields[0].options[1].text, 'LIMA');
      assert.ok(mainForm.sharedFields.some(field => field.id === 'parte'));
      await new FormInteractor().run(page, [
        { type: 'select', selector: '#district', value: '41206' },
        { type: 'wait', selector: '#district option[value="41206"]' },
        { type: 'fill', selector: '#number', value: '12345' },
      ], new AbortController().signal);
      await page.setUserAgent('CEJ-Browser-Test/1.0');
      assert.equal(await page.evaluate(() => navigator.userAgent), 'CEJ-Browser-Test/1.0');
      await new CaptchaTokenWriter().write(page, 'ABCD', { responseSelector: '#codigoCaptcha' });
      forms = await inspector.inspect(page);
      assert.equal(forms[0].fields.find(field => field.id === 'number').value, '12345');
      assert.equal(forms[0].sharedFields.find(field => field.id === 'codigoCaptcha').value, 'ABCD');
      const artifacts = await new ArtifactRepository(join(directory, 'output'), new JsonFile())
        .save(page, 'formulario', { forms });
      assert.ok((await stat(artifacts.screenshot)).size > 0);
      const context = connection.browser.defaultBrowserContext();
      await context.setCookie({ name: 'session', value: 'persisted', url, expires: Date.now() / 1000 + 3600 });
      const cookies = new CookieRepository(join(directory, 'cookies.json'), url, new JsonFile());
      await cookies.save(context);
      await connection.release();
      connection = null;
      connection = await provider.connect();
      const restoredContext = connection.browser.defaultBrowserContext();
      await cookies.restore(restoredContext);
      assert.ok((await restoredContext.cookies()).some(cookie => cookie.value === 'persisted'));
    } finally {
      await connection?.release();
    }
  }
});
