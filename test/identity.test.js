import test from 'node:test';
import assert from 'node:assert/strict';
import { ConsultantIdentity } from '../src/models/consultant-identity.js';
import { loadIdentity } from '../src/config/identity.js';

const example = { documentType: 'DNI', documentNumber: '00123456', verificationCode: '9',
  issueDate: '2022-11-15', birthDate: '2000-02-03' };

test('la configuración conserva ceros del documento y fechas ISO sin inferir datos', () => {
  const identity = new ConsultantIdentity(example);
  assert.equal(identity.documentNumber, '00123456');
  assert.equal(identity.birthDate, '2000-02-03');
});

test('rechaza identidades incompletas y fechas inexistentes antes de navegar', () => {
  for (const patch of [
    { documentNumber: '' }, { documentNumber: 12345678 }, { documentNumber: '123' },
    { verificationCode: '99' }, { issueDate: '15/11/2022' }, { issueDate: '2023-02-31' },
    { birthDate: '2024-01-01' },
  ]) assert.throws(() => new ConsultantIdentity({ ...example, ...patch }));
});

test('la falta del archivo privado se comunica antes de abrir Chrome', async () => {
  await assert.rejects(loadIdentity('/nonexistent/cej-consultant.json'), /Falta IDENTITY_FILE/);
});
