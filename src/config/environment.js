import { resolve } from 'node:path';

function integer(env, name, fallback, minimum = 1) {
  const value = Number(env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} debe ser un entero mayor o igual a ${minimum}.`);
  }
  return value;
}

function boolean(env, name, fallback) {
  const value = env[name] || String(fallback);
  if (!['true', 'false'].includes(value)) throw new Error(`${name}: usa true o false.`);
  return value === 'true';
}

function choice(env, name, fallback, choices) {
  const value = env[name] || fallback;
  if (!choices.includes(value)) throw new Error(`${name}: usa ${choices.join(', ')}.`);
  return value;
}

export function loadEnvironment(env = process.env) {
  if (env.HEADLESS) {
    throw new Error('Sustituye HEADLESS por BROWSER_HEADLESS: chrome-launcher activa headless incluso con HEADLESS=false.');
  }
  const targetUrl = env.TARGET_URL || 'https://cej.pj.gob.pe/cej/forms/busquedaform.html';
  if (!['http:', 'https:'].includes(new URL(targetUrl).protocol)) {
    throw new Error('TARGET_URL debe usar HTTP o HTTPS.');
  }
  const mode = choice(env, 'BROWSER_MODE', 'local', ['real', 'local', 'cdp', 'browserless']);
  const startupDelayMs = integer(env, 'BROWSER_STARTUP_DELAY_MS', 15000, 0);
  const warmStart = mode === 'local' && startupDelayMs > 0;
  const captchaMode = choice(env, 'CAPTCHA_MODE', 'manual', ['manual', 'ocr', '2captcha']);
  const isOcr = captchaMode === 'ocr';
  const minConfidence = integer(env, 'OCR_MIN_CONFIDENCE', 60, 0);
  if (minConfidence > 100) throw new Error('OCR_MIN_CONFIDENCE no puede superar 100.');
  if (mode === 'cdp' && !env.CDP_ENDPOINT) throw new Error('Falta CDP_ENDPOINT.');
  if (mode === 'browserless' && !env.BROWSERLESS_TOKEN) {
    throw new Error('Falta BROWSERLESS_TOKEN.');
  }
  if (captchaMode === '2captcha' && !env.TWOCAPTCHA_API_KEY) {
    throw new Error('Falta TWOCAPTCHA_API_KEY.');
  }
  return {
    browser: {
      mode,
      headless: boolean(env, 'BROWSER_HEADLESS', false),
      executablePath: env.CHROME_PATH || '',
      profileDirectory: resolve(env.PROFILE_DIRECTORY || 'data/visible-query-profile'),
      startupUrl: warmStart ? targetUrl : undefined,
      startupDelayMs,
      cdpEndpoint: env.CDP_ENDPOINT,
      browserlessEndpoint: env.BROWSERLESS_ENDPOINT
        || 'wss://production-sfo.browserless.io/chromium',
      browserlessToken: env.BROWSERLESS_TOKEN,
      timeoutMs: integer(env, 'NAVIGATION_TIMEOUT_MS', 45000),
      userAgent: env.USER_AGENT || '',
      timezone: env.TIMEZONE || 'America/Lima',
      language: env.ACCEPT_LANGUAGE || 'es-PE,es;q=0.9',
    },
    target: {
      url: targetUrl,
      formSelector: env.FORM_SELECTOR || 'form',
      requiredText: env.FORM_REQUIRED_TEXT ?? 'Distrito Judicial',
      actionsFile: env.ACTIONS_FILE || '',
      reuseLoadedPage: warmStart,
      timeoutMs: integer(env, 'FORM_TIMEOUT_MS', 300000),
      pollIntervalMs: integer(env, 'POLL_INTERVAL_MS', 1000, 100),
    },
    captcha: {
      mode: captchaMode,
      apiKey: env.TWOCAPTCHA_API_KEY,
      timeoutMs: integer(env, 'CAPTCHA_TIMEOUT_MS', 120000, 1000),
      minConfidence,
      audioFallback: boolean(env, 'CAPTCHA_AUDIO_FALLBACK', true),
      cacheDirectory: resolve(env.OCR_CACHE_DIRECTORY || 'data/ocr-cache'),
      type: choice(env, 'CAPTCHA_TYPE', isOcr ? 'image' : 'recaptcha', ['recaptcha', 'turnstile', 'image']),
      triggerSelector: env.CAPTCHA_TRIGGER_SELECTOR || (isOcr ? '#captcha_image' : '.g-recaptcha'),
      siteKey: env.CAPTCHA_SITE_KEY || '',
      responseSelector: env.CAPTCHA_RESPONSE_SELECTOR || (isOcr ? '#codigoCaptcha' : '[name="g-recaptcha-response"]'),
      imageSelector: env.CAPTCHA_IMAGE_SELECTOR || (isOcr ? '#captcha_image' : ''),
      callback: env.CAPTCHA_CALLBACK || '',
      submitSelector: env.CAPTCHA_SUBMIT_SELECTOR || '',
    },
    query: {
      file: resolve(env.QUERY_FILE || 'config/cej-query.json'),
      timeoutMs: integer(env, 'QUERY_TIMEOUT_MS', 45000),
      attempts: integer(env, 'QUERY_CAPTCHA_ATTEMPTS', 3),
    },
    identity: {
      enabled: boolean(env, 'VALIDATE_IDENTITY', true),
      file: resolve(env.IDENTITY_FILE || 'data/consultant-identity.json'),
      timeoutMs: integer(env, 'IDENTITY_TIMEOUT_MS', 60000),
    },
    cookieFile: resolve(env.COOKIE_FILE || 'data/visible-query-cookies.json'),
    outputDirectory: resolve(env.OUTPUT_DIRECTORY || 'output'),
    keepBrowserOpen: boolean(env, 'KEEP_BROWSER_OPEN', true),
    heartbeatIntervalMs: integer(env, 'HEARTBEAT_INTERVAL_MS', 30000, 1000),
  };
}
