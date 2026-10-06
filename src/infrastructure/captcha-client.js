import { WorkerTask } from './worker-task.js';

/** Ejecuta el SDK de CAPTCHA con límite de tiempo y cancelación del proceso. */
export class CaptchaClient {
  constructor(apiKey, timeoutMs = 120000) {
    this.worker = new WorkerTask(new URL('./captcha-worker.js', import.meta.url),
      { apiKey }, timeoutMs, '2Captcha');
  }

  execute(method, parameters, execution) {
    return this.worker.run({ method, parameters }, execution);
  }
}
