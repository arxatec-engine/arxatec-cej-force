import { readFile } from 'node:fs/promises';
import { ConsultantIdentity } from '../models/consultant-identity.js';

/** Lee la configuración privada de identidad antes de abrir el navegador. */
export async function loadIdentity(file) {
  let source;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Falta IDENTITY_FILE (${file}). Completa el archivo local o usa VALIDATE_IDENTITY=false.`);
    }
    throw error;
  }
  return new ConsultantIdentity(JSON.parse(source));
}
