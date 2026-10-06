import { selectOcrAnswer } from './ocr-answer.js';

/** Resuelve una captura actual con OCR y respaldo accesible cuando la lectura es dudosa. */
export class OcrCaptchaSolver {
  constructor({ image, preprocessor, client, writer, audio, options, view, storage, readingFile }) {
    Object.assign(this, { image, preprocessor, client, writer, audio, options, view, storage, readingFile });
  }

  async canSolve(page) {
    const image = await page.$(this.options.imageSelector);
    await image?.dispose();
    return Boolean(image);
  }

  async solve(page, execution = {}) {
    const buffer = await this.image.capture(page, execution.signal);
    const variants = await this.preprocessor.prepare(buffer);
    const readings = await this.client.recognize(variants, execution);
    const answer = selectOcrAnswer(readings, this.options.minConfidence);
    let code = answer?.text;
    let method = 'ocr';
    if (!code && this.audio) {
      this.view.info('Lectura OCR dudosa; usando el audio accesible del CEJ.');
      code = await this.audio.read(page, execution.signal);
      method = 'audio';
    }
    await this.storage.write(this.readingFile, { method, code, readings });
    if (!code) throw new Error('El OCR no pudo leer cuatro caracteres con suficiente confianza.');
    execution.signal?.throwIfAborted();
    await this.writer.write(page, code, this.options);
    this.view.info(`CAPTCHA leído mediante ${method} e ingresado en el formulario.`);
    return { method, code, confidence: answer?.confidence ?? null };
  }
}
