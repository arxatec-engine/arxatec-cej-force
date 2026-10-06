import { mkdir } from 'node:fs/promises';
import { WorkerTask } from './worker-task.js';

/** Ejecuta OCR local con caché, timeout y cancelación. */
export class OcrClient {
  constructor(cacheDirectory, timeoutMs) {
    this.cacheDirectory = cacheDirectory;
    this.worker = new WorkerTask(new URL('./ocr-worker.js', import.meta.url),
      { cacheDirectory }, timeoutMs, 'OCR');
  }

  async recognize(variants, execution) {
    await mkdir(this.cacheDirectory, { recursive: true, mode: 0o700 });
    return this.worker.run({ variants }, execution);
  }
}
