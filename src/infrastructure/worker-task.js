import { Worker } from 'node:worker_threads';

/** Ejecuta una tarea aislada con timeout y terminación al cancelar. */
export class WorkerTask {
  constructor(url, workerData, timeoutMs, label) {
    Object.assign(this, { url, workerData, timeoutMs, label });
  }

  run(payload, { signal, timeoutMs = this.timeoutMs } = {}) {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.url, { workerData: this.workerData });
      let completed = false;
      const finish = async (error, result) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        try {
          await worker.terminate();
          if (error) reject(error);
          else resolve(result);
        } catch (terminationError) {
          reject(error || terminationError);
        }
      };
      const cancel = () => { void finish(signal.reason); };
      const timer = setTimeout(() => {
        void finish(new Error(`Se agotó el tiempo de respuesta de ${this.label}.`));
      }, Math.min(timeoutMs, this.timeoutMs));
      signal?.addEventListener('abort', cancel, { once: true });
      worker.once('message', ({ error, result }) => {
        void finish(error ? new Error(error) : null, result);
      });
      worker.once('error', error => { void finish(error); });
      worker.once('exit', code => {
        if (!completed) void finish(new Error(`El worker ${this.label} terminó sin respuesta (${code}).`));
      });
      worker.postMessage(payload);
    });
  }
}
