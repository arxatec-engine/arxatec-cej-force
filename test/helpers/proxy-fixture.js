import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Server } from 'proxy-chain';

/** Proxy HTTPS de prueba con certificado confiado explícitamente y autenticación. */
export async function proxyFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'cej-proxy-'));
  const certificate = join(directory, 'certificate.pem');
  const key = join(directory, 'key.pem');
  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', key, '-out', certificate, '-days', '1', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost']);
  const ca = await readFile(certificate);
  const requests = [];
  const username = 'fixture-user';
  const password = 'fixture-secret_country-PE_session-example1';
  const server = new Server({ port: 0, serverType: 'https',
    httpsOptions: { cert: ca, key: await readFile(key) },
    prepareRequestFunction: ({ request, username: user, password: secret, isHttp }) => {
      if (!isHttp || user !== username || secret !== password) return { requestAuthentication: true };
      requests.push(new URL(request.url));
      return { customResponseFunction: () => {
        const ip = new URL(request.url).pathname === '/ip';
        return { statusCode: 200, headers: { 'Content-Type': ip ? 'application/json' : 'text/html' },
          body: ip ? JSON.stringify({ query: '192.0.2.5', countryCode: 'PE', city: 'Lima' })
            : '<!doctype html><title>Proxy fixture</title><form>Distrito Judicial<input id="case"></form>',
        };
      } };
    },
  });
  await server.listen();
  t.after(async () => { await server.close(true); await rm(directory, { recursive: true, force: true }); });
  return { directory, ca, certificate, requests, server,
    url: `https://localhost:${server.port}:${username}:${password}`,
  };
}
