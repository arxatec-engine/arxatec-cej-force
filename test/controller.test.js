import test from 'node:test';
import assert from 'node:assert/strict';
import { FormController } from '../src/controllers/form-controller.js';

function build(status = 200, accessError) {
  const calls = [];
  const page = {
    goto: async () => { calls.push('goto'); return { status: () => status }; },
    title: async () => 'CEJ', url: () => 'https://cej.pj.gob.pe/cej/', isClosed: () => false,
  };
  const controller = new FormController({
    access: { wait: async () => {
      calls.push('wait');
      if (accessError) throw accessError;
      return [{ id: 'busquedaFiltros', fields: [] }];
    } },
    interactor: { run: async () => { calls.push('interact'); } },
    artifacts: {
      save: async (_page, name) => {
        calls.push(name === 'acceso-inicial' ? 'initial' : 'save'); return {};
      },
      diagnostic: async () => { calls.push('diagnostic'); return {}; },
    },
    view: { info() {}, error() {}, form() {} }, target: { url: page.url() }, actions: [],
  });
  return { page, controller, calls };
}

test('exporta solo después de verificar el formulario e interactuar', async () => {
  const { page, controller, calls } = build();
  const snapshot = await controller.capture(page, new AbortController().signal);
  assert.equal(snapshot.forms[0].id, 'busquedaFiltros');
  assert.deepEqual(calls, ['goto', 'initial', 'wait', 'interact', 'wait', 'save']);
});

test('HTTP 403, 429 y 503 generan diagnóstico sin reintentos ni exportación', async () => {
  for (const status of [403, 429, 503]) {
    const { page, controller, calls } = build(status);
    await assert.rejects(controller.capture(page, new AbortController().signal), /HTTP/);
    assert.deepEqual(calls, ['goto', 'diagnostic']);
  }
});

test('una pantalla Radware sin formulario nunca se exporta como éxito', async () => {
  const { page, controller, calls } = build(200, new Error('Radware sigue activo'));
  await assert.rejects(controller.capture(page, new AbortController().signal), /Radware/);
  assert.deepEqual(calls, ['goto', 'initial', 'wait', 'diagnostic']);
});
