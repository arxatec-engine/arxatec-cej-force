import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CookieRepository } from '../src/models/cookie-repository.js';
import { JsonFile } from '../src/infrastructure/json-file.js';

test('persiste y restaura cookies CEJ excluyendo dominios ajenos y cookies vencidas', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cej-cookies-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = new JsonFile();
  const file = join(directory, 'cookies.json');
  const repository = new CookieRepository(file, 'https://cej.pj.gob.pe/cej/', storage);
  const context = { cookies: async () => [
    { name: 'session', value: 'abc', domain: 'cej.pj.gob.pe', path: '/', expires: -1, size: 20 },
    { name: 'parent', value: 'def', domain: '.pj.gob.pe', expires: Date.now() / 1000 + 3600 },
    { name: 'foreign', value: 'secret', domain: 'elsewhere.example', expires: -1 },
    { name: 'expired', value: 'old', domain: 'cej.pj.gob.pe', expires: 1 },
    { name: 'suffix', value: 'other', domain: 'evilpj.gob.pe', expires: -1 },
  ] };
  assert.equal(await repository.save(context), 2);
  const saved = await storage.read(file);
  assert.equal(saved[0].size, undefined);
  let restored;
  assert.equal(await repository.restore({ setCookie: async (...cookies) => { restored = cookies; } }), 2);
  assert.deepEqual(restored, saved);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test('un archivo corrupto no se trata silenciosamente como sesión vacía', async () => {
  const repository = new CookieRepository('cookies', 'https://cej.pj.gob.pe', {
    read: async () => ({ invalid: true }),
  });
  await assert.rejects(repository.restore({}), /array/);
});
