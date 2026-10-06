/** Selecciona DNI primero, rellena sus campos y comprueba los valores efectivos. */
export class IdentityForm {
  constructor(interactor) {
    this.interactor = interactor;
  }

  async fill(page, data, signal) {
    const fields = {
      documentType: 'tipoDocumento', documentNumber: 'numDocumento',
      verificationCode: 'codVerificacion', issueDate: 'fechaEmision', birthDate: 'fechaNacimiento',
    };
    await this.interactor.run(page, Object.entries(fields).map(([name, id]) => ({
      type: name === 'documentType' ? 'select' : 'fill', selector: `#${id}`, value: data[name],
    })), signal);
    signal.throwIfAborted();
    const actual = await page.evaluate(fields => Object.fromEntries(
      Object.entries(fields).map(([name, id]) => {
        const input = document.getElementById(id);
        if (!input || input.disabled || !input.checkValidity()) {
          throw new Error(`El control de identidad ${id} no está listo.`);
        }
        return [name, input.value];
      }),
    ), fields);
    for (const name of Object.keys(fields)) {
      if (actual[name] !== data[name]) throw new Error(`El campo de identidad ${name} no conserva el valor solicitado.`);
    }
  }
}
