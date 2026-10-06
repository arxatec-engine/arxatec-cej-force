/** Coordina el llenado, un envío de identidad y la evidencia de su respuesta. */
export class IdentityController {
  constructor({ form, validation, artifacts, view, data }) {
    Object.assign(this, { form, validation, artifacts, view, data });
  }

  async run(page, signal) {
    await this.form.fill(page, this.data, signal);
    this.view.info('Datos de identidad ingresados y comprobados.');
    await this.artifacts.save(page, 'identidad-preparada', { stage: 'identity-filled', documentType: this.data.documentType });
    this.view.info('Pulsando Validar y esperando la respuesta del CEJ.');
    const result = await this.validation.submit(page, signal);
    const files = await this.artifacts.save(page, 'identidad-respuesta', result);
    if (result.status === 'CAPTCHA_ERROR') {
      const error = new Error('El CEJ rechazó el CAPTCHA durante la validación.');
      error.name = 'CaptchaRejectedError';
      error.alreadyRefreshed = true;
      throw error;
    }
    this.view.info(result.accepted ? 'El CEJ confirmó la identidad.'
      : `El CEJ rechazó la identidad. Revisa ${files.json} y el mensaje del modal.`);
    return result;
  }
}
