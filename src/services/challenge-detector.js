/** Reconoce pantallas de bloqueo; no las confunde con el formulario objetivo. */
export class ChallengeDetector {
  async inspect(page) {
    return page.evaluate(() => {
      const title = document.title;
      const text = document.body?.innerText || '';
      if (/radware/i.test(title) || /verifying your browser before proceeding/i.test(text)) {
        return { kind: 'radware', title };
      }
      if (/access denied|request rejected|acceso denegado/i.test(`${title} ${text}`)) {
        return { kind: 'blocked', title };
      }
      if (document.querySelector('.g-recaptcha, .cf-turnstile, iframe[src*="recaptcha"]')) {
        return { kind: 'captcha', title };
      }
      return { kind: 'loading', title };
    });
  }
}
