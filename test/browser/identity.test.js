import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { LocalBrowser } from '../../src/browser/local-browser.js';
import { QueryController } from '../../src/controllers/query-controller.js';
import { IdentityController } from '../../src/controllers/identity-controller.js';
import { IdentityForm } from '../../src/services/identity-form.js';
import { IdentityValidation } from '../../src/services/identity-validation.js';
import { IdentityModal } from '../../src/services/identity-modal.js';
import { FormInteractor } from '../../src/services/form-interactor.js';
import { QueryForm } from '../../src/services/query-form.js';
import { SelectOption } from '../../src/services/select-option.js';
import { CaptchaTokenWriter } from '../../src/services/captcha-token-writer.js';
import { ArtifactRepository } from '../../src/models/artifact-repository.js';
import { JsonFile } from '../../src/infrastructure/json-file.js';
import { ConsultantIdentity } from '../../src/models/consultant-identity.js';
import { loadQuery } from '../../src/config/query.js';

// Identidad sintética para pruebas locales; no se envía a servicios externos.
const identity = new ConsultantIdentity({ documentType: 'DNI', documentNumber: '00123456',
  verificationCode: '9', issueDate: '2022-11-15', birthDate: '2000-02-03' });

for (const [name, responses, stage] of [
  ['confirmación del CEJ', ['OK'], 'identity-validated'],
  ['rechazo de identidad sin repetir el envío', ['IDENTITY_ERROR'], 'identity-rejected'],
  ['CAPTCHA renovado por el CEJ y nuevo intento', ['CAPTCHA_ERROR', 'OK'], 'identity-validated'],
]) test(`identidad en Chrome: ${name}`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-identity-'));
  const fixture = await readFile(new URL('../fixtures/query.html', import.meta.url));
  const image = await sharp(await readFile(new URL('../fixtures/captcha.svg', import.meta.url))).png().toBuffer();
  const posts = [];
  const server = createServer(async (request, response) => {
    if (request.url.startsWith('/cej/Captcha.jpg')) {
      response.setHeader('Content-Type', 'image/png'); response.end(image); return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (request.url === '/instances') {
      response.end('<option value="2">JUZGADO ESPECIALIZADO</option>');
    } else if (request.url === '/specialties') {
      response.end('<option value="80">LABORAL</option>');
    } else if (request.url.endsWith('/ValidarConsultante.htm')) {
      let body = '';
      for await (const chunk of request) body += chunk;
      posts.push(new URLSearchParams(body));
      const status = responses[posts.length - 1] || 'UNEXPECTED_REPEAT';
      response.end(JSON.stringify({ status, message: status === 'OK' ? '' : 'Datos no coinciden',
        token: 'should-not-be-stored' }));
    } else response.end(fixture);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let connection;
  t.after(async () => {
    await connection?.release();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  connection = await new LocalBrowser({ profileDirectory: join(directory, 'profile'),
    headless: true, timeoutMs: 20000 }).connect();
  const page = await connection.browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.$eval('#numDocumento', input => { input.value = 'previous'; });
  const view = { info() {}, error(error) { throw error; } };
  const artifacts = new ArtifactRepository(join(directory, 'output'), new JsonFile());
  const controller = new QueryController({
    form: new QueryForm(new SelectOption(), new FormInteractor()),
    solver: { solve: async () => {
      await new CaptchaTokenWriter().write(page, 'AB12', { responseSelector: '#codigoCaptcha' });
      return { method: 'test', code: 'AB12' };
    } },
    modal: new IdentityModal(5000),
    identity: new IdentityController({ form: new IdentityForm(new FormInteractor()),
      validation: new IdentityValidation(5000), artifacts, view, data: identity }),
    refresher: { refresh: async () => assert.fail('El CEJ ya renovó el CAPTCHA') },
    artifacts, view, data: await loadQuery('config/cej-query.json'), options: { attempts: 3 },
  });
  const result = await controller.run(page, new AbortController().signal);
  assert.equal(result.stage, stage);
  assert.equal(posts.length, responses.length);
  for (const body of posts) {
    assert.equal(body.get('tipoDocumento'), 'DNI');
    assert.equal(body.get('numDocumento'), identity.documentNumber);
    assert.equal(body.get('codVerificacion'), identity.verificationCode);
    assert.equal(body.get('fechaEmision'), identity.issueDate);
    assert.equal(body.get('fechaNacimiento'), identity.birthDate);
    assert.equal(body.get('codigoCaptcha'), 'AB12');
  }
  assert.ok(!(await readFile(join(directory, 'output/consulta-final.json'), 'utf8'))
    .includes('should-not-be-stored'));
});
