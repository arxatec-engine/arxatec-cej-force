import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryController } from '../src/controllers/query-controller.js';
import { selectOcrAnswer } from '../src/services/ocr-answer.js';
import { loadQuery } from '../src/config/query.js';

const data = { district: 'JUNIN', instance: 'JUZGADO ESPECIALIZADO', specialty: 'LABORAL',
  year: '2024', number: '116', party: 'AGUIRRE GONZALO' };

test('los datos de la imagen están guardados como configuración de consulta', async () => {
  assert.deepEqual(await loadQuery('config/cej-query.json'), data);
});

test('OCR rechaza textos incompletos, puntuación y confianza insuficiente', () => {
  assert.equal(selectOcrAnswer([{ text: 'A?12', confidence: 90 }], 60), null);
  assert.equal(selectOcrAnswer([{ text: 'A12', confidence: 90 }], 60), null);
  assert.equal(selectOcrAnswer([{ text: 'AB12', confidence: 30 }], 60), null);
  assert.equal(selectOcrAnswer([{ text: 'AB12\n', confidence: 80 }], 60).text, 'AB12');
});

function scenario(rejected = 0) {
  const calls = [];
  let submissions = 0;
  const page = { click: async selector => { calls.push(selector); }, url: () => 'https://example.test',
    isClosed: () => false };
  const controller = new QueryController({
    form: { fill: async () => { calls.push('fill'); return data; } },
    solver: { solve: async () => { calls.push('solve'); return { method: 'ocr', code: 'AB12' }; } },
    modal: { wait: async () => {
      if (++submissions <= rejected) {
        const error = new Error('Captcha incorrecto'); error.name = 'CaptchaRejectedError'; throw error;
      }
      return { fields: [{ id: 'tipoDocumento', value: '' }] };
    } },
    refresher: { refresh: async () => { calls.push('refresh'); } },
    artifacts: { save: async (_page, name) => { calls.push(name); return {}; }, diagnostic: async () => ({}) },
    view: { info() {}, error() {} }, data, options: { attempts: 3 },
  });
  return { calls, page, controller };
}

test('el flujo termina en la ventana de identidad y solo pulsa Consultar', async () => {
  const { calls, page, controller } = scenario();
  const result = await controller.run(page, new AbortController().signal);
  assert.equal(result.stage, 'identity-modal');
  assert.deepEqual(calls, ['fill', 'solve', 'consulta-preparada', '#consultarExpedientes', 'validacion-identidad', 'consulta-final']);
});

test('renueva el CAPTCHA solo tras rechazo y respeta el máximo de intentos', async () => {
  const { calls, page, controller } = scenario(4);
  await assert.rejects(controller.run(page, new AbortController().signal), /Captcha incorrecto/);
  assert.equal(calls.filter(call => call === 'refresh').length, 2);
  assert.equal(calls.filter(call => call === '#consultarExpedientes').length, 3);
  assert.ok(!calls.includes('validacion-identidad'));
});

test('un rechazo de identidad se informa sin repetir el envío ni el CAPTCHA', async () => {
  const { calls, page, controller } = scenario();
  controller.identity = { run: async () => {
    calls.push('validate-identity'); return { accepted: false, status: 'IDENTITY_ERROR' };
  } };
  const result = await controller.run(page, new AbortController().signal);
  assert.equal(result.stage, 'identity-rejected');
  assert.equal(calls.filter(call => call === 'validate-identity').length, 1);
  assert.equal(calls.filter(call => call === 'solve').length, 1);
});

test('si el CEJ renueva el CAPTCHA automáticamente no provoca otra renovación', async () => {
  const { calls, page, controller } = scenario();
  let attempts = 0;
  controller.identity = { run: async () => {
    if (++attempts === 1) {
      const error = new Error('Captcha incorrecto');
      error.name = 'CaptchaRejectedError'; error.alreadyRefreshed = true; throw error;
    }
    return { accepted: true, status: 'OK' };
  } };
  const result = await controller.run(page, new AbortController().signal);
  assert.equal(result.stage, 'identity-validated');
  assert.equal(attempts, 2);
  assert.equal(calls.filter(call => call === 'refresh').length, 0);
});
