import { join } from 'node:path';
import { ProxyProviderError } from '../infrastructure/proxy-provider-error.js';

/** Guarda el rechazo del proveedor aunque Chrome falle antes de conectar CDP. */
export class ProxyFailureRepository {
  constructor(directory, storage) {
    Object.assign(this, { directory, storage });
  }

  async save(error) {
    if (!(error instanceof ProxyProviderError)) return null;
    const file = join(this.directory, 'proxy-error.json');
    await this.storage.write(file, {
      capturedAt: new Date().toISOString(), stage: 'proxy',
      code: error.code, httpStatus: error.httpStatus,
      destination: error.destination, error: error.message,
    });
    return file;
  }
}
