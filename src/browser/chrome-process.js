import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { getChromePath } from 'chrome-launcher';

/** Inicia y termina exclusivamente el proceso de Chrome creado por este bot. */
export class ChromeProcess {
  constructor(options, port) {
    this.options = options;
    this.port = port;
    this.tail = '';
  }

  start() {
    const { executablePath, profileDirectory, headless, userAgent, startupUrl } = this.options;
    this.child = spawn(executablePath || getChromePath(), [
      `--remote-debugging-port=${this.port}`, `--user-data-dir=${profileDirectory}`,
      '--remote-debugging-address=127.0.0.1', '--no-first-run', '--no-default-browser-check',
      ...(userAgent ? [`--user-agent=${userAgent}`] : []),
      ...(headless ? ['--headless=new'] : []), startupUrl || 'about:blank',
    ], { detached: process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe'] });
    this.exited = new Promise(resolve => {
      this.child.once('exit', resolve);
      this.child.once('error', error => { this.error = error; resolve(); });
    });
    const log = createWriteStream(join(profileDirectory, 'chrome-err.log'), { flags: 'a', mode: 0o600 });
    log.on('error', () => this.child.stderr.unpipe(log));
    this.child.stderr.pipe(log);
    this.child.stderr.on('data', chunk => {
      this.tail = (this.tail + chunk.toString()).slice(-4096);
      const match = [...this.tail.matchAll(/DevTools listening on (ws:\/\/[^\s]+)/g)].at(-1);
      if (match) this.browserEndpoint = match[1];
    });
    this.child.once('close', () => log.end());
  }

  checkAlive() {
    if (this.error) throw new Error(`No se pudo iniciar Chrome: ${this.error.message}`, { cause: this.error });
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      throw new Error('Chrome se cerró antes de conectar CDP. El perfil puede estar abierto en otro Chrome; '
        + 'cierra solo esa ventana o usa BROWSER_MODE=cdp con su endpoint activo.');
    }
  }

  async stop() {
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null || this.error) return;
    this.child.kill('SIGTERM');
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 5000);
    try { await this.exited; } finally { clearTimeout(timer); }
  }
}
