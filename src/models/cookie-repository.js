/** Conserva exclusivamente cookies del dominio objetivo y no vencidas. */
export class CookieRepository {
  constructor(file, targetUrl, storage) {
    this.file = file;
    this.hostname = new URL(targetUrl).hostname;
    this.storage = storage;
  }

  accepts(cookie) {
    if (!cookie || typeof cookie.domain !== 'string') return false;
    const domain = cookie.domain.replace(/^\./, '');
    const matches = this.hostname === domain || this.hostname.endsWith(`.${domain}`);
    const active = !cookie.expires || cookie.expires === -1 || cookie.expires > Date.now() / 1000;
    return matches && active && typeof cookie.name === 'string' && typeof cookie.value === 'string';
  }

  async restore(context) {
    const saved = await this.storage.read(this.file, []);
    if (!Array.isArray(saved)) throw new Error('El archivo de cookies debe contener un array.');
    const cookies = saved.filter(cookie => this.accepts(cookie));
    const existing = typeof context.cookies === 'function' ? await context.cookies() : [];
    const identity = cookie => JSON.stringify([cookie.domain, cookie.path || '/', cookie.name,
      cookie.partitionKey || null]);
    const current = new Set(existing.filter(cookie => this.accepts(cookie)).map(identity));
    const missing = cookies.filter(cookie => !current.has(identity(cookie)));
    if (missing.length) await context.setCookie(...missing);
    return missing.length;
  }

  async save(context) {
    const cookies = (await context.cookies()).filter(cookie => this.accepts(cookie));
    const fields = ['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure',
      'sameSite', 'priority', 'partitionKey', 'sourceScheme'];
    const records = cookies.map(cookie => Object.fromEntries(
      fields.filter(key => cookie[key] !== undefined).map(key => [key, cookie[key]]),
    ));
    await this.storage.write(this.file, records);
    return records.length;
  }
}
