import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProfileEndpoint } from '../src/browser/profile-endpoint.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'cej-endpoint-'));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ webSocketDebuggerUrl: endpoint }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const endpoint = `ws://127.0.0.1:${port}/devtools/browser/current`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, port, endpoint, profile: new ProfileEndpoint(directory) };
}

test('recupera el endpoint guardado únicamente si la identidad del navegador coincide', async t => {
  const { endpoint, profile } = await fixture(t);
  await profile.remember(endpoint.replace('/current', '/stale'));
  assert.equal(await profile.find(), null);
  await profile.remember(endpoint);
  assert.equal(await profile.find(), endpoint);
  if (process.platform !== 'win32') assert.equal((await stat(profile.file)).mode & 0o777, 0o600);
});

test('recupera Chrome de una versión anterior usando el último endpoint activo del log', async t => {
  const { directory, endpoint, profile } = await fixture(t);
  await writeFile(join(directory, 'chrome-err.log'),
    `DevTools listening on ws://127.0.0.1:1/devtools/browser/old\nDevTools listening on ${endpoint}\n`);
  assert.equal(await profile.find(), endpoint);
});

test('acepta DevToolsActivePort y descarta endpoints externos escritos en el estado', async t => {
  const { directory, port, endpoint, profile } = await fixture(t);
  await profile.remember('ws://example.invalid:9222/devtools/browser/external');
  assert.equal(await profile.find(), null);
  await writeFile(join(directory, 'DevToolsActivePort'), `${port}\n/devtools/browser/current\n`);
  assert.equal(await profile.find(), endpoint);
});
