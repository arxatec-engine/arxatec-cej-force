import { loadActions } from './config/actions.js';
import { LocalBrowser } from './browser/local-browser.js';
import { RealBrowser } from './browser/real-browser.js';
import { CdpBrowser } from './browser/cdp-browser.js';
import { BrowserlessBrowser } from './browser/browserless-browser.js';
import { BrowserSession } from './browser/browser-session.js';
import { CookieRepository } from './models/cookie-repository.js';
import { ArtifactRepository } from './models/artifact-repository.js';
import { JsonFile } from './infrastructure/json-file.js';
import { FormInspector } from './services/form-inspector.js';
import { ChallengeDetector } from './services/challenge-detector.js';
import { createCaptchaSolver } from './services/captcha-factory.js';
import { FormAccess } from './services/form-access.js';
import { FormInteractor } from './services/form-interactor.js';
import { FormController } from './controllers/form-controller.js';
import { SessionHeartbeat } from './services/session-heartbeat.js';
import { loadQuery } from './config/query.js';
import { QueryForm } from './services/query-form.js';
import { SelectOption } from './services/select-option.js';
import { IdentityModal } from './services/identity-modal.js';
import { CaptchaRefresher } from './services/captcha-refresher.js';
import { QueryController } from './controllers/query-controller.js';
import { loadIdentity } from './config/identity.js';
import { IdentityForm } from './services/identity-form.js';
import { IdentityValidation } from './services/identity-validation.js';
import { IdentityController } from './controllers/identity-controller.js';
import { ProxyBridge } from './infrastructure/proxy-bridge.js';
import { ProxyBrowser } from './browser/proxy-browser.js';
import { ProxyVerifier } from './services/proxy-verifier.js';

/** Raíz de composición: inyecta adaptadores sin acoplar el controlador a SDKs. */
export async function createApplication(config, view, onFailure, workflow = 'inspect') {
  const providers = {
    real: () => new RealBrowser(config.browser),
    local: () => config.browser.proxy
      ? new ProxyBrowser(options => new LocalBrowser(options, view),
        new ProxyBridge(config.browser.proxy, view), config.browser, view)
      : new LocalBrowser(config.browser, view),
    cdp: () => new CdpBrowser(config.browser.cdpEndpoint, config.browser.timeoutMs),
    browserless: () => new BrowserlessBrowser(config.browser),
  };
  const storage = new JsonFile();
  const cookies = new CookieRepository(config.cookieFile, config.target.url, storage);
  const session = new BrowserSession(providers[config.browser.mode](), cookies, config.browser);
  const inspector = new FormInspector(config.target);
  const solver = createCaptchaSolver(config, view, storage);
  const access = new FormAccess(inspector, new ChallengeDetector(), solver, view, config.target);
  const controller = new FormController({
    access, interactor: new FormInteractor(solver),
    artifacts: new ArtifactRepository(config.outputDirectory, storage),
    view, target: config.target, actions: await loadActions(config.target.actionsFile),
  });
  const heartbeat = new SessionHeartbeat(session, view, config.heartbeatIntervalMs, onFailure);
  const identity = workflow === 'query' && config.identity.enabled ? new IdentityController({
    form: new IdentityForm(new FormInteractor()), validation: new IdentityValidation(config.identity.timeoutMs),
    artifacts: new ArtifactRepository(config.outputDirectory, storage), view,
    data: await loadIdentity(config.identity.file),
  }) : null;
  const query = workflow === 'query' ? new QueryController({
    form: new QueryForm(new SelectOption(), new FormInteractor()), solver,
    modal: new IdentityModal(config.query.timeoutMs), identity, refresher: new CaptchaRefresher(),
    artifacts: new ArtifactRepository(config.outputDirectory, storage), view,
    data: await loadQuery(config.query.file), options: config.query,
  }) : null;
  const proxyCheck = new ProxyVerifier(
    new ArtifactRepository(config.outputDirectory, storage), view, config.proxyCheck,
  );
  return { session, controller, query, heartbeat, proxyCheck };
}
