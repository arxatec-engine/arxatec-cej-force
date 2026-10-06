import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalBrowser } from '../../src/browser/local-browser.js';
import { FormController } from '../../src/controllers/form-controller.js';
import { FormAccess } from '../../src/services/form-access.js';
import { FormInspector } from '../../src/services/form-inspector.js';
import { ChallengeDetector } from '../../src/services/challenge-detector.js';
import { ArtifactRepository } from '../../src/models/artifact-repository.js';
import { JsonFile } from '../../src/infrastructure/json-file.js';

test('Chrome: reconoce Forbidden sin respuesta de navegación y conserva evidencia del bloqueo', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-access-'));
  let connection;
  const server = createServer((request, response) => {
    response.statusCode = request.url === '/http-blocked' ? 403 : 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!DOCTYPE html><title>403 Forbidden</title><h2>403 Forbidden</h2>'
      + '<h2>Transaction ID:</h2>test-transaction');
  });
  t.after(async () => {
    await connection?.release();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  connection = await new LocalBrowser({
    profileDirectory: join(directory, 'profile'), headless: true, timeoutMs: 20000,
  }).connect();
  const page = await connection.browser.newPage();
  const url = `http://127.0.0.1:${server.address().port}/`;
  await page.goto(url);
  const target = { url, formSelector: 'form', requiredText: 'Distrito Judicial',
    reuseLoadedPage: true, timeoutMs: 60000, pollIntervalMs: 100 };
  const messages = [];
  const view = { info: message => messages.push(message), error: error => assert.fail(error.message) };
  const detector = new ChallengeDetector();
  const access = new FormAccess(new FormInspector(target), detector,
    { canSolve: async () => assert.fail('Un Forbidden no debe enviar tareas CAPTCHA') }, view, target);
  const controller = new FormController({ access,
    interactor: { run: async () => assert.fail('No hay formulario para interactuar') },
    artifacts: new ArtifactRepository(join(directory, 'warm'), new JsonFile()),
    view, target, actions: [],
  });
  await assert.rejects(controller.capture(page, AbortSignal.timeout(5000)), /denegó el acceso.*403 Forbidden/);
  const diagnostic = JSON.parse(await readFile(join(directory, 'warm/diagnostico.json'), 'utf8'));
  assert.equal(diagnostic.title, '403 Forbidden');
  assert.equal(diagnostic.httpStatus, null);
  assert.match(diagnostic.text, /test-transaction/);
  assert.ok((await stat(join(directory, 'warm/acceso-inicial.png'))).size > 0);
  assert.ok((await stat(join(directory, 'warm/diagnostico.png'))).size > 0);
  await assert.rejects(readFile(join(directory, 'warm/formulario.json')), { code: 'ENOENT' });
  assert.ok(messages.some(message => /Estado: blocked/.test(message)));

  const httpController = new FormController({
    access: { wait: async () => assert.fail('HTTP 403 debe terminar sin esperar') },
    artifacts: new ArtifactRepository(join(directory, 'cold'), new JsonFile()),
    view, target: { ...target, url: `${url}http-blocked`, reuseLoadedPage: false }, actions: [],
  });
  await assert.rejects(httpController.capture(page, AbortSignal.timeout(5000)), /HTTP 403/);
  const httpDiagnostic = JSON.parse(await readFile(join(directory, 'cold/diagnostico.json'), 'utf8'));
  assert.equal(httpDiagnostic.httpStatus, 403);

  await page.setContent('<title>Desafío</title><div class="h-captcha"></div>');
  assert.equal((await detector.inspect(page)).kind, 'captcha');
  await page.setContent('<title>Radware Captcha Page</title><div class="h-captcha"></div>');
  const radware = await detector.inspect(page);
  assert.equal(radware.kind, 'radware');
  assert.equal(radware.captcha, 'hcaptcha');
  await page.setContent('<title>Página inesperada</title><p>Sin formulario</p>');
  assert.equal((await detector.inspect(page)).kind, 'unknown');
});
