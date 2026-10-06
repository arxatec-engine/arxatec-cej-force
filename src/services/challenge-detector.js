/** Reconoce pantallas de bloqueo; no las confunde con el formulario objetivo. */
export class ChallengeDetector {
  async inspect(page) {
    return page.evaluate(() => {
      const title = document.title;
      const text = document.body?.innerText || '';
      if (/forbidden|access denied|request rejected|request blocked|acceso denegado/i.test(`${title} ${text}`)) {
        return { kind: 'blocked', title };
      }
      if (/radware/i.test(title) || /verifying your browser before proceeding/i.test(text)) {
        return { kind: 'radware', title };
      }
      if (document.querySelector('.g-recaptcha, .h-captcha, .cf-turnstile, '
        + 'iframe[src*="recaptcha"], iframe[src*="hcaptcha.com"]')) {
        return { kind: 'captcha', title };
      }
      return { kind: document.readyState === 'complete' ? 'unknown' : 'loading', title };
    });
  }
}
