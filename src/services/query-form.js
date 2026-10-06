/** Ingresa y comprueba los seis criterios solicitados antes de resolver el CAPTCHA. */
export class QueryForm {
  constructor(options, interactor) {
    this.options = options;
    this.interactor = interactor;
  }

  async fill(page, data, signal) {
    for (const [selector, text] of [
      ['#distritoJudicial', data.district], ['#organoJurisdiccional', data.instance],
      ['#especialidad', data.specialty], ['#anio', data.year],
    ]) await this.options.byText(page, selector, text, signal);
    await this.interactor.run(page, [
      { type: 'fill', selector: '#numeroExpediente', value: data.number },
      { type: 'fill', selector: '#parte', value: data.party },
    ], signal);
    const actual = await page.evaluate(() => ({
      district: document.querySelector('#distritoJudicial').selectedOptions[0].textContent.trim(),
      instance: document.querySelector('#organoJurisdiccional').selectedOptions[0].textContent.trim(),
      specialty: document.querySelector('#especialidad').selectedOptions[0].textContent.trim(),
      year: document.querySelector('#anio').value,
      number: document.querySelector('#numeroExpediente').value,
      party: document.querySelector('#parte').value,
    }));
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
    for (const name of Object.keys(actual)) {
      if (normalize(actual[name]) !== normalize(data[name])) {
        throw new Error(`El campo ${name} no conserva el valor solicitado.`);
      }
    }
    return actual;
  }
}
