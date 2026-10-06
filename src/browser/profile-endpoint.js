import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JsonFile } from '../infrastructure/json-file.js';
import { CdpReadiness } from './cdp-readiness.js';

/** Recupera únicamente un CDP vivo que coincide con el estado del perfil dedicado. */
export class ProfileEndpoint {
  constructor(directory) {
    this.directory = directory;
    this.file = join(directory, 'cej-browser.json');
    this.storage = new JsonFile();
    this.readiness = new CdpReadiness();
  }

  async readOptional(name) {
    try {
      return await readFile(join(this.directory, name), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw error;
    }
  }

  async find(signal) {
    signal?.throwIfAborted();
    const state = await this.storage.read(this.file);
    const candidates = [state?.browserWSEndpoint];
    const [port, path] = (await this.readOptional('DevToolsActivePort')).trim().split(/\r?\n/);
    if (/^\d+$/.test(port) && /^\/devtools\/browser\/[\w-]+$/.test(path)) {
      candidates.push(`ws://127.0.0.1:${port}${path}`);
    }
    const log = await this.readOptional('chrome-err.log');
    const legacy = [...log.matchAll(/DevTools listening on (ws:\/\/[^\s]+)/g)].at(-1)?.[1];
    candidates.push(legacy);
    for (const candidate of new Set(candidates.filter(Boolean))) {
      let endpoint;
      try { endpoint = new URL(candidate); } catch { continue; }
      if (endpoint.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(endpoint.hostname)
        || !/^\/devtools\/browser\/[\w-]+$/.test(endpoint.pathname)) continue;
      try {
        const active = await this.readiness.read(Number(endpoint.port), signal);
        if (active === endpoint.href) return active;
      } catch {
        signal?.throwIfAborted();
      }
    }
    return null;
  }

  async remember(browserWSEndpoint) {
    await this.storage.write(this.file, { browserWSEndpoint });
  }
}
