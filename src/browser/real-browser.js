import { mkdir } from 'node:fs/promises';
import { availableDebuggingPort } from './debugging-port.js';

/** Adapta puppeteer-real-browser con perfil propio y navegador visible. */
export class RealBrowser {
  constructor(options) {
    this.options = options;
  }

  async connect() {
    const { connect } = await import('puppeteer-real-browser');
    const { headless, profileDirectory, executablePath, timeoutMs } = this.options;
    await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
    const { browser, page } = await connect({
      headless: headless ? 'new' : false,
      turnstile: false,
      disableXvfb: true,
      ignoreAllFlags: true,
      args: ['--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1'],
      customConfig: {
        port: await availableDebuggingPort(),
        userDataDir: profileDirectory,
        handleSIGINT: false,
        ...(executablePath ? { chromePath: executablePath } : {}),
      },
      connectOption: { defaultViewport: null, protocolTimeout: timeoutMs },
    });
    return { browser, page, release: () => browser.close() };
  }
}
