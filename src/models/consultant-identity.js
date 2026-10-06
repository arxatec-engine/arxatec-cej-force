/** Valida los datos del consultante sin inferir ni modificar su identidad. */
export class ConsultantIdentity {
  constructor(data) {
    const fields = ['documentType', 'documentNumber', 'verificationCode', 'issueDate', 'birthDate'];
    for (const field of fields) {
      if (typeof data?.[field] !== 'string' || !data[field].trim()) {
        throw new Error(`La identidad necesita ${field} de tipo string y no vacío.`);
      }
      this[field] = data[field].trim();
    }
    if (this.documentType !== 'DNI') throw new Error('La validación automática configurada requiere DNI.');
    if (!/^\d{8}$/.test(this.documentNumber) || !/^\d$/.test(this.verificationCode)) {
      throw new Error('Usa ocho dígitos para el DNI y un dígito para su código de verificación.');
    }
    for (const field of ['issueDate', 'birthDate']) {
      const value = this[field];
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())
        || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${field} debe ser una fecha real con formato YYYY-MM-DD.`);
      }
    }
    if (this.birthDate > this.issueDate) throw new Error('La emisión debe ser posterior al nacimiento.');
  }
}
