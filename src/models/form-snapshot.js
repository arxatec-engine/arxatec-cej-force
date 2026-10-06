/** Representa un formulario verificado y sus metadatos de captura. */
export class FormSnapshot {
  constructor({ url, title, forms, httpStatus }) {
    if (!forms.length) throw new Error('No se puede exportar una captura sin formulario.');
    this.url = url;
    this.title = title;
    this.httpStatus = httpStatus;
    this.capturedAt = new Date().toISOString();
    this.forms = forms;
  }
}
