import { parentPort, workerData } from 'node:worker_threads';
import TwoCaptcha from '@2captcha/captcha-solver';

/** Aísla el polling del SDK para poder cancelarlo sin dejar solicitudes activas. */
const solver = new TwoCaptcha.Solver(workerData.apiKey);
parentPort.once('message', async ({ method, parameters }) => {
  try {
    if (!['recaptcha', 'cloudflareTurnstile', 'imageCaptcha'].includes(method)) {
      throw new Error('Método CAPTCHA no soportado.');
    }
    const result = await solver[method](parameters);
    parentPort.postMessage({ result });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});
