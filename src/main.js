import { once } from 'node:events';
import { loadEnvironment } from './config/environment.js';
import { createApplication } from './application.js';
import { ConsoleView } from './views/console-view.js';

/** Ciclo de vida del proceso y cierre ordenado al recibir Ctrl+C. */
async function main() {
  const abort = new AbortController();
  const view = new ConsoleView([process.env.BROWSERLESS_TOKEN, process.env.TWOCAPTCHA_API_KEY, process.env.PROXY_URL]);
  const stop = () => abort.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let app;
  try {
    const config = loadEnvironment();
    const args = process.argv.slice(2);
    if (args.some(argument => !['--once', '--query', '--proxy-check'].includes(argument))) {
      throw new Error('Solo se admiten --once, --query y --proxy-check.');
    }
    if (args.includes('--proxy-check')) {
      if (!config.browser.proxy) throw new Error('Configura PROXY_URL en .env para comprobar el proxy.');
      config.browser.startupUrl = undefined;
      config.target.reuseLoadedPage = false;
    }
    if (config.browser.proxy) view.secrets.push(config.browser.proxy.username, config.browser.proxy.password);
    const workflow = args.includes('--query') ? 'query' : 'inspect';
    app = await createApplication(config, view, error => abort.abort(error), workflow);
    const page = await app.session.open(abort.signal);
    app.heartbeat.start();
    if (args.includes('--proxy-check')) await app.proxyCheck.verify(page, abort.signal);
    await app.controller.capture(page, abort.signal);
    if (app.query) {
      const result = await app.query.run(page, abort.signal);
      if (result.stage === 'identity-rejected') process.exitCode = 1;
    }
    await app.session.saveCookies();
    if (config.keepBrowserOpen && !args.includes('--once')) {
      view.info('Sesión activa. Pulsa Ctrl+C para guardar las cookies y cerrar.');
      if (!abort.signal.aborted) await once(abort.signal, 'abort');
    }
    if (abort.signal.reason instanceof Error && abort.signal.reason.name !== 'AbortError') {
      throw abort.signal.reason;
    }
  } catch (error) {
    const cancelled = abort.signal.aborted && abort.signal.reason?.name === 'AbortError';
    if (!cancelled) {
      view.error(error);
      process.exitCode = 1;
    }
  } finally {
    try {
      await app?.heartbeat.stop();
      await app?.session.close();
    } catch (error) {
      view.error(error);
      process.exitCode = 1;
    }
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

await main();
