import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { LocalBrowser } from '../../src/browser/local-browser.js';
import { loadEnvironment } from '../../src/config/environment.js';
import { loadQuery } from '../../src/config/query.js';
import { QueryForm } from '../../src/services/query-form.js';
import { SelectOption } from '../../src/services/select-option.js';
import { FormInteractor } from '../../src/services/form-interactor.js';
import { IdentityModal } from '../../src/services/identity-modal.js';
import { CaptchaRefresher } from '../../src/services/captcha-refresher.js';
import { createCaptchaSolver } from '../../src/services/captcha-factory.js';
import { QueryController } from '../../src/controllers/query-controller.js';
import { JsonFile } from '../../src/infrastructure/json-file.js';
import { ArtifactRepository } from '../../src/models/artifact-repository.js';

test('flujo completo: AJAX dependiente, captura/OCR/audio y modal sin validar identidad', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-query-'));
  const fixture = await readFile(new URL('../fixtures/query.html', import.meta.url));
  const image = await sharp(await readFile(new URL('../fixtures/captcha.svg', import.meta.url))).png().toBuffer();
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url === '/cej/Captcha.jpg') {
      response.setHeader('Content-Type', 'image/png'); response.end(image); return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (request.url === '/instances') {
      setTimeout(() => response.end('<option value="">Seleccionar</option><option value="2">JUZGADO ESPECIALIZADO</option>'), 30);
    } else if (request.url === '/specialties') {
      setTimeout(() => response.end('<option value="">Seleccionar</option><option value="80">LABORAL</option>'), 30);
    } else if (request.url === '/cej/xyhtml') {
      response.end('<input type="hidden" id="1zirobotz0" value="AB12">');
    } else response.end(fixture);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const provider = new LocalBrowser({ profileDirectory: join(directory, 'profile'), headless: true, timeoutMs: 20000 });
  let connection;
  t.after(async () => {
    await connection?.release();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  connection = await provider.connect();
  const page = await connection.browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const config = loadEnvironment({
    CAPTCHA_MODE: 'ocr', CAPTCHA_IMAGE_SELECTOR: '#captcha_image', CAPTCHA_RESPONSE_SELECTOR: '#codigoCaptcha',
    OCR_MIN_CONFIDENCE: '100', OCR_CACHE_DIRECTORY: join(directory, 'cache'), OUTPUT_DIRECTORY: join(directory, 'output'),
  });
  const storage = new JsonFile();
  const view = { info() {}, error(error) { throw error; } };
  const solver = createCaptchaSolver(config, view, storage);
  const controller = new QueryController({
    form: new QueryForm(new SelectOption(), new FormInteractor()), solver,
    modal: new IdentityModal(5000), refresher: new CaptchaRefresher(),
    artifacts: new ArtifactRepository(config.outputDirectory, storage), view,
    data: await loadQuery('config/cej-query.json'), options: { attempts: 2 },
  });
  const result = await controller.run(page, new AbortController().signal);
  assert.equal(result.stage, 'identity-modal');
  assert.equal(result.captcha.code, 'AB12');
  assert.ok(result.modal.fields.every(field => field.value === ''));
  assert.ok(!requests.some(url => url.includes('ValidarConsultante')));
  assert.ok((await stat(join(config.outputDirectory, 'captcha.png'))).size > 0);
  assert.ok((await stat(join(config.outputDirectory, 'validacion-identidad.png'))).size > 0);
  const readings = await storage.read(join(config.outputDirectory, 'captcha-lectura.json'));
  assert.equal(readings.readings.length, 3);
});
