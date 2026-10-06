import test from 'node:test';
import assert from 'node:assert/strict';
import { FormAccess } from '../src/services/form-access.js';

const view = { info() {} };
const options = { timeoutMs: 100, pollIntervalMs: 5 };

test('espera el formulario detrás de Radware y no envía CAPTCHAs si ya está listo', async () => {
  let inspections = 0;
  const forms = [{ id: 'busquedaFiltros' }];
  let solves = 0;
  const access = new FormAccess(
    { inspect: async () => ++inspections === 1 ? [] : forms },
    { inspect: async () => ({ kind: 'radware' }) },
    { canSolve: async () => false, solve: async () => { solves++; } }, view, options,
  );
  assert.deepEqual(await access.wait({}, new AbortController().signal), forms);
  assert.equal(solves, 0);
});

test('envía un desafío configurado una sola vez y termina con timeout', async () => {
  let solves = 0;
  const access = new FormAccess(
    { inspect: async () => [] }, { inspect: async () => ({ kind: 'captcha' }) },
    { canSolve: async () => true, solve: async () => { solves++; } },
    view, { ...options, timeoutMs: 30 },
  );
  await assert.rejects(access.wait({}, new AbortController().signal), /No apareció el formulario/);
  assert.equal(solves, 1);
});

test('Ctrl+C cancela la espera sin otra inspección', async () => {
  const abort = new AbortController();
  abort.abort();
  const access = new FormAccess({ inspect: () => assert.fail() }, {}, null, view, options);
  await assert.rejects(access.wait({}, abort.signal), { name: 'AbortError' });
});

test('un bloqueo explícito termina antes de intentar resolver un CAPTCHA', async () => {
  const access = new FormAccess(
    { inspect: async () => [] },
    { inspect: async () => ({ kind: 'blocked', title: '403 Forbidden' }) },
    { canSolve: async () => assert.fail('El bloqueo no se resuelve con el CAPTCHA del formulario') },
    view, options,
  );
  await assert.rejects(access.wait({}, new AbortController().signal), /denegó el acceso.*403 Forbidden/);
});

test('Radware con hCaptcha informa la intervención concreta y su causa al vencer el plazo', async () => {
  const messages = [];
  const access = new FormAccess(
    { inspect: async () => [] },
    { inspect: async () => ({ kind: 'radware', captcha: 'hcaptcha', title: 'Radware Captcha Page' }) },
    { canSolve: async () => false, solve: async () => assert.fail('El OCR del CEJ no sirve para hCaptcha') },
    { info: message => messages.push(message) }, { ...options, timeoutMs: 20 },
  );
  await assert.rejects(access.wait({}, new AbortController().signal), /Radware requiere completar hCaptcha/);
  assert.ok(messages.some(message => /Estado: radware\/hcaptcha/.test(message)));
  assert.ok(messages.some(message => /Soy humano.*Submit/.test(message)));
});
