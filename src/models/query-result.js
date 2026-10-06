/** Representa el progreso de la consulta y el resultado real de la validación. */
export class QueryResult {
  constructor(url, query, captcha, modal) {
    if (!modal?.fields?.length) throw new Error('Falta evidencia de la ventana de identidad.');
    this.stage = 'identity-modal';
    this.capturedAt = new Date().toISOString();
    Object.assign(this, { url, query, captcha, modal });
  }

  completeIdentity(validation) {
    this.identityValidation = validation;
    this.stage = validation.accepted ? 'identity-validated' : 'identity-rejected';
  }
}
