/** Presenta el progreso sin exponer credenciales de los proveedores. */
export class ConsoleView {
  constructor(secrets = [], output = console) {
    this.secrets = secrets.filter(Boolean);
    this.output = output;
  }

  redact(message) {
    let result = String(message);
    for (const secret of this.secrets) {
      result = result.replaceAll(secret, '[REDACTED]');
      result = result.replaceAll(encodeURIComponent(secret), '[REDACTED]');
    }
    return result.replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@')
      .replace(/([?&](?:token|apiKey|key)=)[^&\s]+/gi, '$1[REDACTED]');
  }

  info(message) {
    this.output.log(`[CEJ] ${this.redact(message)}`);
  }

  error(error) {
    this.output.error(`[CEJ] ${this.redact(error.message || error)}`);
  }

  form(snapshot, artifacts) {
    this.info(`Formulario obtenido: ${snapshot.forms.length} formulario(s).`);
    for (const form of snapshot.forms) {
      const fields = [...form.fields, ...(form.sharedFields || [])]
        .filter(field => field.type !== 'hidden');
      this.info(`${form.id || form.name || '(sin id)'}: ${fields.length} controles.`);
      for (const field of fields) {
        this.info(`  ${field.selector}: ${field.label || field.name || field.type}`);
      }
    }
    this.info(`Archivos: ${artifacts.json}, ${artifacts.html}, ${artifacts.screenshot}`);
  }
}
